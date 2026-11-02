import { z } from 'zod';

export const ServerStatusEnum = z.enum([
  'installing',
  'install_failed',
  'suspended',
  'restoring',
  'transferring',
  'offline',
  'starting',
  'running',
  'stopping',
  'unknown',
]);

export type ServerStatus = z.infer<typeof ServerStatusEnum>;

export const ServerSchema = z.object({
  id: z.number().int().positive(),
  uuid: z.string().uuid(),
  uuidShort: z.string(),
  externalId: z.string().nullable(),
  name: z.string(),
  description: z.string(),
  status: ServerStatusEnum,
  isSuspended: z.boolean(),
  isInstalling: z.boolean(),
  isTransferring: z.boolean(),
  limits: z.object({
    memory: z.number().int(),      // MiB
    swap: z.number().int(),        // MiB, -1 = unlimited, 0 = disabled
    disk: z.number().int(),        // MiB, 0 = unlimited
    io: z.number().int(),          // 10-1000
    cpu: z.number().int(),         // percentage, 0 = unlimited
    threads: z.string().nullable(),
    oomDisabled: z.boolean(),
  }),
  featureLimits: z.object({
    databases: z.number().int(),
    allocations: z.number().int(),
    backups: z.number().int(),
  }),
  userId: z.number().int().positive(),
  nodeId: z.number().int().positive(),
  allocationId: z.number().int().positive(),
  nestId: z.number().int().positive(),
  eggId: z.number().int().positive(),
  dockerImage: z.string(),
  startup: z.string(),
  environment: z.record(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Server = z.infer<typeof ServerSchema>;

export const CreateServerSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).default(''),
  userId: z.number().int().positive(),
  nodeId: z.number().int().positive(),
  allocationId: z.number().int().positive(),
  nestId: z.number().int().positive(),
  eggId: z.number().int().positive(),
  dockerImage: z.string().min(1).max(500),
  startup: z.string().min(1).max(2000),
  environment: z.record(z.string()),
  limits: z.object({
    memory: z.number().int().min(0),
    swap: z.number().int().min(-1),
    disk: z.number().int().min(0),
    io: z.number().int().min(10).max(1000).default(500),
    cpu: z.number().int().min(0),
    threads: z.string().nullable().default(null),
    oomDisabled: z.boolean().default(false),
  }),
  featureLimits: z.object({
    databases: z.number().int().min(0).default(0),
    allocations: z.number().int().min(0).default(0),
    backups: z.number().int().min(0).default(0),
  }),
  externalId: z.string().max(255).nullable().default(null),
  skipScripts: z.boolean().default(false),
  startOnCompletion: z.boolean().default(true),
});

export type CreateServerInput = z.infer<typeof CreateServerSchema>;

export const UpdateServerBuildSchema = z.object({
  allocationId: z.number().int().positive().optional(),
  limits: z.object({
    memory: z.number().int().min(0),
    swap: z.number().int().min(-1),
    disk: z.number().int().min(0),
    io: z.number().int().min(10).max(1000),
    cpu: z.number().int().min(0),
    threads: z.string().nullable(),
    oomDisabled: z.boolean(),
  }).optional(),
  featureLimits: z.object({
    databases: z.number().int().min(0),
    allocations: z.number().int().min(0),
    backups: z.number().int().min(0),
  }).optional(),
  addAllocations: z.array(z.number().int().positive()).optional(),
  removeAllocations: z.array(z.number().int().positive()).optional(),
});

export type UpdateServerBuildInput = z.infer<typeof UpdateServerBuildSchema>;

export const UpdateServerDetailsSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  externalId: z.string().max(255).nullable().optional(),
});

export type UpdateServerDetailsInput = z.infer<typeof UpdateServerDetailsSchema>;

export const UpdateServerStartupSchema = z.object({
  startup: z.string().min(1).max(2000).optional(),
  environment: z.record(z.string()).optional(),
  dockerImage: z.string().min(1).max(500).optional(),
  eggId: z.number().int().positive().optional(),
  skipScripts: z.boolean().optional(),
});

export type UpdateServerStartupInput = z.infer<typeof UpdateServerStartupSchema>;

export const PowerActionSchema = z.enum(['start', 'stop', 'restart', 'kill']);
export type PowerAction = z.infer<typeof PowerActionSchema>;

export const ServerResourcesSchema = z.object({
  memoryBytes: z.number(),
  memoryLimitBytes: z.number(),
  cpuAbsolute: z.number(),
  diskBytes: z.number(),
  networkRxBytes: z.number(),
  networkTxBytes: z.number(),
  uptime: z.number(),
  state: ServerStatusEnum,
});

export type ServerResources = z.infer<typeof ServerResourcesSchema>;

export const ServerConsoleCommandSchema = z.object({
  command: z.string().min(1).max(1000),
});

export type ServerConsoleCommandInput = z.infer<typeof ServerConsoleCommandSchema>;
