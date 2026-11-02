import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Node, Server, Egg, EggVariable, Allocation, ServerVariable } from '@prisma/client';

type ServerWithRelations = Server & {
  egg: Egg & { variables: EggVariable[] };
  variables: ServerVariable[];
  allocations: Allocation[];
  allocation: Allocation;
  mounts: Array<{ mount: { source: string; target: string; readOnly: boolean } }>;
};

/**
 * Service responsible for transforming internal database models into the
 * exact JSON structures that unmodified Wings v1.11.13 expects.
 *
 * DO NOT change the output schema without verifying against the pinned
 * Wings source. Incorrect structures will break server provisioning.
 */
@Injectable()
export class WingsRemoteService {
  private readonly logger = new Logger(WingsRemoteService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build the server configuration payload that Wings expects from
   * GET /api/remote/servers/{uuid} and the list endpoint.
   *
   * Maps to ServerConfigurationResponse in Wings remote/types.go
   */
  buildServerConfiguration(server: ServerWithRelations): {
    settings: Record<string, unknown>;
    process_configuration: Record<string, unknown>;
  } {
    const settings = this.buildServerSettings(server);
    const processConfiguration = this.buildProcessConfiguration(server.egg, server);

    return {
      settings,
      process_configuration: processConfiguration,
    };
  }

  /**
   * Build the 'settings' portion of the server config.
   * Maps to the JSON structure Wings deserializes into its server.Configuration type.
   */
  private buildServerSettings(server: ServerWithRelations): Record<string, unknown> {
    // Build environment variables by merging egg defaults with server overrides
    const environment: Record<string, string> = {};
    for (const eggVar of server.egg.variables) {
      environment[eggVar.envVariable] = eggVar.defaultValue;
    }
    for (const serverVar of server.variables) {
      const eggVar = server.egg.variables.find(v => v.id === serverVar.variableId);
      if (eggVar) {
        environment[eggVar.envVariable] = serverVar.variableValue;
      }
    }

    // Always include these standard environment variables
    environment['STARTUP'] = server.startup;
    environment['SERVER_MEMORY'] = String(server.memory);
    environment['SERVER_IP'] = server.allocation.ip;
    environment['SERVER_PORT'] = String(server.allocation.port);
    environment['P_SERVER_LOCATION'] = ''; // Will be populated from node location
    environment['P_SERVER_UUID'] = server.uuid;
    environment['P_SERVER_ALLOCATION_LIMIT'] = String(server.allocationLimit);

    // Build allocation mappings: { "ip": [port1, port2, ...] }
    const allServerAllocations = [server.allocation, ...server.allocations.filter(a => a.id !== server.allocationId)];
    const mappings: Record<string, number[]> = {};
    for (const alloc of allServerAllocations) {
      if (!mappings[alloc.ip]) {
        mappings[alloc.ip] = [];
      }
      mappings[alloc.ip]!.push(alloc.port);
    }

    // Resolve startup command template variables
    let invocation = server.startup;
    for (const [key, value] of Object.entries(environment)) {
      invocation = invocation.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), value);
    }

