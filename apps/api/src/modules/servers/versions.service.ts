import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WingsClient } from '@obsidian/wings-adapter';

export type ReleaseCategory = 'release' | 'snapshot' | 'beta' | 'alpha' | 'lts';

export interface VersionItem {
  version: string;
  build?: string;
  releaseType: ReleaseCategory;
  javaVersion: string;
  downloadUrl?: string;
  releaseTime?: string;
}

export interface VersionSoftwareOption {
  id: string;
  name: string;
  type: 'server' | 'proxy' | 'modded';
  description: string;
  icon: string;
  defaultJar: string;
  recommendedJava: string;
  totalCount: number;
  versions: VersionItem[];
}

const LTS_VERSIONS = new Set([
  '26.3',
  '1.21.4',
  '1.21.1',
  '1.20.4',
  '1.20.1',
  '1.19.4',
  '1.18.2',
  '1.17.1',
  '1.16.5',
  '1.12.2',
  '1.8.8',
  '1.7.10',
]);

function detectJavaVersion(version: string): string {
  const v = version.toLowerCase();
  if (
    v.startsWith('26.') ||
    v.startsWith('1.21') ||
    v.startsWith('1.20.5') ||
    v.startsWith('1.20.6') ||
    v.includes('26w') ||
    v.includes('25w') ||
    v.includes('24w')
  ) {
    return 'Java 21';
  }
  if (
    v.startsWith('1.20') ||
    v.startsWith('1.19') ||
    v.startsWith('1.18') ||
    v.includes('23w') ||
    v.includes('22w')
  ) {
    return 'Java 17';
  }
  if (v.startsWith('1.17') || v.includes('21w')) {
    return 'Java 16';
  }
  return 'Java 8';
}

@Injectable()
export class VersionsService {
  private readonly logger = new Logger(VersionsService.name);
  private cachedCatalog: VersionSoftwareOption[] | null = null;
  private lastFetchedAt = 0;
  private readonly CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache
  private isFetching = false;

  constructor(private readonly prisma: PrismaService) {}

  private getWingsClient(node: {
    scheme: string;
    fqdn: string;
    daemonPort: number;
    daemonToken: string;
  }): WingsClient {
    return new WingsClient({
      scheme: node.scheme as 'http' | 'https',
      fqdn: node.fqdn,
      daemonListen: node.daemonPort,
      daemonToken: node.daemonToken,
    });
  }

  /**
   * Get all supported Minecraft software and full version catalogs (all releases, snapshots, betas, alphas).
   */
  async getSoftwareCatalog(): Promise<VersionSoftwareOption[]> {
    const now = Date.now();
    if (this.cachedCatalog && now - this.lastFetchedAt < this.CACHE_TTL_MS) {
      return this.cachedCatalog;
    }

    // If cache expired or not yet populated, fetch dynamically
    if (!this.cachedCatalog) {
      const catalog = await this.fetchLiveCatalog();
      this.cachedCatalog = catalog;
      this.lastFetchedAt = now;
      return catalog;
    }

    // Refresh in background if we have stale cache to keep response times sub-second
    if (!this.isFetching) {
      this.isFetching = true;
      this.fetchLiveCatalog()
        .then((fresh) => {
          this.cachedCatalog = fresh;
          this.lastFetchedAt = Date.now();
        })
        .catch((err) => {
          this.logger.warn(`Background catalog refresh failed: ${err.message}`);
        })
        .finally(() => {
          this.isFetching = false;
        });
    }

    return this.cachedCatalog;
  }

