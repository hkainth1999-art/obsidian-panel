/**
 * Pterodactyl Fractal Transformer Helpers
 * Formats API objects according to official Pterodactyl Application API standards.
 */

export function fractalItem<T = any>(object: string, attributes: T) {
  return {
    object,
    attributes,
  };
}

export function fractalList<T = any>(
  object: string,
  items: T[],
  total?: number,
  page = 1,
  perPage = 50,
) {
  const actualTotal = total ?? items.length;
  const totalPages = Math.max(1, Math.ceil(actualTotal / perPage));

  return {
    object: 'list',
    data: items.map((item) => ({
      object,
      attributes: item,
    })),
    meta: {
      pagination: {
        total: actualTotal,
        count: items.length,
        per_page: perPage,
        current_page: page,
        total_pages: totalPages,
        links: {},
      },
    },
  };
}

export function transformUser(user: any) {
  return {
    id: user.id,
    external_id: user.externalId ?? null,
    uuid: user.uuid,
    username: user.username,
    email: user.email,
    first_name: user.firstName || user.username,
    last_name: user.lastName || '',
    language: user.language || 'en',
    root_admin: Boolean(user.isAdmin),
    '2fa': Boolean(user.totpEnabled),
    created_at: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
    updated_at: user.updatedAt instanceof Date ? user.updatedAt.toISOString() : user.updatedAt,
  };
}

export function transformServer(server: any) {
  return {
    id: server.id,
    external_id: server.externalId ?? null,
    uuid: server.uuid,
    identifier: server.identifier || server.uuid.substring(0, 8),
    name: server.name,
    description: server.description || '',
    status: server.status || null,
    suspended: server.status === 'suspended',
    limits: {
      memory: Number(server.memory) || 0,
      swap: Number(server.swap) || 0,
      disk: Number(server.disk) || 0,
      io: Number(server.io) || 500,
      cpu: Number(server.cpu) || 0,
      threads: server.threads || null,
      oom_disabled: server.oomDisabled ?? true,
    },
    feature_limits: {
      databases: server.databaseLimit ?? 0,
      allocations: server.allocationLimit ?? 1,
      backups: server.backupLimit ?? 0,
    },
    user: server.userId,
    node: server.nodeId,
    allocation: server.allocationId,
    nest: server.nestId,
    egg: server.eggId,
    container: {
      startup_command: server.startup,
      image: server.image,
      installed: server.status !== 'installing',
      environment: server.environment || {},
    },
    created_at: server.createdAt instanceof Date ? server.createdAt.toISOString() : server.createdAt,
    updated_at: server.updatedAt instanceof Date ? server.updatedAt.toISOString() : server.updatedAt,
  };
}

export function transformNode(node: any) {
  return {
    id: node.id,
    uuid: node.uuid,
    public: Boolean(node.public),
    name: node.name,
    description: node.description || '',
    location_id: node.locationId,
    fqdn: node.fqdn,
    scheme: node.scheme,
    behind_proxy: Boolean(node.behindProxy),
    maintenance_mode: Boolean(node.maintenanceMode),
    memory: Number(node.memory),
    memory_overallocate: Number(node.memoryOverallocate || 0),
    disk: Number(node.disk),
    disk_overallocate: Number(node.diskOverallocate || 0),
    upload_size: Number(node.uploadSize || 100),
    daemon_listen: node.daemonPort || 8080,
    daemon_sftp: node.daemonSftp || 2022,
    daemon_base: node.daemonBase || '/var/lib/pterodactyl/volumes',
    created_at: node.createdAt instanceof Date ? node.createdAt.toISOString() : node.createdAt,
    updated_at: node.updatedAt instanceof Date ? node.updatedAt.toISOString() : node.updatedAt,
  };
}

export function transformAllocation(alloc: any) {
  return {
    id: alloc.id,
    ip: alloc.ip,
    alias: alloc.ipAlias ?? null,
    port: alloc.port,
    notes: alloc.notes ?? null,
    assigned: Boolean(alloc.serverId),
  };
}

export function transformLocation(loc: any) {
  return {
    id: loc.id,
    short: loc.short,
    long: loc.long || '',
    created_at: loc.createdAt instanceof Date ? loc.createdAt.toISOString() : loc.createdAt,
    updated_at: loc.updatedAt instanceof Date ? loc.updatedAt.toISOString() : loc.updatedAt,
  };
}

export function transformNest(nest: any) {
  return {
    id: nest.id,
    uuid: nest.uuid,
    author: nest.author || 'support@pterodactyl.io',
    name: nest.name,
    description: nest.description || '',
    created_at: nest.createdAt instanceof Date ? nest.createdAt.toISOString() : nest.createdAt,
    updated_at: nest.updatedAt instanceof Date ? nest.updatedAt.toISOString() : nest.updatedAt,
  };
}

export function transformEgg(egg: any) {
  return {
    id: egg.id,
    uuid: egg.uuid,
    nest: egg.nestId,
    author: egg.author || 'support@pterodactyl.io',
    name: egg.name,
    description: egg.description || '',
    docker_image: egg.dockerImage || (Array.isArray(egg.dockerImages) ? egg.dockerImages[0] : 'ghcr.io/pterodactyl/yolks:java_17'),
    docker_images: egg.dockerImages || {},
    config: {
      files: egg.configFiles || {},
      startup: egg.configStartup || {},
      stop: egg.configStop || 'stop',
      logs: egg.configLogs || {},
    },
    startup: egg.startup,
    created_at: egg.createdAt instanceof Date ? egg.createdAt.toISOString() : egg.createdAt,
    updated_at: egg.updatedAt instanceof Date ? egg.updatedAt.toISOString() : egg.updatedAt,
  };
}