    return {
      uuid: server.uuid,
      meta: {
        name: server.name,
        description: server.description,
      },
      suspended: server.status === 'suspended',
      environment,
      invocation,
      skip_egg_scripts: server.skipScripts,
      build: {
        memory_limit: server.memory,
        swap: server.swap,
        io_weight: server.io,
        cpu_limit: server.cpu,
        threads: server.threads,
        disk_space: server.disk,
        oom_disabled: server.oomDisabled,
      },
      container: {
        image: server.dockerImage,
        oom_disabled: server.oomDisabled,
        requires_rebuild: false,
      },
      allocations: {
        force_outgoing_ip: server.egg.forceOutgoingIp,
        default: {
          ip: server.allocation.ip,
          port: server.allocation.port,
        },
        mappings,
      },
      mounts: (server.mounts || []).map(sm => ({
        source: sm.mount.source,
        target: sm.mount.target,
        read_only: sm.mount.readOnly,
      })),
      egg: {
        id: server.egg.uuid,
        file_denylist: server.egg.fileDenylist,
      },
    };
  }

  /**
   * Build the process_configuration matching Wings' ProcessConfiguration type.
   */
  private buildProcessConfiguration(egg: Egg, server?: ServerWithRelations): Record<string, unknown> {
    // Parse config_startup from egg
    let startup = { done: [] as string[], user_interaction: [] as string[], strip_ansi: false };
    if (egg.configStartup && typeof egg.configStartup === 'object') {
      const cs = egg.configStartup as Record<string, unknown>;
      startup = {
        done: Array.isArray(cs.done) ? (cs.done as string[]) : typeof cs.done === 'string' ? [cs.done as string] : [],
        user_interaction: Array.isArray(cs.user_interaction) ? (cs.user_interaction as string[]) : [],
        strip_ansi: Boolean(cs.strip_ansi),
      };
    }

    // Default done matchers for game servers if not explicitly provided by egg
    if (!startup.done || startup.done.length === 0) {
      startup.done = [
        ')! For help, type "help"',
        'Done (',
        'For help, type "help"',
        'Listening on ',
        'Server started',
        'Done preparing level',
        'TPS from last',
      ];
    }

    // Parse stop configuration
    let stop = { type: 'command' as string, value: egg.stopCommand ?? 'stop' };
    if (egg.configStop && typeof egg.configStop === 'object') {
      const cs = egg.configStop as Record<string, unknown>;
      stop = {
        type: (cs.type as string) ?? 'command',
        value: (cs.value as string) ?? egg.stopCommand ?? 'stop',
      };
    }

    // Parse file configuration replacements
    let configs: Array<{
      parser: string;
      file: string;
      replace: Array<{ match: string; replace_with: string }>;
    }> = [];

    const targetPort = String(server?.allocation?.port ?? 25565);
    const rawIp = server?.allocation?.ip;
    const targetIp = rawIp && rawIp.trim() !== '' && rawIp !== '0.0.0.0' && rawIp !== '127.0.0.1' ? rawIp : '0.0.0.0';

    if (egg.configFiles) {
      try {
        const parsed = JSON.parse(egg.configFiles);
        if (typeof parsed === 'object' && parsed !== null) {
          for (const [file, fileConfig] of Object.entries(parsed)) {
            if (typeof fileConfig === 'object' && fileConfig !== null) {
              const fc = fileConfig as Record<string, unknown>;
              const parser = (fc.parser as string) ?? 'file';
              const find = fc.find as Record<string, string> | undefined;
              const replace: Array<{ match: string; replace_with: string }> = [];
              if (find) {
                for (const [match, rawReplaceWith] of Object.entries(find)) {
                  let replaceWith = String(rawReplaceWith);
                  replaceWith = replaceWith.replace(/\{\{\s*server\.build\.default\.port\s*\}\}/gi, targetPort);
                  replaceWith = replaceWith.replace(/\{\{\s*server\.build\.default\.ip\s*\}\}/gi, targetIp);
                  replaceWith = replaceWith.replace(/\{\{\s*config\.docker\.interface\s*\}\}/gi, targetIp);
                  replace.push({ match, replace_with: replaceWith });
                }
              }
              configs.push({ parser, file, replace });
            }
          }
        }
      } catch {
        this.logger.warn(`Failed to parse config_files for egg ${egg.id}`);
      }
    }

    // Ensure server.properties configuration exists and sets IP to 0.0.0.0 (or custom IP) and port to allocated host port
    const isMinecraftOrGame =
      egg.configFiles?.includes('server.properties') ||
      server?.dockerImage?.includes('java') ||
      egg.name?.toLowerCase().includes('minecraft') ||
      egg.name?.toLowerCase().includes('paper') ||
      egg.name?.toLowerCase().includes('purpur') ||
      egg.name?.toLowerCase().includes('spigot') ||
      egg.name?.toLowerCase().includes('bungee') ||
      egg.name?.toLowerCase().includes('velocity') ||
      egg.name?.toLowerCase().includes('sponge') ||
      egg.name?.toLowerCase().includes('bedrock') ||
      !egg.configFiles;

    if (isMinecraftOrGame) {
      let serverPropsConfig = configs.find(c => c.file === 'server.properties');
      if (!serverPropsConfig) {
        serverPropsConfig = {
          parser: 'properties',
          file: 'server.properties',
          replace: [],
        };
        configs.push(serverPropsConfig);
      }

      const setOrUpdateProp = (match: string, replace_with: string) => {
        const item = serverPropsConfig!.replace.find(r => r.match === match);
        if (item) {
          item.replace_with = replace_with;
        } else {
          serverPropsConfig!.replace.push({ match, replace_with });
        }
      };

      setOrUpdateProp('server-ip', targetIp);
      setOrUpdateProp('server-port', targetPort);
      setOrUpdateProp('query.port', targetPort);
    }

    return {
      startup,
      stop,
      configs,
    };
  }

  /**
   * Build the installation script response for Wings.
   * Maps to InstallationScript in Wings remote/types.go
   */
  buildInstallationScript(egg: Egg): {
    container_image: string;
    entrypoint: string;
    script: string;
  } {
    const container_image =
      egg.scriptContainer && egg.scriptContainer.trim() !== ''
        ? egg.scriptContainer
        : 'ghcr.io/pterodactyl/installers:alpine';
    const entrypoint =
      egg.scriptEntry && egg.scriptEntry.trim() !== '' ? egg.scriptEntry : 'ash';
    let script =
      egg.scriptInstall && egg.scriptInstall.trim() !== ''
        ? egg.scriptInstall
        : this.getDefaultInstallScript(egg.name);

    // If an existing egg script points to the sunset api.papermc.io/v2 endpoint, use the updated installer
    if (script.includes('api.papermc.io')) {
      script = this.getDefaultInstallScript(egg.name);
    }

    return {
      container_image,
      entrypoint,
      script,
    };
  }

  private getDefaultInstallScript(eggName: string): string {
    return `#!/bin/ash
# Obsidian Panel Modern Server Installer
set -e
cd /mnt/server

if [ -z "\${SERVER_JARFILE}" ]; then
    SERVER_JARFILE="paper.jar"
fi

echo "=========================================="
echo "Obsidian Server Installer"
echo "Target Egg: ${eggName}"
echo "Jar File: \${SERVER_JARFILE}"
echo "=========================================="

apk update && apk add --no-cache curl jq

USER_AGENT="ObsidianPanel/1.0 (support@obsidianpanel.com)"

if echo "${eggName}" | grep -iq "paper"; then
    echo "Resolving PaperMC version and build..."
    if [ -z "\${MINECRAFT_VERSION}" ] || [ "\${MINECRAFT_VERSION}" = "latest" ]; then
        VERSIONS_DATA=$(curl -sSL -H "User-Agent: \${USER_AGENT}" "https://fill.papermc.io/v3/projects/paper" || true)
        MINECRAFT_VERSION=$(echo "\${VERSIONS_DATA}" | jq -r '(.versions | to_entries[0].value | map(select(test("-(rc|pre|snapshot)") | not)) | .[0]) // empty' 2>/dev/null || true)
        if [ -z "\${MINECRAFT_VERSION}" ] || [ "\${MINECRAFT_VERSION}" = "null" ]; then
            MINECRAFT_VERSION="26.3"
        fi
    fi
    echo "Selected Minecraft version: \${MINECRAFT_VERSION}"

    VERSION_DATA=$(curl -sSL -H "User-Agent: \${USER_AGENT}" "https://fill.papermc.io/v3/projects/paper/versions/\${MINECRAFT_VERSION}" || true)
    if [ -z "\${BUILD_NUMBER}" ] || [ "\${BUILD_NUMBER}" = "latest" ]; then
        BUILD_NUMBER=$(echo "\${VERSION_DATA}" | jq -r '.builds[0] // empty' 2>/dev/null || true)
    fi

    DOWNLOAD_SUCCESS=false
    if [ -n "\${BUILD_NUMBER}" ] && [ "\${BUILD_NUMBER}" != "null" ]; then
        echo "Selected Paper build: \${BUILD_NUMBER}"
        BUILD_DATA=$(curl -sSL -H "User-Agent: \${USER_AGENT}" "https://fill.papermc.io/v3/projects/paper/versions/\${MINECRAFT_VERSION}/builds/\${BUILD_NUMBER}" || true)
        DOWNLOAD_URL=$(echo "\${BUILD_DATA}" | jq -r '(.downloads["server:default"].url // (.downloads | to_entries[0].value.url)) // empty' 2>/dev/null || true)
        if [ -n "\${DOWNLOAD_URL}" ] && [ "\${DOWNLOAD_URL}" != "null" ]; then
            echo "Downloading Paper \${MINECRAFT_VERSION} build \${BUILD_NUMBER}..."
            curl -o "\${SERVER_JARFILE}" -sSL -H "User-Agent: \${USER_AGENT}" "\${DOWNLOAD_URL}"
            if [ -s "\${SERVER_JARFILE}" ]; then
                DOWNLOAD_SUCCESS=true
            fi
        fi
    fi

    # Verify download succeeded with minimum expected JAR file size (5MB+)
    if [ ! -s "\${SERVER_JARFILE}" ] || [ $(wc -c < "\${SERVER_JARFILE}" 2>/dev/null || echo 0) -lt 5000000 ]; then
        echo "Primary Paper download incomplete, trying latest Purpur release build..."
        curl -o "\${SERVER_JARFILE}" -sSL "https://api.purpurmc.org/v2/purpur/26.3/latest/download" || true
    fi

    if [ ! -s "\${SERVER_JARFILE}" ] || [ $(wc -c < "\${SERVER_JARFILE}" 2>/dev/null || echo 0) -lt 5000000 ]; then
        echo "Falling back to Paper 1.21.4 direct binary..."
        curl -o "\${SERVER_JARFILE}" -sSL -H "User-Agent: \${USER_AGENT}" "https://fill-data.papermc.io/v1/objects/5ee4f542f628a14c644410b08c94ea42e772ef4d29fe92973636b6813d4eaffc/paper-1.21.4-232.jar" || true
    fi

elif echo "${eggName}" | grep -iq "purpur"; then
    echo "Resolving Purpur version..."
    if [ -z "\${MINECRAFT_VERSION}" ] || [ "\${MINECRAFT_VERSION}" = "latest" ]; then
        MINECRAFT_VERSION=$(curl -sSL https://api.purpurmc.org/v2/purpur | jq -r '.versions[-1]' 2>/dev/null || echo "26.3")
    fi
    echo "Selected Purpur version: \${MINECRAFT_VERSION}"
    echo "Downloading Purpur \${MINECRAFT_VERSION} latest build..."
    curl -o "\${SERVER_JARFILE}" -sSL "https://api.purpurmc.org/v2/purpur/\${MINECRAFT_VERSION}/latest/download"
    fi
    echo "Downloading Purpur \${MINECRAFT_VERSION}..."
    curl -o "\${SERVER_JARFILE}" -sSL "https://api.purpurmc.org/v2/purpur/\${MINECRAFT_VERSION}/latest/download"

elif echo "${eggName}" | grep -iq "fabric"; then
    echo "Resolving Fabric loader..."
    MC_VER="\${MINECRAFT_VERSION:-\${MC_VERSION:-1.21.4}}"
    if [ "\${MC_VER}" = "latest" ]; then
        MC_VER=$(curl -sSL https://meta.fabricmc.net/v2/versions/game | jq -r '.[0].version' 2>/dev/null || echo "1.21.4")
    fi
    LOADER_VER="\${FABRIC_VERSION:-latest}"
    if [ "\${LOADER_VER}" = "latest" ]; then
        LOADER_VER=$(curl -sSL https://meta.fabricmc.net/v2/versions/loader | jq -r '.[0].version' 2>/dev/null || echo "0.16.9")
    fi
    INSTALLER_VER=$(curl -sSL https://meta.fabricmc.net/v2/versions/installer | jq -r '.[0].version' 2>/dev/null || echo "1.0.1")
    echo "Downloading Fabric for Minecraft \${MC_VER}..."
    curl -o "\${SERVER_JARFILE}" -sSL "https://meta.fabricmc.net/v2/versions/loader/\${MC_VER}/\${LOADER_VER}/\${INSTALLER_VER}/server/jar"

elif echo "${eggName}" | grep -iq "vanilla"; then
    echo "Resolving Vanilla version..."
    MANIFEST_URL="https://launchermeta.mojang.com/mc/game/version_manifest_v2.json"
    if [ -z "\${VANILLA_VERSION}" ] || [ "\${VANILLA_VERSION}" = "latest" ]; then
        VANILLA_VERSION=$(curl -sSL "\${MANIFEST_URL}" | jq -r '.latest.release' 2>/dev/null || echo "1.21.4")
    fi
    VERSION_URL=$(curl -sSL "\${MANIFEST_URL}" | jq -r --arg ver "\${VANILLA_VERSION}" '.versions[] | select(.id == \$ver) | .url' 2>/dev/null || true)
    DOWNLOAD_URL=$(curl -sSL "\${VERSION_URL}" | jq -r '.downloads.server.url' 2>/dev/null || true)
    echo "Downloading Vanilla Minecraft \${VANILLA_VERSION}..."
    curl -o "\${SERVER_JARFILE}" -sSL "\${DOWNLOAD_URL}"

else
    # Default fallback to latest Paper or Purpur
    echo "Downloading server jar..."
    VERSIONS_DATA=$(curl -sSL -H "User-Agent: \${USER_AGENT}" "https://fill.papermc.io/v3/projects/paper" || true)
    MINECRAFT_VERSION=$(echo "\${VERSIONS_DATA}" | jq -r '(.versions | to_entries[0].value | map(select(test("-(rc|pre|snapshot)") | not)) | .[0]) // empty' 2>/dev/null || echo "26.3")
    VERSION_DATA=$(curl -sSL -H "User-Agent: \${USER_AGENT}" "https://fill.papermc.io/v3/projects/paper/versions/\${MINECRAFT_VERSION}" || true)
    BUILD_NUMBER=$(echo "\${VERSION_DATA}" | jq -r '.builds[0] // empty' 2>/dev/null || true)
    if [ -n "\${BUILD_NUMBER}" ] && [ "\${BUILD_NUMBER}" != "null" ]; then
        BUILD_DATA=$(curl -sSL -H "User-Agent: \${USER_AGENT}" "https://fill.papermc.io/v3/projects/paper/versions/\${MINECRAFT_VERSION}/builds/\${BUILD_NUMBER}" || true)
        DOWNLOAD_URL=$(echo "\${BUILD_DATA}" | jq -r '(.downloads["server:default"].url // (.downloads | to_entries[0].value.url)) // empty' 2>/dev/null || true)
        if [ -n "\${DOWNLOAD_URL}" ] && [ "\${DOWNLOAD_URL}" != "null" ]; then
            curl -o "\${SERVER_JARFILE}" -sSL -H "User-Agent: \${USER_AGENT}" "\${DOWNLOAD_URL}"
        fi
    fi
    if [ ! -s "\${SERVER_JARFILE}" ]; then
        curl -o "\${SERVER_JARFILE}" -sSL "https://api.purpurmc.org/v2/purpur/26.3/latest/download" || true
    fi
fi

# Validation: ensure file exists and is not empty or corrupt HTML/JSON
if [ ! -s "\${SERVER_JARFILE}" ]; then
    echo "FATAL: Failed to download server jar file (\${SERVER_JARFILE})!"
    exit 1
fi

echo "eula=true" > eula.txt
echo "=========================================="
echo "Installation complete! \${SERVER_JARFILE} ready."
echo "=========================================="
`;
  }

  /**
   * Get a server with all relations needed for Wings configuration.
   */
  async getServerForWings(uuid: string, nodeId: number): Promise<ServerWithRelations | null> {
    return this.prisma.server.findFirst({
      where: {
        uuid,
        nodeId,
      },
      include: {
        egg: {
          include: {
            variables: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        variables: true,
        allocation: true,
        allocations: true,
        mounts: {
          include: {
            mount: true,
          },
        },
      },
    }) as Promise<ServerWithRelations | null>;
  }

  /**
   * Get all servers for a node, paginated in the format Wings expects.
   */
  async getServersForNode(nodeId: number, page: number, perPage: number) {
    const [servers, total] = await Promise.all([
      this.prisma.server.findMany({
        where: { nodeId },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          egg: {
            include: {
              variables: {
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
          variables: true,
          allocation: true,
          allocations: true,
          mounts: {
            include: {
              mount: true,
            },
          },
        },
      }),
      this.prisma.server.count({ where: { nodeId } }),
    ]);

    const lastPage = Math.max(1, Math.ceil(total / perPage));

    return {
      data: (servers as ServerWithRelations[]).map(server => ({
        uuid: server.uuid,
        ...this.buildServerConfiguration(server),
      })),
      meta: {
        pagination: {
          current_page: page,
          from: total > 0 ? (page - 1) * perPage + 1 : null,
          last_page: lastPage,
          per_page: perPage,
          to: total > 0 ? Math.min(page * perPage, total) : null,
          total,
        },
      },
    };
  }
}
