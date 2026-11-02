/**
 * Wings Protocol Schemas
 *
 * These schemas exactly match the data structures that unmodified upstream
 * Wings v1.11.13 sends and expects to receive from the Panel's Remote API.
 *
 * DO NOT modify these to match internal application models.
 * Transform between internal models and these protocol types at the adapter boundary.
 */
import { z } from 'zod';

// ─── Wings→Panel Authentication ──────────────────────────────────────

export const WingsAuthHeaderSchema = z.string().regex(
  /^Bearer [a-zA-Z0-9]+\.[a-zA-Z0-9]+$/,
  'Authorization header must be: Bearer <token_id>.<token>'
);

// ─── Server Configuration (Panel→Wings via Remote API) ──────────────

export const WingsServerBuildSchema = z.object({
  memory_limit: z.number().int(),
  swap: z.number().int(),
  io_weight: z.number().int(),
  cpu_limit: z.number().int(),
  threads: z.string().nullable(),
  disk_space: z.number().int(),
  oom_disabled: z.boolean(),
});

export const WingsAllocationSchema = z.object({
  default: z.object({
    ip: z.string(),
    port: z.number().int(),
  }),
  mappings: z.record(z.array(z.number())),
  force_outgoing_ip: z.boolean(),
});

export const WingsMountSchema = z.object({
  source: z.string(),
  target: z.string(),
  read_only: z.boolean(),
});

export const WingsEggSchema = z.object({
  id: z.string(),
  file_denylist: z.array(z.string()),
});

export const WingsServerSettingsSchema = z.object({
  uuid: z.string(),
  meta: z.object({
    name: z.string(),
    description: z.string(),
  }),
  suspended: z.boolean(),
  environment: z.record(z.string()),
  invocation: z.string(),
  skip_egg_scripts: z.boolean(),
  build: WingsServerBuildSchema,
  container: z.object({
    image: z.string(),
    oom_disabled: z.boolean(),
    requires_rebuild: z.boolean(),
  }),
  allocations: WingsAllocationSchema,
  mounts: z.array(WingsMountSchema),
  egg: WingsEggSchema,
});

export type WingsServerSettings = z.infer<typeof WingsServerSettingsSchema>;

// ─── Process Configuration ───────────────────────────────────────────

export const WingsProcessConfigSchema = z.object({
  startup: z.object({
    done: z.array(z.string()),
    user_interaction: z.array(z.string()),
    strip_ansi: z.boolean(),
  }),
  stop: z.object({
    type: z.enum(['command', 'signal', 'stop']),
    value: z.string(),
  }),
  configs: z.array(z.object({
    parser: z.enum(['file', 'yaml', 'properties', 'json', 'xml', 'ini']),
    file: z.string(),
    replace: z.array(z.object({
      match: z.string(),
      replace_with: z.string(),
    })),
  })),
});

export type WingsProcessConfig = z.infer<typeof WingsProcessConfigSchema>;

// ─── Server Configuration Response ───────────────────────────────────

export const WingsServerConfigResponseSchema = z.object({
  settings: WingsServerSettingsSchema,
  process_configuration: WingsProcessConfigSchema,
});

export type WingsServerConfigResponse = z.infer<typeof WingsServerConfigResponseSchema>;
export type WingsServerConfiguration = WingsServerConfigResponse;

// ─── Raw Server Data (list endpoint) ─────────────────────────────────

export const WingsRawServerDataSchema = z.object({
  uuid: z.string(),
  settings: WingsServerSettingsSchema,
  process_configuration: WingsProcessConfigSchema,
});

export type WingsRawServerData = z.infer<typeof WingsRawServerDataSchema>;

// ─── Wings Pagination ────────────────────────────────────────────────

export const WingsPaginationSchema = z.object({
  current_page: z.number(),
  from: z.number().nullable(),
  last_page: z.number(),
  per_page: z.number(),
  to: z.number().nullable(),
  total: z.number(),
});

// ─── Installation Script ─────────────────────────────────────────────

