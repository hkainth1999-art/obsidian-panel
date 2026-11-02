import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WingsClient } from '@obsidian/wings-adapter';
import * as path from 'path';

export interface PluginItem {
  id: string;
  pluginId: string;
  source: 'spigot' | 'modrinth';
  name: string;
  tagline: string;
  description?: string;
  author: string;
  downloads: number;
  rating: number;
  iconUrl: string | null;
  testedVersions: string[];
  sourceUrl: string;
  premium: boolean;
}

export interface PluginVersionOption {
  id: string;
  name: string;
  versionNumber: string;
  gameVersions: string[];
  loaders: string[];
  downloadUrl: string;
  fileName: string;
  size: number;
  releaseDate: string;
}

export interface InstalledPlugin {
  name: string;
  size: number;
  modified: string;
  isEnabled: boolean;
}

@Injectable()
export class PluginsService {
  private readonly logger = new Logger(PluginsService.name);
  private readonly userAgent = 'ObsidianPanel/1.0 (support@obsidianpanel.com)';

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
   * Fetch specific release versions for a plugin (showing Minecraft versions it was built for).
   */
  async getPluginVersions(
    serverUuid: string,
    source: 'spigot' | 'modrinth',
    pluginId: string,
  ): Promise<PluginVersionOption[]> {
    const headers = { 'User-Agent': this.userAgent, Accept: 'application/json' };

    if (source === 'modrinth') {
      try {
        const res = await fetch(`https://api.modrinth.com/v2/project/${pluginId}/version`, { headers });
        if (!res.ok) return [];
        const versions = await res.json();
        if (!Array.isArray(versions)) return [];

        return versions
          .map((v: any) => {
            const primaryFile = v.files?.find((f: any) => f.primary) || v.files?.[0];
            return {
              id: v.id,
              name: v.name || `Release ${v.version_number}`,
              versionNumber: v.version_number,
              gameVersions: Array.isArray(v.game_versions) ? v.game_versions : [],
              loaders: Array.isArray(v.loaders) ? v.loaders : [],
              downloadUrl: primaryFile?.url || '',
              fileName: primaryFile?.filename || `${v.version_number}.jar`,
              size: primaryFile?.size || 0,
              releaseDate: v.date_published || '',
            };
          })
          .filter((v) => Boolean(v.downloadUrl));
      } catch (err: any) {
        this.logger.warn(`Failed to fetch Modrinth versions: ${err.message}`);
        return [];
      }
    }

    if (source === 'spigot') {
      try {
        const res = await fetch(`https://api.spiget.org/v2/resources/${pluginId}/versions?size=25&sort=-releaseDate`, {
          headers,
        });
        if (!res.ok) return [];
        const versions = await res.json();
        if (!Array.isArray(versions)) return [];

        return versions.map((v: any) => ({
          id: String(v.id),
          name: `Version ${v.name}`,
          versionNumber: v.name,
          gameVersions: [],
          loaders: ['spigot', 'paper', 'bukkit'],
          downloadUrl: `https://api.spiget.org/v2/resources/${pluginId}/download`,
          fileName: `spigot-${pluginId}-${v.name}.jar`,
          size: 0,
          releaseDate: v.releaseDate ? new Date(v.releaseDate * 1000).toISOString() : '',
        }));
      } catch (err: any) {
        this.logger.warn(`Failed to fetch Spigot versions: ${err.message}`);
        return [];
      }
    }

    return [];
  }

