import { z } from 'zod';

export const NodeSchema = z.object({
  id: z.number().int().positive(),
  uuid: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  locationId: z.number().int().positive(),
  fqdn: z.string(),
  scheme: z.enum(['https', 'http']),
  behindProxy: z.boolean(),
  maintenanceMode: z.boolean(),
  memory: z.number().int().positive(),         // MiB total
  memoryOverallocate: z.number().int().min(-1), // percentage, -1 = disable check
  disk: z.number().int().positive(),            // MiB total
  diskOverallocate: z.number().int().min(-1),   // percentage, -1 = disable check
  uploadSize: z.number().int().positive(),      // MiB
  daemonPort: z.number().int().min(1).max(65535).default(8080),
  daemonSftpPort: z.number().int().min(1).max(65535).default(2022),
  daemonBase: z.string().default('/var/lib/pterodactyl'),
  daemonSftpAlias: z.string().optional(),
  isConnected: z.boolean(),
  lastCheckedAt: z.string().datetime().nullable(),
  daemonVersion: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Node = z.infer<typeof NodeSchema>;

export const CreateNodeSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).default(''),
  locationId: z.number().int().positive(),
  fqdn: z.string().min(1).max(255),
  scheme: z.enum(['https', 'http']).default('https'),
  behindProxy: z.boolean().default(false),
  memory: z.number().int().positive(),
  memoryOverallocate: z.number().int().min(-1).default(0),
  disk: z.number().int().positive(),
  diskOverallocate: z.number().int().min(-1).default(0),
  uploadSize: z.number().int().positive().default(100),
  daemonPort: z.number().int().min(1).max(65535).default(8080),
  daemonSftpPort: z.number().int().min(1).max(65535).default(2022),
  daemonBase: z.string().default('/var/lib/pterodactyl'),
});

export type CreateNodeInput = z.infer<typeof CreateNodeSchema>;

export const UpdateNodeSchema = CreateNodeSchema.partial();
export type UpdateNodeInput = z.infer<typeof UpdateNodeSchema>;

export const NodeConfigurationSchema = z.object({
  debug: z.boolean(),
  uuid: z.string().uuid(),
  token_id: z.string(),
  token: z.string(),
  api: z.object({
    host: z.string(),
    port: z.number(),
    ssl: z.object({
      enabled: z.boolean(),
      cert: z.string(),
      key: z.string(),
    }),
    upload_limit: z.number(),
    trusted_proxies: z.array(z.string()),
  }),
  system: z.object({
    data: z.string(),
    archive_directory: z.string(),
    backup_directory: z.string(),
    username: z.string(),
    timezone: z.string(),
    sftp: z.object({
      bind_port: z.number(),
    }),
    disk_check_interval: z.number(),
  }),
  docker: z.object({}),
  remote: z.string().url(),
});

export type NodeConfiguration = z.infer<typeof NodeConfigurationSchema>;

export const NodeSystemInfoSchema = z.object({
  architecture: z.string(),
  cpuCount: z.number(),
  kernelVersion: z.string(),
  os: z.string(),
  version: z.string(),
  docker: z.object({
    version: z.string(),
    cgroups: z.object({
      driver: z.string(),
      version: z.string(),
    }),
  }),
});

export type NodeSystemInfo = z.infer<typeof NodeSystemInfoSchema>;
