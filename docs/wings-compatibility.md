# Wings Compatibility Document

## Pinned Upstream Versions

| Component | Version | Commit/Tag | Source |
|-----------|---------|------------|--------|
| Pterodactyl Wings | v1.11.13 | `v1.11.13` | github.com/pterodactyl/wings |
| Pterodactyl Panel (reference) | v1.11.9 | `v1.11.9` | github.com/pterodactyl/panel |

These versions are the **canonical reference** for all protocol contracts.
All routes, headers, payloads, and behaviors are derived from these exact releases.

## Supported Operating Systems (Wings Nodes)

- Ubuntu 20.04 / 22.04 LTS
- Debian 11 / 12
- CentOS Stream 8/9, RHEL 8/9, Rocky Linux 8/9
- Requires: Docker CE 20.10+, systemd, kernel 4.15+ (cgroup v1 or v2)

## Panel-to-Wings Request Contracts

### Authentication

All Panel→Wings requests use Bearer token authentication:

```http
Authorization: Bearer <node_token>
Content-Type: application/json
Accept: application/vnd.pterodactyl.v1+json
```

The `node_token` is a randomly generated secret stored in Wings' `/etc/pterodactyl/config.yml`.
Wings validates via constant-time comparison (`subtle.ConstantTimeCompare`).

### System Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/system` | System stats, Wings version, Docker version |
| `POST` | `/api/update` | Update Wings configuration |
| `GET` | `/api/servers` | List all server UUIDs on this node |
| `POST` | `/api/servers` | Create/provision a new server |
| `POST` | `/api/transfer` | Initiate server transfer to this node |

### Server Routes (`/api/servers/{uuid}`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/servers/{uuid}` | Server details |
| `DELETE` | `/api/servers/{uuid}` | Delete server |
| `POST` | `/api/servers/{uuid}/power` | Power action (start/stop/restart/kill) |
| `POST` | `/api/servers/{uuid}/commands` | Send console command |
| `POST` | `/api/servers/{uuid}/sync` | Sync server configuration |
| `POST` | `/api/servers/{uuid}/install` | Trigger installation |
| `POST` | `/api/servers/{uuid}/reinstall` | Trigger reinstall |
| `POST` | `/api/servers/{uuid}/ws/deny` | Deny WebSocket token |

### File Routes (`/api/servers/{uuid}/files`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/files/contents` | Read file contents |
| `GET` | `/files/list-directory` | List directory |
| `PUT` | `/files/rename` | Rename file/directory |
| `POST` | `/files/copy` | Copy file |
| `POST` | `/files/write` | Write file contents |
| `POST` | `/files/create-directory` | Create directory |
| `POST` | `/files/delete` | Delete files |
| `POST` | `/files/compress` | Compress files |
| `POST` | `/files/decompress` | Decompress archive |
| `POST` | `/files/chmod` | Change permissions |
| `GET` | `/files/pull` | Download from URL |

### Backup Routes (`/api/servers/{uuid}/backup`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/servers/{uuid}/backup` | Create backup |
| `POST` | `/api/servers/{uuid}/backup/{backup}` | ... |
| `DELETE` | `/api/servers/{uuid}/backup/{backup}` | Delete backup |
| `POST` | `/api/servers/{uuid}/backup/{backup}/restore` | Restore backup |

### Signed URL Routes (no auth middleware)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/download/backup` | Download backup (signed URL) |
| `GET` | `/download/file` | Download file (signed URL) |
| `POST` | `/upload/file` | Upload file (signed URL) |

## Wings-to-Panel Callback Contracts (Remote API)

Wings acts as an HTTP client calling Panel endpoints at `{panel_url}/api/remote/*`.

### Authentication (Wings→Panel)

```http
Authorization: Bearer <token_id>.<token>
User-Agent: Pterodactyl Wings/v1.11.13 (id:<token_id>)
Accept: application/vnd.pterodactyl.v1+json
Content-Type: application/json
```

The Panel validates the `Authorization` header by splitting on `.`, matching
`token_id` to a node record, and comparing `token` against the stored value.