export const WingsInstallScriptSchema = z.object({
  container_image: z.string(),
  entrypoint: z.string(),
  script: z.string(),
});

export type WingsInstallScript = z.infer<typeof WingsInstallScriptSchema>;

// ─── Install Status Callback ─────────────────────────────────────────

export const WingsInstallStatusSchema = z.object({
  successful: z.boolean(),
  reinstall: z.boolean().default(false),
});

export type WingsInstallStatus = z.infer<typeof WingsInstallStatusSchema>;

// ─── SFTP Authentication ─────────────────────────────────────────────

export const WingsSftpAuthRequestSchema = z.object({
  type: z.enum(['password', 'public_key']),
  username: z.string(),
  password: z.string(),
  ip: z.string(),
  session_id: z.string().optional(),
});

export type WingsSftpAuthRequest = z.infer<typeof WingsSftpAuthRequestSchema>;

export const WingsSftpAuthResponseSchema = z.object({
  server: z.string(),      // server UUID
  permissions: z.array(z.string()),
});

export type WingsSftpAuthResponse = z.infer<typeof WingsSftpAuthResponseSchema>;

// ─── Backup ──────────────────────────────────────────────────────────

export const WingsBackupStatusSchema = z.object({
  successful: z.boolean(),
  checksum: z.string().optional(),
  checksum_type: z.string().optional(),
  size: z.number().optional(),
});

export type WingsBackupStatus = z.infer<typeof WingsBackupStatusSchema>;

export const WingsBackupRemoteUploadSchema = z.object({
  parts: z.array(z.string()),
  part_size: z.number(),
  upload_id: z.string(),
  complete_multipart_upload: z.string(),
  abort_multipart_upload: z.string(),
});

export type WingsBackupRemoteUpload = z.infer<typeof WingsBackupRemoteUploadSchema>;

// ─── Transfer ────────────────────────────────────────────────────────

export const WingsTransferStatusSchema = z.object({
  successful: z.boolean(),
});

export type WingsTransferStatus = z.infer<typeof WingsTransferStatusSchema>;

// ─── Activity Logs ───────────────────────────────────────────────────

export const WingsActivityLogSchema = z.object({
  user: z.string(),
  server: z.string(),
  event: z.string(),
  metadata: z.record(z.unknown()),
  ip: z.string(),
  timestamp: z.string(),
});

export type WingsActivityLog = z.infer<typeof WingsActivityLogSchema>;

// ─── WebSocket JWT Claims ────────────────────────────────────────────

export const WingsWebSocketJwtClaimsSchema = z.object({
  iss: z.string(),           // panel URL
  aud: z.array(z.string()),  // [node_fqdn:port]
  jti: z.string(),           // unique ID
  iat: z.number(),           // issued at
  nbf: z.number(),           // not before
  exp: z.number(),           // expiration (~10 min)
  server_uuid: z.string(),
  permissions: z.array(z.string()),
  user_uuid: z.string(),
  user_id: z.number(),
  unique_id: z.string(),
});

export type WingsWebSocketJwtClaims = z.infer<typeof WingsWebSocketJwtClaimsSchema>;

// ─── Wings System Info Response ──────────────────────────────────────

export const WingsSystemInfoSchema = z.object({
  architecture: z.string(),
  cpu_count: z.number(),
  kernel_version: z.string(),
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

export type WingsSystemInfo = z.infer<typeof WingsSystemInfoSchema>;

// ─── Power Action (Panel→Wings) ──────────────────────────────────────

export const WingsPowerActionSchema = z.object({
  action: z.enum(['start', 'stop', 'restart', 'kill']),
});

export type WingsPowerAction = z.infer<typeof WingsPowerActionSchema>;

// ─── Console Command (Panel→Wings) ───────────────────────────────────

export const WingsConsoleCommandSchema = z.object({
  command: z.string(),
});

export type WingsConsoleCommand = z.infer<typeof WingsConsoleCommandSchema>;