  /**
   * Fetch versions concurrently from Mojang, PaperMC Fill v3, Purpur, and Fabric.
   */
  private async fetchLiveCatalog(): Promise<VersionSoftwareOption[]> {
    const userAgent = 'ObsidianPanel/1.0 (support@obsidianpanel.com)';
    const headers = { 'User-Agent': userAgent };

    const [mojRes, papRes, purRes, fabRes, velRes, folRes, watRes] = await Promise.allSettled([
      fetch('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json').then((r) => r.json()),
      fetch('https://fill.papermc.io/v3/projects/paper', { headers }).then((r) => r.json()),
      fetch('https://api.purpurmc.org/v2/purpur').then((r) => r.json()),
      fetch('https://meta.fabricmc.net/v2/versions/game').then((r) => r.json()),
      fetch('https://fill.papermc.io/v3/projects/velocity', { headers }).then((r) => r.json()),
      fetch('https://fill.papermc.io/v3/projects/folia', { headers }).then((r) => r.json()),
      fetch('https://fill.papermc.io/v3/projects/waterfall', { headers }).then((r) => r.json()),
    ]);

    // 1. Process Vanilla Mojang (Releases, Snapshots, Old Beta, Old Alpha)
    const vanillaVersions: VersionItem[] = [];
    const mojVal = mojRes.status === 'fulfilled' ? (mojRes.value as any) : null;
    if (mojVal?.versions) {
      for (const item of mojVal.versions) {
        let releaseType: ReleaseCategory = 'release';
        if (item.type === 'snapshot') releaseType = 'snapshot';
        else if (item.type === 'old_beta') releaseType = 'beta';
        else if (item.type === 'old_alpha') releaseType = 'alpha';
        else if (LTS_VERSIONS.has(item.id)) releaseType = 'lts';

        vanillaVersions.push({
          version: item.id,
          releaseType,
          javaVersion: detectJavaVersion(item.id),
          releaseTime: item.releaseTime,
        });
      }
    } else {
      vanillaVersions.push(...this.getFallbackVanilla());
    }

    // 2. Process PaperMC (All versions, pre-releases, RCs)
    const paperVersions: VersionItem[] = [];
    const papVal = papRes.status === 'fulfilled' ? (papRes.value as any) : null;
    if (papVal?.versions) {
      const vObj = papVal.versions;
      for (const majorGroup of Object.keys(vObj)) {
        const subList = vObj[majorGroup] || [];
        for (const ver of subList) {
          const isLts = LTS_VERSIONS.has(ver);
          const isRcOrPre = ver.includes('-rc') || ver.includes('-pre') || ver.includes('-SNAPSHOT');
          paperVersions.push({
            version: ver,
            releaseType: isLts ? 'lts' : isRcOrPre ? 'snapshot' : 'release',
            javaVersion: detectJavaVersion(ver),
          });
        }
      }
    } else {
      paperVersions.push(...this.getFallbackPaper());
    }

    // 3. Process Purpur
    const purpurVersions: VersionItem[] = [];
    const purVal = purRes.status === 'fulfilled' ? (purRes.value as any) : null;
    if (Array.isArray(purVal?.versions)) {
      const rev = [...purVal.versions].reverse();
      for (const ver of rev) {
        const isLts = LTS_VERSIONS.has(ver);
        const isSnapshot = ver.includes('-SNAPSHOT') || ver.includes('-rc') || ver.includes('-pre');
        purpurVersions.push({
          version: ver,
          releaseType: isLts ? 'lts' : isSnapshot ? 'snapshot' : 'release',
          javaVersion: detectJavaVersion(ver),
        });
      }
    } else {
      purpurVersions.push(...this.getFallbackPurpur());
    }

    // 4. Process Fabric (All Game Versions)
    const fabricVersions: VersionItem[] = [];
    const fabVal = fabRes.status === 'fulfilled' ? (fabRes.value as any) : null;
    if (Array.isArray(fabVal)) {
      for (const item of fabVal) {
        const isLts = LTS_VERSIONS.has(item.version);
        fabricVersions.push({
          version: item.version,
          releaseType: isLts ? 'lts' : item.stable ? 'release' : 'snapshot',
          javaVersion: detectJavaVersion(item.version),
        });
      }
    } else {
      fabricVersions.push(...this.getFallbackFabric());
    }

    // 5. Process Velocity
    const velocityVersions: VersionItem[] = [];
    const velVal = velRes.status === 'fulfilled' ? (velRes.value as any) : null;
    if (velVal?.versions) {
      const vObj = velVal.versions;
      for (const group of Object.keys(vObj)) {
        for (const ver of vObj[group] || []) {
          const isSnapshot = ver.includes('-SNAPSHOT') || ver.includes('-rc');
          velocityVersions.push({
            version: ver,
            releaseType: isSnapshot ? 'snapshot' : 'release',
            javaVersion: 'Java 21 / Java 17',
          });
        }
      }
    }

    // 6. Process Folia
    const foliaVersions: VersionItem[] = [];
    const folVal = folRes.status === 'fulfilled' ? (folRes.value as any) : null;
    if (folVal?.versions) {
      const vObj = folVal.versions;
      for (const group of Object.keys(vObj)) {
        for (const ver of vObj[group] || []) {
          const isSnapshot = ver.includes('-rc') || ver.includes('-pre') || ver.includes('-SNAPSHOT');
          foliaVersions.push({
            version: ver,
            releaseType: isSnapshot ? 'snapshot' : 'release',
            javaVersion: 'Java 21',
          });
        }
      }
    }

    // 7. Process Waterfall
    const waterfallVersions: VersionItem[] = [];
    const watVal = watRes.status === 'fulfilled' ? (watRes.value as any) : null;
    if (watVal?.versions) {
      const vObj = watVal.versions;
      for (const group of Object.keys(vObj)) {
        for (const ver of vObj[group] || []) {
          waterfallVersions.push({
            version: ver,
            releaseType: 'release',
            javaVersion: 'Java 17 / Java 11',
          });
        }
      }
    }

    return [
      {
        id: 'paper',
        name: 'PaperMC',
        type: 'server',
        description: 'High-performance Spigot-compatible Minecraft software with anti-xray, exploit patches, and major performance optimizations.',
        icon: 'paper',
        defaultJar: 'paper.jar',
        recommendedJava: 'Java 21 / Java 17',
        totalCount: paperVersions.length,
        versions: paperVersions,
      },
      {
        id: 'purpur',
        name: 'Purpur',
        type: 'server',
        description: 'Drop-in replacement for Paper with extensive gameplay customization options, ridable mobs, and TPS improvements.',
        icon: 'purpur',
        defaultJar: 'purpur.jar',
        recommendedJava: 'Java 21 / Java 17',
        totalCount: purpurVersions.length,
        versions: purpurVersions,
      },
      {
        id: 'vanilla',
        name: 'Vanilla Minecraft',
        type: 'server',
        description: 'Official un-modded Mojang Minecraft Java Edition server software directly from Mojang launcher metadata, including all snapshots and classic betas.',
        icon: 'vanilla',
        defaultJar: 'server.jar',
        recommendedJava: 'Java 21 / Java 17',
        totalCount: vanillaVersions.length,
        versions: vanillaVersions,
      },
      {
        id: 'fabric',
        name: 'Fabric Loader',
        type: 'modded',
        description: 'Ultra-lightweight, modular modding toolchain for Minecraft with rapid updates and seamless performance mods (Lithium, FerriteCore).',
        icon: 'fabric',
        defaultJar: 'fabric-server-launch.jar',
        recommendedJava: 'Java 21 / Java 17',
        totalCount: fabricVersions.length,
        versions: fabricVersions,
      },
      {
        id: 'velocity',
        name: 'Velocity Proxy',
        type: 'proxy',
        description: 'Next-generation Minecraft proxy offering unbeatable performance, high scalability, modern plugin architecture, and DoS mitigation.',
        icon: 'velocity',
        defaultJar: 'velocity.jar',
        recommendedJava: 'Java 21 / Java 17',
        totalCount: velocityVersions.length,
        versions: velocityVersions,
      },
      {
        id: 'folia',
        name: 'Folia (Multi-threaded)',
        type: 'server',
        description: 'Paper fork that splits tick loops into independent regional chunks, enabling 100+ TPS on multi-core servers with huge player bases.',
        icon: 'folia',
        defaultJar: 'folia.jar',
        recommendedJava: 'Java 21',
        totalCount: foliaVersions.length,
        versions: foliaVersions,
      },
      {
        id: 'waterfall',
        name: 'Waterfall Proxy',
        type: 'proxy',
        description: 'Upgraded BungeeCord proxy fork by PaperMC with enhanced security fixes and responsive network processing.',
        icon: 'waterfall',
        defaultJar: 'waterfall.jar',
        recommendedJava: 'Java 17 / Java 11',
        totalCount: waterfallVersions.length,
        versions: waterfallVersions,
      },
    ];
  }

