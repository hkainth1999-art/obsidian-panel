# Obsidian Panel — Architecture Overview

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        TRUST BOUNDARY: PANEL                        │
│                                                                      │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐              │
│  │   Next.js    │   │   NestJS     │   │   BullMQ     │              │
│  │   Frontend   │──▶│   API        │──▶│   Worker     │              │
│  │   (web)      │   │   (api)      │   │   (worker)   │              │
│  └──────────────┘   └──────┬───────┘   └──────┬───────┘              │
│                            │                   │                      │
│                     ┌──────┴───────┐   ┌──────┴───────┐              │
│                     │  PostgreSQL  │   │    Redis     │              │
│                     │  (app data)  │   │  (queues,    │              │
│                     │              │   │   locks,     │              │
│                     │              │   │   cache)     │              │
│                     └──────────────┘   └──────────────┘              │
│                                                                      │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
                    TRUST BOUNDARY: NETWORK
                    (TLS, Bearer Token Auth)
                              │
┌─────────────────────────────┴────────────────────────────────────────┐
│                     TRUST BOUNDARY: NODE                             │
│                                                                      │
│  ┌───────────────────────────────────────────────────┐               │
│  │              Official Wings Daemon                │               │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────────┐       │               │
│  │  │  HTTP   │  │  SFTP   │  │  WebSocket  │       │               │
│  │  │  API    │  │ Server  │  │  Server     │       │               │
│  │  └────┬────┘  └────┬────┘  └──────┬──────┘       │               │
│  │       │            │              │               │               │
│  │  ┌────┴────────────┴──────────────┴──────┐        │               │
│  │  │           Docker Engine               │        │               │
│  │  │  ┌─────┐  ┌─────┐  ┌─────┐           │        │               │
│  │  │  │ GS1 │  │ GS2 │  │ GS3 │  ...      │        │               │
│  │  │  └─────┘  └─────┘  └─────┘           │        │               │
│  │  └───────────────────────────────────────┘        │               │
│  └───────────────────────────────────────────────────┘               │
│                                                                      │
│  ┌───────────────────────────┐                                       │
│  │  MySQL/MariaDB (optional) │  ← Customer database hosting         │
│  └───────────────────────────┘                                       │
└──────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### apps/web (Next.js Frontend)
- Server-side rendered React application
- Strict TypeScript with Tailwind CSS styling
- Premium black dashboard UI
- TanStack Query for remote state
- WebSocket client for console/stats
- Client-side routing with permission-aware navigation
- No secrets in browser bundles

### apps/api (NestJS Backend)
- Fastify adapter for HTTP
- RESTful API for frontend and external consumers
- Wings Remote API compatibility layer (routes Wings expects to call)
- Wings Client API (routes Panel calls on Wings)
- JWT/session authentication
- RBAC authorization on every endpoint
- OpenAPI documentation
- CSRF protection for cookie-authenticated requests
- Rate limiting via Redis

### apps/worker (BullMQ Worker)
- Server provisioning workflows
- Backup management
- Schedule execution
- Database provisioning
- Cleanup and reconciliation
- Dead letter handling

### packages/wings-adapter
- Wings-to-Panel remote API contract implementation
- Panel-to-Wings HTTP client
- WebSocket JWT generation
- SFTP authentication handler
- Server configuration structure builder
- Node configuration generator
- All protocol types derived from upstream Wings v1.11.13

### packages/contracts
- Shared Zod schemas (browser-safe)
- API request/response types
- Pagination types
- Error types
- No server secrets

### packages/permissions
- Permission definitions and bitfield operations
- Server-scoped permission checks
- Admin role checks
- Browser-safe (used by both frontend and backend)

### packages/ui
- Radix/shadcn-style component library
- Tailwind CSS design tokens
- Accessible, keyboard-navigable components
- Lucide icon integration

### packages/config
- Environment variable parsing
- Configuration validation
- Server-only (not browser-safe)

### packages/test-utils
- Test fixtures factory (isolated test environments only)
- Mock helpers
- Integration test harness

## Data Flow: Panel → Wings

1. Panel API receives authenticated request (e.g., create server)
2. API validates, authorizes, persists to PostgreSQL
3. API enqueues provisioning job to BullMQ via Redis
4. Worker picks up job, calls Wings HTTP API with Bearer token
5. Wings provisions Docker container
6. Wings calls back to Panel Remote API to report status
7. Panel updates database, notifies frontend via polling/WebSocket

## Data Flow: Wings → Panel (Callbacks)

Wings calls the Panel's Remote API at `{panel_url}/api/remote/*`:
- `GET /api/remote/servers` — Fetch all servers for this node
- `GET /api/remote/servers/{uuid}` — Fetch specific server config
- `GET /api/remote/servers/{uuid}/install` — Fetch install script
- `POST /api/remote/servers/reset` — Reset stuck server states
- `POST /api/remote/servers/{uuid}/install` — Report install completion
- `POST /api/remote/servers/{uuid}/archive` — Report archive status
- `POST /api/remote/servers/{uuid}/transfer` — Report transfer status
- `POST /api/remote/sftp/auth` — Validate SFTP credentials
- `POST /api/remote/activity` — Send activity logs
- `GET /api/remote/backups/{backup}` — Get backup info
- `POST /api/remote/backups/{backup}` — Report backup status
- `POST /api/remote/backups/{backup}/restore` — Report restore status

## Authentication Model

```
Browser ─── Session Cookie (HttpOnly, Secure, SameSite) ──▶ Panel API
External ─── API Key (Bearer Token, scoped) ──▶ Panel API
Panel API ─── Node Bearer Token (tokenId.token) ──▶ Wings API
Wings ─── Node Bearer Token (tokenId.token) ──▶ Panel Remote API
Browser ─── Short-lived JWT (10min) ──▶ Wings WebSocket
Wings SFTP ─── User credentials ──▶ Panel Remote SFTP Auth
```

## Security Boundaries

1. **Panel ↔ Wings**: Mutual TLS verification, Bearer token authentication
2. **Browser ↔ Panel**: Session cookies, CSRF tokens, CSP headers
3. **Browser ↔ Wings WebSocket**: Short-lived JWT with embedded permissions
4. **Wings ↔ Docker**: Container isolation (not a security guarantee)
5. **Panel ↔ PostgreSQL**: Application-level access only
6. **Panel ↔ Redis**: Internal network only
7. **Wings ↔ Customer MySQL**: Provisioned credentials, least privilege

## Deployment Architecture

```
┌─ Panel Host ─────────────────────────────────────┐
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  │
│  │ web:3000   │  │ api:4000   │  │ worker     │  │
│  └────────────┘  └────────────┘  └────────────┘  │
│  ┌────────────┐  ┌────────────┐                   │
│  │ postgres   │  │ redis      │                   │
│  │ :5432      │  │ :6379      │                   │
│  └────────────┘  └────────────┘                   │
│                                                    │
│  ┌────────────────────────────────────────────┐    │
│  │ Reverse Proxy (nginx/caddy/traefik)        │    │
│  │ TLS termination, /api → api:4000           │    │
│  │ / → web:3000                               │    │
│  └────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────┘

┌─ Node Host (one or more) ─────────────────────────┐
│  ┌────────────────────────────────────────────┐    │
│  │ Official Wings Daemon                      │    │
│  │ API :8080, SFTP :2022                      │    │
│  └────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────┐    │
│  │ Docker Engine                              │    │
│  └────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────┐    │
│  │ MySQL/MariaDB (optional, for customer DBs) │    │
│  └────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────┘
```

The Panel container does NOT require access to the host Docker socket.
Wings is installed separately on game-hosting nodes.
