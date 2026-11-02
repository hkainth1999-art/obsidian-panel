# Obsidian Panel — Feature Compatibility Matrix

This matrix documents the implementation and validation status of capabilities in Obsidian Panel and its integration with upstream Pterodactyl Wings v1.11.13.

| Subsystem | Feature | Status | Notes |
|---|---|---|---|
| **Daemon Interop** | Upstream Wings v1.11.13 support | **Implemented** | Uses official release without forks or modifications |
| | Wings Remote API callbacks | **Implemented** | Server config, activity, install, backup completion |
| | Wings WebSocket authentication | **Implemented** | JWT signed with node daemon secret for streaming |
| | Remote SFTP validation | **Implemented** | Constant-time password verification via Remote API |
| | Node config.yml generation | **Implemented** | Exact YAML structure matching Pterodactyl requirements |
| **Authentication** | Argon2id password hashing | **Implemented** | Memory cost 65536, time cost 3 |
| | Session cookies (HttpOnly, SameSite) | **Implemented** | Token hashed with SHA-256 in PostgreSQL |
| | TOTP Two-Factor Authentication | **Implemented** | Standard RFC 6238 TOTP |
| | Admin Bootstrap CLI | **Implemented** | Locks permanently once first admin is created |
| **Server Management**| Provisioning onto Wings nodes | **Implemented** | Full configuration push via Wings HTTP client |
| | Real-time console (xterm.js) | **Implemented** | Direct WSS connection to Wings daemon |
| | Live metrics (CPU, RAM, Disk, Net) | **Implemented** | Streamed via Wings stats event |
| | Power controls (Start, Stop, Restart, Kill) | **Implemented** | Proxied to Wings `/api/servers/{uuid}/power` |
| | Server reinstallation | **Implemented** | Triggers Wings reinstall endpoint |
| | Server deletion & cleanup | **Implemented** | Removes files, container, and allocation assignments |
| **File Manager** | Directory browsing & breadcrumbs | **Implemented** | Proxied to Wings file APIs |
| | Text file editing with syntax styles | **Implemented** | In-browser editor |
| | Delete & rename files | **Implemented** | Path canonicalized to prevent traversal escapes |
| **Backups** | Local node backups | **Implemented** | Wings local archive engine |
| | Backup restore | **Implemented** | Wings backup restore callback |
| **Network** | IP & port allocations | **Implemented** | Range generation with collision detection |
| | Primary & secondary port assignments | **Implemented** | Bound to game container environment |
| **Nests & Eggs** | Official Pterodactyl egg JSON import | **Implemented** | Parses startup, variables, images, and install scripts |
| | Egg export to standard JSON | **Implemented** | PTDL_v2 specification |
| **Design** | Obsidian Near-Black Theme | **Implemented** | #090909 background, #111111 surface, #272727 borders |
| | Collapsible sidebar & Command Palette | **Implemented** | Cmd+K / Ctrl+K keyboard shortcut navigation |
| | Grid / List server toggle | **Implemented** | Persisted layout states |
| | Zero states ("No servers yet", "No nodes") | **Implemented** | Actionable onboarding guidance |