  /**
   * Resolve direct download URL for selected software and version.
   */
  async resolveDownloadUrl(software: string, version: string): Promise<{ downloadUrl: string; jarName: string }> {
    const sw = software.toLowerCase().trim();
    const ver = version.trim();

    // 1. Purpur
    if (sw === 'purpur') {
      return {
        downloadUrl: `https://api.purpurmc.org/v2/purpur/${ver}/latest/download`,
        jarName: 'purpur.jar',
      };
    }

    // 2. Fabric Loader
    if (sw === 'fabric') {
      return {
        downloadUrl: `https://meta.fabricmc.net/v2/versions/loader/${ver}/0.20.0/1.1.2/server/jar`,
        jarName: 'fabric-server-launch.jar',
      };
    }

    // 3. Paper / Velocity / Folia / Waterfall via PaperMC Fill v3
    if (['paper', 'velocity', 'folia', 'waterfall'].includes(sw)) {
      const jarName = `${sw}.jar`;
      try {
        const userAgent = 'ObsidianPanel/1.0 (support@obsidianpanel.com)';
        const buildResp = await fetch(`https://fill.papermc.io/v3/projects/${sw}/versions/${ver}`, {
          headers: { 'User-Agent': userAgent },
        });

        if (buildResp.ok) {
          const buildData = (await buildResp.json()) as any;
          const latestBuild = buildData?.builds?.[0];
          if (latestBuild) {
            const dlResp = await fetch(
              `https://fill.papermc.io/v3/projects/${sw}/versions/${ver}/builds/${latestBuild}`,
              { headers: { 'User-Agent': userAgent } },
            );
            if (dlResp.ok) {
              const dlData = (await dlResp.json()) as any;
              const directUrl =
                dlData?.downloads?.['server:default']?.url ||
                (Object.values(dlData?.downloads || {})[0] as any)?.url;
              if (directUrl) {
                return { downloadUrl: directUrl, jarName };
              }
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Failed to resolve ${sw} ${ver} from Fill v3: ${err.message}`);
      }

      // High-speed direct fallbacks for popular versions
      if (sw === 'paper') {
        if (ver === '1.21.4') {
          return {
            downloadUrl:
              'https://fill-data.papermc.io/v1/objects/5ee4f542f628a14c644410b08c94ea42e772ef4d29fe92973636b6813d4eaffc/paper-1.21.4-232.jar',
            jarName,
          };
        }
        if (ver === '1.21.1') {
          return {
            downloadUrl:
              'https://fill-data.papermc.io/v1/objects/39bd8c00b9e18de91dcabd3cc3dcfa5328685a53b7187a2f63280c22e2d287b9/paper-1.21.1-133.jar',
            jarName,
          };
        }
        if (ver === '1.20.4') {
          return {
            downloadUrl:
              'https://fill-data.papermc.io/v1/objects/35fa78aa0e71973ca35d6e24db49348981432f7960714b62dbba49405d4df1ec/paper-1.20.4-499.jar',
            jarName,
          };
        }
        // Fallback to Purpur (compatible Paper drop-in)
        return {
          downloadUrl: `https://api.purpurmc.org/v2/purpur/${ver}/latest/download`,
          jarName,
        };
      }

      if (sw === 'velocity') {
        return {
          downloadUrl:
            'https://fill-data.papermc.io/v1/objects/fb599cbda6a6d01decce5e281f71f51cae7cacffcfafca32a09601f407b0583e/velocity-3.4.0-566.jar',
          jarName,
        };
      }
    }

    // 4. Vanilla Mojang (Releases + Snapshots + Betas)
    if (sw === 'vanilla') {
      try {
        const manifestResp = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json');
        if (manifestResp.ok) {
          const manifest = (await manifestResp.json()) as any;
          const entry = manifest.versions?.find((v: any) => v.id === ver);
          if (entry?.url) {
            const verResp = await fetch(entry.url);
            if (verResp.ok) {
              const verData = (await verResp.json()) as any;
              const dl = verData.downloads?.server?.url;
              if (dl) {
                return { downloadUrl: dl, jarName: 'server.jar' };
              }
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Failed to resolve Vanilla from Mojang: ${err.message}`);
      }

      throw new BadRequestException(
        `Vanilla version "${ver}" does not have an official Mojang dedicated server jar available. Please choose a release/snapshot with server support, or choose Paper/Fabric.`,
      );
    }

    // Default fallback
    return {
      downloadUrl: `https://api.purpurmc.org/v2/purpur/${ver}/latest/download`,
      jarName: `${sw}.jar`,
    };
  }

  /**
   * Install a version into the server directly via Wings.
   */
  async installVersion(
    serverUuid: string,
    dto: {
      software: string;
      version: string;
      customJarName?: string;
    },
  ): Promise<{ success: boolean; message: string; jarFile: string }> {
    const server = await this.prisma.server.findUnique({
      where: { uuid: serverUuid },
      include: {
        node: true,
        allocation: true,
        egg: {
          include: { variables: true },
        },
        variables: true,
      },
    });

    if (!server) {
      throw new NotFoundException('Server not found');
    }

    const { downloadUrl, jarName } = await this.resolveDownloadUrl(dto.software, dto.version);
    const targetJar = dto.customJarName?.trim() || jarName;
    const client = this.getWingsClient(server.node);

    this.logger.log(
      `Installing ${dto.software} ${dto.version} (${targetJar}) for server ${server.uuid} from ${downloadUrl}`,
    );

    // 0. Clean wipe: delete all existing files and directories to ensure clean install on version change
    try {
      this.logger.log(`Wiping existing files for server ${server.uuid} before version change...`);
      const existingFiles = await client.listFiles(server.uuid, '/');
      if (Array.isArray(existingFiles) && existingFiles.length > 0) {
        const fileNames = existingFiles.map((f) => f.name).filter(Boolean);
        if (fileNames.length > 0) {
          await client.deleteFiles(server.uuid, '/', fileNames);
          this.logger.log(`Successfully cleared ${fileNames.length} items from server ${server.uuid}`);
        }
      }
    } catch (clearErr: any) {
      this.logger.warn(`Non-critical: could not clear existing files prior to version installation: ${clearErr.message}`);
    }

    // 1. Download JAR file onto the server filesystem via Wings
    try {
      await client.pullFile(server.uuid, downloadUrl, '/', targetJar, true);
    } catch (pullErr: any) {
      this.logger.warn(`Wings pullFile failed (${pullErr.message}), falling back to direct write...`);
      throw new BadRequestException(
        `Failed to pull server jar from remote source via Wings: ${pullErr.message}`,
      );
    }

    // 2. Ensure eula.txt is accepted
    try {
      await client.writeFile(server.uuid, 'eula.txt', 'eula=true\n# Accepted via Obsidian Panel Version Manager\n');
    } catch (eulaErr: any) {
      this.logger.warn(`Failed to write eula.txt: ${eulaErr.message}`);
    }

    // 2.5 Ensure server.properties has IP set to 0.0.0.0 (or explicit IP) and port to allocated host port
    try {
      const targetPort = String(server.allocation?.port ?? 25565);
      const rawIp = server.allocation?.ip;
      const targetIp = rawIp && rawIp.trim() !== '' && rawIp !== '0.0.0.0' && rawIp !== '127.0.0.1' ? rawIp : '0.0.0.0';
      const props = [
        '# Minecraft server properties generated by Obsidian Panel',
        `server-ip=${targetIp}`,
        `server-port=${targetPort}`,
        `query.port=${targetPort}`,
        'enable-query=true',
        'motd=A Minecraft Server powered by Obsidian Panel',
        '',
      ].join('\n');
      await client.writeFile(server.uuid, 'server.properties', props);
    } catch (propsErr: any) {
      this.logger.warn(`Failed to write server.properties: ${propsErr.message}`);
    }

    // 3. Update server variable SERVER_JARFILE if defined in egg
    const jarVar = server.egg.variables.find((v) => v.envVariable === 'SERVER_JARFILE');
    if (jarVar) {
      const existing = server.variables.find((v) => v.variableId === jarVar.id);
      if (existing) {
        await this.prisma.serverVariable.update({
          where: { id: existing.id },
          data: { variableValue: targetJar },
        });
      } else {
        await this.prisma.serverVariable.create({
          data: {
            serverId: server.id,
            variableId: jarVar.id,
            variableValue: targetJar,
          },
        });
      }
    }

    // 4. Update MINECRAFT_VERSION variable if defined
    const mcVerVar = server.egg.variables.find((v) =>
      ['MINECRAFT_VERSION', 'MC_VERSION', 'VANILLA_VERSION'].includes(v.envVariable),
    );
    if (mcVerVar) {
      const existing = server.variables.find((v) => v.variableId === mcVerVar.id);
      if (existing) {
        await this.prisma.serverVariable.update({
          where: { id: existing.id },
          data: { variableValue: dto.version },
        });
      } else {
        await this.prisma.serverVariable.create({
          data: {
            serverId: server.id,
            variableId: mcVerVar.id,
            variableValue: dto.version,
          },
        });
      }
    }

    // 4.5 Auto-upgrade dockerImage to Java 21 if installing modern Minecraft (1.20.5+) on Java 17
    const isJava21Required = (ver: string) => {
      const match = ver.match(/^1\.(\d+)(?:\.(\d+))?/);
      if (!match) return false;
      const minor = parseInt(match[1] || '0', 10);
      const patch = parseInt(match[2] || '0', 10);
      return minor > 20 || (minor === 20 && patch >= 5);
    };

    if (dto.version && isJava21Required(dto.version) && server.dockerImage?.includes('java_17')) {
      const newImage = 'ghcr.io/pterodactyl/yolks:java_21';
      this.logger.log(`Auto-upgrading server ${server.uuid} dockerImage to ${newImage} for Minecraft ${dto.version}`);
      await this.prisma.server.update({
        where: { id: server.id },
        data: { dockerImage: newImage },
      });
    }

    // 5. Sync configuration to Wings so startup command has the new jar
    try {
      await client.syncServer(server.uuid);
    } catch (syncErr: any) {
      this.logger.warn(`Failed to sync configuration with Wings: ${syncErr.message}`);
    }

    // 6. Record activity log
    await this.prisma.activityLog.create({
      data: {
        serverId: server.id,
        event: 'server:version.install',
        properties: {
          software: dto.software,
          version: dto.version,
          jarFile: targetJar,
        },
      },
    });

    return {
      success: true,
      message: `Successfully installed ${dto.software.toUpperCase()} ${dto.version} (${targetJar})! You can now start the server.`,
      jarFile: targetJar,
    };
  }

  // Fallback lists in case upstream APIs are unreachable
  private getFallbackPaper(): VersionItem[] {
    return [
      { version: '1.21.4', releaseType: 'release', javaVersion: 'Java 21' },
      { version: '1.21.3', releaseType: 'release', javaVersion: 'Java 21' },
      { version: '1.21.1', releaseType: 'lts', javaVersion: 'Java 21' },
      { version: '1.20.4', releaseType: 'lts', javaVersion: 'Java 17' },
      { version: '1.20.1', releaseType: 'lts', javaVersion: 'Java 17' },
      { version: '1.19.4', releaseType: 'lts', javaVersion: 'Java 17' },
      { version: '1.18.2', releaseType: 'lts', javaVersion: 'Java 17' },
      { version: '1.16.5', releaseType: 'lts', javaVersion: 'Java 8' },
      { version: '1.12.2', releaseType: 'lts', javaVersion: 'Java 8' },
      { version: '1.8.8', releaseType: 'lts', javaVersion: 'Java 8' },
    ];
  }

  private getFallbackPurpur(): VersionItem[] {
    return [
      { version: '1.21.4', releaseType: 'release', javaVersion: 'Java 21' },
      { version: '1.21.1', releaseType: 'lts', javaVersion: 'Java 21' },
      { version: '1.20.4', releaseType: 'lts', javaVersion: 'Java 17' },
      { version: '1.20.1', releaseType: 'lts', javaVersion: 'Java 17' },
      { version: '1.19.4', releaseType: 'lts', javaVersion: 'Java 17' },
      { version: '1.18.2', releaseType: 'lts', javaVersion: 'Java 17' },
      { version: '1.16.5', releaseType: 'lts', javaVersion: 'Java 8' },
    ];
  }

  private getFallbackFabric(): VersionItem[] {
    return [
      { version: '1.21.4', releaseType: 'release', javaVersion: 'Java 21' },
      { version: '1.21.1', releaseType: 'lts', javaVersion: 'Java 21' },
      { version: '1.20.4', releaseType: 'lts', javaVersion: 'Java 17' },
      { version: '1.20.1', releaseType: 'lts', javaVersion: 'Java 17' },
      { version: '1.19.4', releaseType: 'lts', javaVersion: 'Java 17' },
    ];
  }

  private getFallbackVanilla(): VersionItem[] {
    return [
      { version: '1.21.4', releaseType: 'release', javaVersion: 'Java 21' },
      { version: '1.21.1', releaseType: 'lts', javaVersion: 'Java 21' },
      { version: '1.20.4', releaseType: 'lts', javaVersion: 'Java 17' },
      { version: '1.20.1', releaseType: 'release', javaVersion: 'Java 17' },
      { version: '1.19.4', releaseType: 'release', javaVersion: 'Java 17' },
      { version: '1.18.2', releaseType: 'release', javaVersion: 'Java 17' },
      { version: '1.16.5', releaseType: 'lts', javaVersion: 'Java 8' },
      { version: '1.12.2', releaseType: 'lts', javaVersion: 'Java 8' },
      { version: '1.8.8', releaseType: 'lts', javaVersion: 'Java 8' },
    ];
  }
}
