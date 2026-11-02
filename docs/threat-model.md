# Obsidian Panel — Threat Model & Security Baseline

This document defines the security boundaries, threat vectors, mitigations, and operational guarantees for the Obsidian Panel and its integration with upstream Pterodactyl Wings v1.11.13.

---

## 1. Trust Boundaries & Architecture Overview

```
                                  [ Public Internet ]
                                           │
                                           ▼
                      [ TLS Reverse Proxy (Nginx / Caddy) ]
                                           │
                     ┌─────────────────────┴─────────────────────┐
                     ▼                                           ▼
         [ Obsidian Web UI (Next.js) ]               [ Obsidian API (NestJS) ]
                     │                                           │
                     └─────────────────────┬─────────────────────┘
                                           │
                                           ▼
                                 [ PostgreSQL + Redis ]
                                           │
                                ═════════════════════  Trust Boundary 1
                                           │
                     [ Authenticated Wings Node Protocol (TLS) ]
                                           │
                                           ▼
                                  [ Pterodactyl Wings ]
                                           │
                                ═════════════════════  Trust Boundary 2
                                           │
                               [ Docker Container Daemon ]
                                           │
                                           ▼
                               [ Customer Game Server ]
```

### Trust Boundary 1: Panel Control Plane ↔ Remote Wings Node
- **Transports:** HTTPS for REST requests, WSS for WebSocket streams.
- **Authentication:** Panel generates signed JWTs and holds per-node daemon tokens (64 hex characters) generated during node registration.
- **Node to Panel:** Wings validates callbacks using `X-Access-Node` and constant-time token comparison against the node's registered token in PostgreSQL.
- **No Shared Keys:** Compromise of one Wings node daemon token cannot be used to forge requests for another node.

### Trust Boundary 2: Wings Daemon ↔ Docker Container Sandbox
- **Process Isolation:** Game servers execute within isolated Docker containers without `--privileged` flags.
- **Filesystem Isolation:** Customer filesystem is jailed to `/var/lib/pterodactyl/volumes/{server-uuid}`. Symlink traversal out of the jail is blocked by Wings path canonicalization.
- **No Docker Socket Access:** Neither the customer container nor the Obsidian Panel container ever mounts `/var/run/docker.sock`.

---

## 2. Threat Vector Analysis & Mitigations

| Threat | Risk Level | Mitigation Strategy |
|---|---|---|
| **Hostile Customer Account** | High | Strict deny-by-default server authorization (`ServerAccessGuard`). IDOR protection via UUID verification. No access to unassigned allocations or foreign servers. |
| **Path Traversal / Archive Escape** | High | Wings daemon enforces strict filepath canonicalization before read/write operations. Archives extracted inside containers cannot escape container root. |
| **Malicious Game Egg / Install Script** | High | Only authenticated administrators can import eggs or alter install scripts (`AdminGuard`). Low-privilege users cannot edit install containers or startup scripts. |
| **Callback Forgery / Node Spoofing** | High | Wings remote endpoints require `X-Access-Node` and `X-Access-Token`. Token comparison uses constant-time `timingSafeEqual()` to defeat timing attacks. |
| **Credential Theft / Session Hijacking** | Medium | Passwords hashed with Argon2id ($m=65536, t=3, p=1$). Session tokens stored as SHA-256 hashes in PostgreSQL. Optional TOTP 2FA with single-use recovery codes. |
| **Console XSS / Terminal Injection** | Medium | Terminal emulator uses xterm.js canvas/DOM rendering without innerHTML evaluation. Terminal escape codes stripped or safely rendered. |
| **WebSocket Token Replay** | Medium | Wings WebSocket JWTs are short-lived (10-minute validity), scoped to single server UUID and user UUID. Node validates JWT expiration. |

---

## 3. OWASP ASVS Compliance Checklist

- [x] **V2: Authentication:** Argon2id password hashing, mandatory reauthentication for credential changes, TOTP 2FA.
- [x] **V3: Session Management:** SHA-256 token hashing, expiration timestamp enforcement, instant session revocation.
- [x] **V4: Access Control:** Server-scoped permissions (`@obsidian/permissions`), admin guard on all administrative routes, deny-by-default.
- [x] **V5: Validation & Sanitization:** Fastify schema validation, Zod request contracts, strict type parsing.
- [x] **V14: Configuration:** No default passwords, bootstrap CLI single-use lock, secrets stored in environment variables.
