# Obsidian Panel — Deployment & Operations Guide

This guide covers production deployment of the Obsidian Panel and installation of official unmodified Pterodactyl Wings v1.11.13.

## 1. Quick Automated Installation (Pterodactyl-Style)

Obsidian Panel includes an interactive, automated installer that sets up your panel FQDN, automatically installs and configures Nginx, issues Let's Encrypt SSL certificates (or configures non-SSL HTTP), deploys database containers, and bootstraps the first administrator.

### Run the Installer
```bash
# Clone and run
git clone https://github.com/obsidian-panel/panel.git /var/www/obsidian
cd /var/www/obsidian
bash install.sh
```

```bash
# Run the installer directly (No flags needed!)
sudo bash <(curl -sSL https://raw.githubusercontent.com/obsidian-ontop/obsiden-panel/refs/heads/main/install.sh)
```

Running the command presents an interactive menu:
```text
  [1] Install Obsidian Panel
  [2] Delete / Uninstall Obsidian Panel
  [3] Install Pterodactyl Wings (Daemon)
  [4] Delete / Uninstall Pterodactyl Wings
  [5] Create / Reset Admin User
  [0] Exit
```

> **Note:** When selecting **[1] Install Obsidian Panel**, the installer prompts you to create your **Administrator account (Username, Email, Password) first**, along with your domain and SSL settings. Once entered, the entire installation and build process runs completely automated and unattended!

### Command-Line Arguments
You can also invoke tasks directly:
```bash
# Install Obsidian Panel
bash install.sh --install-panel

# Completely Delete / Uninstall Obsidian Panel
bash install.sh --delete-panel

# Install Docker & Pterodactyl Wings Daemon
bash install.sh --install-wings

# Delete / Uninstall Pterodactyl Wings
bash install.sh --delete-wings
```

---

## 2. Environment Variable Reference

### Panel API (`apps/api/.env`)
| Variable | Description | Default / Example |
|---|---|---|
| `NODE_ENV` | Runtime environment | `production` |
| `PORT` | API listen port | `3001` |
| `APP_URL` | Public URL of Panel (no trailing slash) | `https://panel.example.com` or `http://panel.example.com` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@127.0.0.1:5432/obsidian_panel?schema=public` |
| `REDIS_URL` | Redis connection URL | `redis://127.0.0.1:6379` |
| `SESSION_SECRET` | 64-character secret for cookies | Random hex string |
| `COOKIE_SECURE` | Enforce secure HTTPS cookie flag | `true` (SSL) or `false` (Non-SSL) |

### Panel Web (`apps/web/.env`)
| Variable | Description | Default / Example |
|---|---|---|
| `PORT` | Next.js server port | `3000` |
| `API_URL` | Upstream API backend address | `http://127.0.0.1:3001` |

---

## 3. Administrator Bootstrap

On a fresh installation with an empty database:

```bash
# 1. Run database migrations
pnpm db:migrate

# 2. Run administrator bootstrap CLI
pnpm --filter @obsidian/api bootstrap --email admin@example.com --username admin --password "YourStrongPassword123!"
```

Once created, the bootstrap command locks permanently.

---

## 4. Official Wings Daemon Installation (Node Host)

On each game-hosting server running Ubuntu 22.04 / 24.04 LTS:

### Step 1: Install Docker
```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
```

### Step 2: Download Upstream Wings v1.11.13
```bash
mkdir -p /etc/pterodactyl /var/lib/pterodactyl/volumes
curl -L -o /usr/local/bin/wings "https://github.com/pterodactyl/wings/releases/download/v1.11.13/wings_linux_amd64"
chmod u+x /usr/local/bin/wings
```

### Step 3: Configure Node
In the Obsidian Panel web dashboard:
1. Navigate to **Administration → Nodes → Register Node**.
2. Enter the node FQDN (e.g. `node1.example.com`), ports, and memory/disk allocations.
3. Click **Config** to copy the generated YAML.
4. Paste it onto the node at `/etc/pterodactyl/config.yml`.

### Step 4: Systemd Service
Create `/etc/systemd/system/wings.service`:
```ini
[Unit]
Description=Pterodactyl Wings Daemon
After=docker.service
Requires=docker.service
PartOf=docker.service

[Service]
User=root
WorkingDirectory=/etc/pterodactyl
LimitNOFILE=4096
PIDFile=/var/run/wings/daemon.pid
ExecStart=/usr/local/bin/wings
Restart=on-failure
StartLimitInterval=180
StartLimitBurst=30
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
systemctl enable --now wings
```

Verify connection in Obsidian by clicking **Test** next to the node in the dashboard.

---

## 5. Reverse Proxy Configurations (SSL & Non-SSL)

### A. SSL / HTTPS Configuration (`/etc/nginx/sites-available/obsidian.conf`)
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name panel.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name panel.example.com;

    ssl_certificate /etc/letsencrypt/live/panel.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/panel.example.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 100M;

    # API and Wings Remote Callback routes
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    # Web Dashboard and WebSocket streaming
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

### B. Non-SSL / Plain HTTP Configuration (`/etc/nginx/sites-available/obsidian.conf`)
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name 192.168.1.50; # or your local/internal FQDN

    client_max_body_size 100M;

    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto http;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto http;
    }
}
```

---

## 6. Panel Backup and Restore Runbook

### Database Backup
```bash
pg_dump -U obsidian -d obsidian_panel -F c -b -v -f /backups/obsidian_$(date +%Y%m%d_%H%M%S).dump
```

### Database Restore
```bash
pg_restore -U obsidian -d obsidian_panel -v -c /backups/obsidian_YYYYMMDD_HHMMSS.dump
```