### Remote Client Interface (from Wings source)

```typescript
interface WingsRemoteClient {
  // GET /api/remote/servers?page={page}&per_page={perPage}
  GetServers(perPage: number): Promise<RawServerData[]>;

  // POST /api/remote/servers/reset
  ResetServersState(): Promise<void>;

  // GET /api/remote/servers/{uuid}
  GetServerConfiguration(uuid: string): Promise<ServerConfigurationResponse>;

  // GET /api/remote/servers/{uuid}/install
  GetInstallationScript(uuid: string): Promise<InstallationScript>;

  // POST /api/remote/servers/{uuid}/install
  SetInstallationStatus(uuid: string, data: InstallStatusRequest): Promise<void>;

  // POST /api/remote/servers/{uuid}/archive
  SetArchiveStatus(uuid: string, successful: boolean): Promise<void>;

  // POST /api/remote/servers/{uuid}/transfer
  SetTransferStatus(uuid: string, successful: boolean): Promise<void>;

  // POST /api/remote/sftp/auth
  ValidateSftpCredentials(request: SftpAuthRequest): Promise<SftpAuthResponse>;

  // GET /api/remote/backups/{backup}
  GetBackupRemoteUploadURLs(backup: string, size: number): Promise<BackupRemoteUploadResponse>;

  // POST /api/remote/backups/{backup}
  SetBackupStatus(backup: string, data: BackupRequest): Promise<void>;

  // POST /api/remote/backups/{backup}/restore
  SendRestorationStatus(backup: string, successful: boolean): Promise<void>;

  // POST /api/remote/activity
  SendActivityLogs(activity: Activity[]): Promise<void>;
}
```

### Server List Response (Panel→Wings via Remote API)

```json
{
  "data": [
    {
      "uuid": "string",
      "settings": { /* ServerConfigurationResponse.settings */ },
      "process_configuration": { /* EggProcessConfig */ }
    }
  ],
  "meta": {
    "pagination": {
      "current_page": 1,
      "from": 1,
      "last_page": 1,
      "per_page": 50,
      "to": 1,
      "total": 1
    }
  }
}
```

### Server Configuration Response Schema

```typescript
interface ServerSettings {
  uuid: string;
  meta: {
    name: string;
    description: string;
  };
  suspended: boolean;
  environment: Record<string, string>;
  invocation: string; // startup command with variables resolved
  skip_egg_scripts: boolean;
  build: {
    memory_limit: number;    // MiB
    swap: number;            // MiB (-1 = unlimited, 0 = disabled)
    io_weight: number;       // 10-1000
    cpu_limit: number;       // percentage (100 = 1 core)
    threads: string | null;  // CPU pinning "0,1,2" or null
    disk_space: number;      // MiB (0 = unlimited)
    oom_disabled: boolean;
  };
  container: {
    image: string;
    oom_disabled: boolean;
    requires_rebuild: boolean;
  };
  allocations: {
    force_outgoing_ip: boolean;
    default: {
      ip: string;
      port: number;
    };
    mappings: Record<string, number[]>; // ip → ports
  };
  mounts: Array<{
    source: string;
    target: string;
    read_only: boolean;
  }>;
  egg: {
    id: string;
    file_denylist: string[];
  };
}
```

### Process Configuration Schema

```typescript
interface ProcessConfiguration {
  startup: {
    done: string[];       // regex patterns indicating server is ready
    user_interaction: string[];
    strip_ansi: boolean;
  };
  stop: {
    type: 'command' | 'signal' | 'stop';
    value: string;
  };
  configs: Array<{
    parser: 'file' | 'yaml' | 'properties' | 'json' | 'xml' | 'ini';
    file: string;
    replace: Array<{
      match: string;
      replace_with: string;
    }>;
  }>;
}
```

### Installation Script Response

```json
{
  "container_image": "debian:stable-slim",
  "entrypoint": "bash",
  "script": "#!/bin/bash\necho 'Installing...'"
}
```