  /**
   * Search and list plugins from SpigotMC (Spiget API) and Modrinth API.
   */
  async searchPlugins(
    query: string = '',
    source: 'all' | 'spigot' | 'modrinth' = 'all',
    page: number = 1,
  ): Promise<{ plugins: PluginItem[]; page: number; total: number; hasMore: boolean }> {
    const q = query.trim();
    const headers = { 'User-Agent': this.userAgent, Accept: 'application/json' };
    const limit = 24;

    const results: PluginItem[] = [];
    let spigotTotal = 0;
    let modrinthTotal = 0;

    // 1. SpigotMC via Spiget API
    if (source === 'all' || source === 'spigot') {
      try {
        const spigotSize = source === 'all' ? 14 : limit;
        const spigotUrl = q
          ? `https://api.spiget.org/v2/search/resources/${encodeURIComponent(q)}?size=${spigotSize}&page=${page}&sort=-downloads`
          : `https://api.spiget.org/v2/resources?size=${spigotSize}&page=${page}&sort=-downloads`;

        const spigotRes = await fetch(spigotUrl, { headers });
        if (spigotRes.ok) {
          const spigotData = await spigotRes.json();
          if (Array.isArray(spigotData)) {
            spigotTotal = spigotData.length * 10;
            for (const item of spigotData) {
              results.push({
                id: `spigot:${item.id}`,
                pluginId: String(item.id),
                source: 'spigot',
                name: item.name || 'Unnamed Spigot Plugin',
                tagline: item.tag || '',
                author: item.author?.id ? `Author #${item.author.id}` : 'SpigotMC Author',
                downloads: item.downloads || 0,
                rating: item.rating?.average ? Number(item.rating.average.toFixed(1)) : 5.0,
                iconUrl: item.icon?.data
                  ? `data:image/png;base64,${item.icon.data}`
                  : item.icon?.url || null,
                testedVersions: Array.isArray(item.testedVersions) ? item.testedVersions : [],
                sourceUrl: `https://www.spigotmc.org/resources/${item.id}/`,
                premium: Boolean(item.premium),
              });
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Spiget search failed: ${err.message}`);
      }
    }

    // 2. Modrinth API v2
    if (source === 'all' || source === 'modrinth') {
      try {
        const modrinthLimit = source === 'all' ? 14 : limit;
        const offset = (page - 1) * modrinthLimit;
        const modrinthUrl = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(
          q,
        )}&facets=[[%22project_type:plugin%22]]&index=downloads&limit=${modrinthLimit}&offset=${offset}`;

        const modRes = await fetch(modrinthUrl, { headers });
        if (modRes.ok) {
          const modData: any = await modRes.json();
          if (modData?.hits && Array.isArray(modData.hits)) {
            modrinthTotal = modData.total_hits || modData.hits.length;
            for (const item of modData.hits) {
              // Extract clean Minecraft versions
              let parsedVersions: string[] = [];
              if (Array.isArray(item.versions)) {
                parsedVersions = item.versions.filter((v: string) => /^\d+\.\d+/.test(v));
              } else if (typeof item.versions === 'string') {
                parsedVersions = item.versions.split(' ').filter((v: string) => /^\d+\.\d+/.test(v));
              }

              results.push({
                id: `modrinth:${item.project_id}`,
                pluginId: item.project_id,
                source: 'modrinth',
                name: item.title || 'Unnamed Modrinth Plugin',
                tagline: item.description || '',
                author: item.author || 'Modrinth Creator',
                downloads: item.downloads || 0,
                rating: item.follows ? Math.min(5, Math.round((item.follows / 50) * 10) / 10 + 3.5) : 4.8,
                iconUrl: item.icon_url || null,
                testedVersions: parsedVersions.slice(0, 8),
                sourceUrl: `https://modrinth.com/plugin/${item.slug || item.project_id}`,
                premium: false,
              });
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Modrinth search failed: ${err.message}`);
      }
    }

    // Sort combined results by popularity/downloads
    if (source === 'all') {
      results.sort((a, b) => b.downloads - a.downloads);
    }

    return {
      plugins: results,
      page,
      total: spigotTotal + modrinthTotal,
      hasMore: results.length >= (source === 'all' ? 20 : limit),
    };
  }

  /**
   * List all currently installed plugins in /plugins folder on the server.
   */
  async getInstalledPlugins(serverUuid: string): Promise<InstalledPlugin[]> {
    const server = await this.prisma.server.findUnique({
      where: { uuid: serverUuid },
      include: { node: true },
    });
    if (!server) throw new NotFoundException('Server not found');

    const client = this.getWingsClient(server.node);

    try {
      const files = await client.listFiles(server.uuid, '/plugins');
      if (!Array.isArray(files)) return [];

      return files
        .filter((f) => f.name.endsWith('.jar') || f.name.endsWith('.jar.disabled'))
        .map((f) => ({
          name: f.name,
          size: f.size,
          modified: f.modified,
          isEnabled: !f.name.endsWith('.disabled'),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (err: any) {
      // /plugins directory may not exist yet if server was freshly created
      return [];
    }
  }

  /**
   * Install a plugin directly into /plugins on the server with target version / Minecraft version support.
   */
  async installPlugin(
    serverUuid: string,
    dto: {
      source: 'spigot' | 'modrinth';
      pluginId: string;
      versionId?: string;
      mcVersion?: string;
      fileName?: string;
    },
  ): Promise<{ success: boolean; fileName: string; message: string }> {
    const server = await this.prisma.server.findUnique({
      where: { uuid: serverUuid },
      include: { node: true },
    });
    if (!server) throw new NotFoundException('Server not found');

    const client = this.getWingsClient(server.node);

    // Ensure /plugins folder exists
    try {
      await client.createFolder(server.uuid, '/', 'plugins');
    } catch {
      // Ignore if folder already exists
    }

    let downloadUrl = '';
    let resolvedFileName = dto.fileName?.trim() || '';

    if (dto.source === 'spigot') {
      // Get Spiget details for safe clean name
      try {
        const infoRes = await fetch(`https://api.spiget.org/v2/resources/${dto.pluginId}`, {
          headers: { 'User-Agent': this.userAgent },
        });
        if (infoRes.ok) {
          const info: any = await infoRes.json();
          if (!resolvedFileName && info.name) {
            resolvedFileName = `${info.name.replace(/[^a-zA-Z0-9_\-\.]/g, '_')}.jar`;
          }
        }
      } catch (err) {
        this.logger.warn(`Spiget info fetch fallback: ${err}`);
      }

      if (!resolvedFileName) {
        resolvedFileName = `spigot-${dto.pluginId}.jar`;
      }
      downloadUrl = `https://api.spiget.org/v2/resources/${dto.pluginId}/download`;
    } else if (dto.source === 'modrinth') {
      // Fetch versions list from Modrinth to find best compatible build
      const verRes = await fetch(
        `https://api.modrinth.com/v2/project/${dto.pluginId}/version`,
        { headers: { 'User-Agent': this.userAgent } },
      );
      if (!verRes.ok) {
        throw new BadRequestException('Failed to find compatible version on Modrinth');
      }
      const versions = await verRes.json();
      if (!Array.isArray(versions) || versions.length === 0) {
        throw new BadRequestException('No downloadable JAR file found for this Modrinth plugin');
      }

      let matchedVersion: any = null;

      // 1. If explicit versionId requested
      if (dto.versionId) {
        matchedVersion = versions.find((v: any) => v.id === dto.versionId);
      }

      // 2. If target Minecraft version requested (e.g. 1.21.8)
      if (!matchedVersion && dto.mcVersion) {
        const cleanMc = dto.mcVersion.trim();
        // Exact match
        matchedVersion = versions.find((v: any) => v.game_versions?.includes(cleanMc));

        // Major.minor match (e.g. 1.21.8 matches 1.21.x)
        if (!matchedVersion && cleanMc.includes('.')) {
          const majorMinor = cleanMc.split('.').slice(0, 2).join('.');
          matchedVersion = versions.find((v: any) =>
            v.game_versions?.some((gv: string) => gv.startsWith(majorMinor)),
          );
        }
      }

      // 3. Fallback to latest version with a valid JAR file
      if (!matchedVersion) {
        matchedVersion = versions.find((v: any) => v.files?.[0]?.url) || versions[0];
      }

      const fileObj = matchedVersion?.files?.find((f: any) => f.primary) || matchedVersion?.files?.[0];
      if (!fileObj?.url) {
        throw new BadRequestException('Could not resolve download file for selected version');
      }

      downloadUrl = fileObj.url;
      resolvedFileName = fileObj.filename || `${dto.pluginId}.jar`;
    }

    if (!resolvedFileName.endsWith('.jar')) {
      resolvedFileName += '.jar';
    }

    this.logger.log(
      `Installing ${dto.source} plugin ${dto.pluginId} -> /plugins/${resolvedFileName} for server ${server.uuid}`,
    );

    // Download the binary buffer and write directly to Wings filesystem to guarantee reliability
    try {
      const resp = await fetch(downloadUrl, {
        headers: { 'User-Agent': this.userAgent },
      });
      if (!resp.ok) {
        throw new Error(`Download endpoint returned HTTP ${resp.status}`);
      }
      const arrayBuffer = await resp.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      await client.writeFile(server.uuid, `/plugins/${resolvedFileName}`, buffer);

      return {
        success: true,
        fileName: resolvedFileName,
        message: `Successfully installed "${resolvedFileName}" into /plugins directory!`,
      };
    } catch (dlErr: any) {
      // Try Wings pullFile as fallback
      try {
        await client.pullFile(server.uuid, downloadUrl, '/plugins', resolvedFileName, true);
        return {
          success: true,
          fileName: resolvedFileName,
          message: `Successfully pulled "${resolvedFileName}" into /plugins directory!`,
        };
      } catch (pullErr: any) {
        throw new BadRequestException(`Failed to download plugin: ${dlErr.message}`);
      }
    }
  }

  /**
   * Uninstall (delete) a plugin from /plugins.
   */
  async uninstallPlugin(
    serverUuid: string,
    fileName: string,
  ): Promise<{ success: boolean; message: string }> {
    const server = await this.prisma.server.findUnique({
      where: { uuid: serverUuid },
      include: { node: true },
    });
    if (!server) throw new NotFoundException('Server not found');

    const client = this.getWingsClient(server.node);
    const cleanFileName = path.basename(fileName);

    await client.deleteFiles(server.uuid, '/plugins', [cleanFileName]);

    return {
      success: true,
      message: `Plugin "${cleanFileName}" uninstalled successfully.`,
    };
  }

  /**
   * Toggle plugin (enable/disable by renaming .jar <-> .jar.disabled).
   */
  async togglePlugin(
    serverUuid: string,
    fileName: string,
  ): Promise<{ success: boolean; fileName: string; isEnabled: boolean }> {
    const server = await this.prisma.server.findUnique({
      where: { uuid: serverUuid },
      include: { node: true },
    });
    if (!server) throw new NotFoundException('Server not found');

    const client = this.getWingsClient(server.node);
    const cleanName = path.basename(fileName);

    let newName: string;
    let isEnabled: boolean;

    if (cleanName.endsWith('.disabled')) {
      newName = cleanName.replace(/\.disabled$/, '');
      isEnabled = true;
    } else {
      newName = `${cleanName}.disabled`;
      isEnabled = false;
    }

    await client.renameFiles(server.uuid, '/plugins', [{ from: cleanName, to: newName }]);

    return {
      success: true,
      fileName: newName,
      isEnabled,
    };
  }
}