### Install Status Callback

```json
POST /api/remote/servers/{uuid}/install
{
  "successful": true,
  "reinstall": false
}
```

### SFTP Authentication

**Request (Wings→Panel):**
```json
POST /api/remote/sftp/auth
{
  "type": "password",        // or "public_key"
  "username": "user.server_id",
  "password": "user_password",
  "ip": "client_ip",
  "session_id": "sftp_session_id"
}
```

**Response (Panel→Wings):**
```json
{
  "server": "server_uuid",
  "permissions": ["*"]       // or specific permission list
}
```

The username format is `<username>.<server_identifier>` where the server
identifier can be the first 8 characters of the UUID.

### Pagination

All paginated endpoints return:
```json
{
  "meta": {
    "pagination": {
      "current_page": 1,
      "from": 1,
      "last_page": 1,
      "per_page": 50,
      "to": 1,
      "total": 1
    }
  }
}
```

Wings fetches all pages in parallel when `last_page > 1`.

### Error Responses

Standard error format:
```json
{
  "error": "Description of the error"
}
```

HTTP status codes:
- `401 Unauthorized` — Missing or malformed Authorization header
- `403 Forbidden` — Invalid token
- `404 Not Found` — Resource not found
- `422 Unprocessable Entity` — Validation errors
- `429 Too Many Requests` — Rate limited (SFTP auth)
- `500 Internal Server Error` — Server error

## WebSocket Authentication

### Token Acquisition

Client requests a WebSocket token from the Panel Client API:
```http
GET /api/client/servers/{identifier}/websocket
Authorization: Bearer <client_api_key>
```

Response:
```json
{
  "data": {
    "token": "<jwt>",
    "socket": "wss://node.example.com:8080/api/servers/{uuid}/ws"
  }
}
```

### JWT Claims

The JWT is signed with the node's token and contains:
```json
{
  "iss": "panel_url",
  "aud": ["node_fqdn:port"],
  "jti": "unique_id",
  "iat": 1234567890,
  "nbf": 1234567890,
  "exp": 1234568490,    // ~10 minutes
  "server_uuid": "uuid",
  "permissions": ["*"],  // or specific list
  "user_uuid": "uuid",
  "user_id": 1,
  "unique_id": "random"
}
```

### WebSocket Protocol

**Client→Wings Events:**
| Event | Args | Description |
|-------|------|-------------|
| `auth` | `[jwt_token]` | Authenticate connection |
| `set state` | `[start\|stop\|restart\|kill]` | Power action |
| `send command` | `[command_string]` | Console command |
| `send logs` | `[null]` | Request log buffer |
| `send stats` | `[null]` | Request current stats |

**Wings→Client Events:**
| Event | Args | Description |
|-------|------|-------------|
| `auth success` | — | Authentication successful |
| `status` | `[offline\|starting\|running\|stopping]` | State change |
| `console output` | `[line]` | Console log line |
| `stats` | `[json_string]` | Resource statistics JSON |
| `token expiring` | — | Token will expire soon (renew) |
| `token expired` | — | Token expired (re-authenticate) |
| `daemon message` | `[message]` | System message |
| `install output` | `[line]` | Installation output |
| `install started` | — | Installation began |
| `install completed` | — | Installation finished |
| `jwt error` | `[error_message]` | JWT validation failure |

### Stats Payload

```json
{
  "memory_bytes": 526626816,
  "memory_limit_bytes": 588800000,
  "cpu_absolute": 58.8,
  "network": {
    "rx_bytes": 1234567,
    "tx_bytes": 7654321
  },
  "uptime": 123456,
  "state": "running",
  "disk_bytes": 1073741824
}
```

## Node Configuration Generation

The Panel generates Wings configuration in YAML:

```yaml
debug: false
uuid: "<node_uuid>"
token_id: "<node_token_id>"
token: "<node_token>"

api:
  host: "0.0.0.0"
  port: 8080
  ssl:
    enabled: true
    cert: "/etc/letsencrypt/live/<fqdn>/fullchain.pem"
    key: "/etc/letsencrypt/live/<fqdn>/privkey.pem"
  upload_limit: 100
  trusted_proxies: []

system:
  data: "/var/lib/pterodactyl/volumes"
  archive_directory: "/var/lib/pterodactyl/archives"
  backup_directory: "/var/lib/pterodactyl/backups"
  username: "pterodactyl"
  timezone: "UTC"
  sftp:
    bind_port: 2022
  disk_check_interval: 150

docker: {}
  network:
    interface: "172.18.0.1"
    dns:
      - "1.1.1.1"
      - "1.0.0.1"
    name: "pterodactyl_nw"
    ispn: false
    driver: "bridge"
    network_mode: "pterodactyl_nw"
    is_internal: false
    enable_icc: true
    interfaces:
      v4:
        subnet: "172.18.0.0/16"
        gateway: "172.18.0.1"
  domainname: ""
  registries: {}
  tmpfs_size: 100

remote: "<panel_url>"
```

## Backup Completion Contract

### Local Backups

Wings creates backup, then calls:
```json
POST /api/remote/backups/{backup_uuid}
{
  "successful": true,
  "checksum": "sha256:<hash>",
  "checksum_type": "sha256",
  "size": 1234567
}
```

### S3 Remote Backups

1. Wings requests upload URLs:
   ```
   GET /api/remote/backups/{backup_uuid}?size={size}
   ```
2. Panel returns presigned multipart upload URLs
3. Wings uploads directly to S3
4. Wings reports completion to Panel

## Transfer Protocol

### Transfer Initiation
1. Panel assigns destination node and allocation
2. Panel tells source Wings to archive the server
3. Source Wings archives, reports `SetArchiveStatus(uuid, true)`
4. Panel tells destination Wings to begin transfer
5. Destination Wings downloads archive from source
6. Destination Wings extracts and provisions
7. Destination Wings reports `SetTransferStatus(uuid, true)`
8. Panel updates database, cleans up source

### Transfer Phases
- `archiving` — Source creating archive
- `archived` — Archive ready
- `transferring` — Data moving to destination
- `completing` — Destination provisioning
- `completed` — Transfer done
- `failed` — Transfer failed (requires manual recovery)

## Node Enrollment

1. Admin creates node in Panel (name, FQDN, ports, resources)
2. Panel generates `token_id` and `token`
3. Panel generates Wings `config.yml` content
4. Admin installs Wings on node host
5. Admin writes config to `/etc/pterodactyl/config.yml`
6. Wings starts, calls `GET /api/remote/servers` to sync
7. Wings calls `POST /api/remote/servers/reset` for stuck states
8. Panel confirms connectivity via `GET /api/system`

No auto-enrollment mechanism exists in v1.11.x.
Configuration must be manually placed on the node.

## Known Unsupported Capabilities

| Feature | Status | Notes |
|---------|--------|-------|
| Auto node enrollment | Not in v1.11.x | Manual config placement required |
| WebSocket compression | Not supported | Wings uses uncompressed frames |
| HTTP/2 to Wings | Not tested | Wings uses Gin/HTTP 1.1 |
| Public key SFTP auth | Partial | Supported in protocol, requires Panel key storage |
| Wings auto-update | Not in scope | Operator responsibility |
| Multi-panel per Wings | Not supported | One panel URL per Wings instance |

## Version Limitations

- Wings v1.11.x requires Panel v1.11.x remote API compatibility
- Egg variable validation uses Laravel-style rules (must be reimplemented)
- Configuration file parsers (JSON, YAML, properties, XML, INI) are Wings-side
- Docker image pulling is Wings-side
- Install script execution is Wings-side in an isolated container

## License

Pterodactyl Panel: MIT License (github.com/pterodactyl/panel)
Pterodactyl Wings: MIT License (github.com/pterodactyl/wings)

This compatibility layer implements the remote API contract that Wings expects.
It does not fork, modify, or redistribute Wings source code.
Attribution is preserved per MIT license requirements.
