#!/usr/bin/env bash
# ==============================================================================
# Obsidian Panel & Pterodactyl Wings — Automated Management Script
# Optimized for Ubuntu 20.04/22.04/24.04 LTS & Debian 11/12
#
# Supported Operations:
#   1) Install Obsidian Panel (Admin user setup at start, auto DB, Redis, Nginx, SSL)
#   2) Delete / Uninstall Obsidian Panel (Clean removal of services, files, DB)
#   3) Install Pterodactyl Wings (Docker, Wings daemon binary, Systemd, Config)
#   4) Delete / Uninstall Pterodactyl Wings (Daemon, Services, Volumes cleanup)
#   5) Create / Reset Admin User (Bootstrap superuser CLI)
# ==============================================================================

set -e

# Terminal Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ------------------------------------------------------------------------------
# Banner & Terminal Input Helpers (Supports both bash <(curl ...) and curl | bash)
# ------------------------------------------------------------------------------
show_banner() {
    clear
    echo -e "${CYAN}${BOLD}"
    cat << "EOF"
  ____  _         _     _ _             ____                  _ 
 / __ \| |       (_)   | (_)           |  _ \                | |
| |  | | |__  ___ _  __| |_  __ _ _ __ | |_) | __ _ _ __   ___| |
| |  | | '_ \/ __| |/ _` | |/ _` | '_ \|  _ < / _` | '_ \ / _ \ |
| |__| | |_) \__ \ | (_| | | (_| | | | | |_) | (_| | | | |  __/ |
 \____/|_.__/|___/_|\__,_|_|\__,_|_| |_|____/ \__,_|_| |_|\___|_|

      Modern Game Server Management Panel & Wings Daemon Manager
EOF
    echo -e "${NC}"
}

read_input() {
    local prompt="$1"
    local var_name="$2"
    if [ -t 0 ]; then
        read -p "$prompt" "$var_name"
    elif [ -e /dev/tty ]; then
        read -p "$prompt" "$var_name" < /dev/tty
    else
        read -p "$prompt" "$var_name"
    fi
}

read_secret() {
    local prompt="$1"
    local var_name="$2"
    if [ -t 0 ]; then
        read -s -p "$prompt" "$var_name"
    elif [ -e /dev/tty ]; then
        read -s -p "$prompt" "$var_name" < /dev/tty
    else
        read -s -p "$prompt" "$var_name"
    fi
    echo ""
}

verify_root() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}[ERROR] This installer must be run as root (use sudo).${NC}"
        exit 1
    fi
}

verify_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
    else
        echo -e "${RED}[ERROR] Cannot detect Linux distribution.${NC}"
        exit 1
    fi

    echo -e "${GREEN}[*] Detected operating system: $OS $VERSION${NC}"

    if [[ "$OS" != "ubuntu" && "$OS" != "debian" ]]; then
        echo -e "${YELLOW}[WARNING] This script is optimized for Ubuntu and Debian.${NC}"
        read_input "Do you want to continue anyway? [y/N]: " continue_anyway
        if [[ ! "$continue_anyway" =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# ------------------------------------------------------------------------------
# 1. INSTALL OBSIDIAN PANEL
# ------------------------------------------------------------------------------
install_panel() {
    show_banner
    verify_root
    verify_os

    echo -e "\n${BOLD}${CYAN}================================================================${NC}"
    echo -e "${BOLD}${CYAN}            INSTALLING OBSIDIAN PANEL                           ${NC}"
    echo -e "${BOLD}${CYAN}================================================================${NC}\n"

    # --------------------------------------------------------------------------
    # Step A: Create Administrator User FIRST (before any package downloads/builds)
    # --------------------------------------------------------------------------
    echo -e "${BOLD}${CYAN}--- Step 1: Create Administrator Account ---${NC}"
    echo -e "Enter your master administrator credentials upfront so installation runs hands-free:\n"

    while true; do
        read_input "Admin Username: " ADMIN_USERNAME
        ADMIN_USERNAME=$(echo "$ADMIN_USERNAME" | tr -d ' ')
        if [ -n "$ADMIN_USERNAME" ]; then
            break
        fi
        echo -e "${RED}Username cannot be empty.${NC}"
    done

    while true; do
        read_input "Admin Email: " ADMIN_EMAIL
        ADMIN_EMAIL=$(echo "$ADMIN_EMAIL" | tr -d ' ')
        if [ -n "$ADMIN_EMAIL" ]; then
            break
        fi
        echo -e "${RED}Email cannot be empty.${NC}"
    done

    while true; do
        read_secret "Admin Password (min 8 chars): " ADMIN_PASSWORD
        if [ ${#ADMIN_PASSWORD} -ge 8 ]; then
            break
        fi
        echo -e "${RED}Password must be at least 8 characters long.${NC}"
    done

    echo -e "${GREEN}[✓] Admin account configured: ${ADMIN_USERNAME} (${ADMIN_EMAIL})${NC}\n"

    # --------------------------------------------------------------------------
    # Step B: Domain / FQDN & Protocol Setup
    # --------------------------------------------------------------------------
    echo -e "${BOLD}${CYAN}--- Step 2: Domain & Protocol Setup ---${NC}"
    while true; do
        read_input "Enter the FQDN or IP for your Obsidian Panel (e.g. panel.example.com or VPS IP): " FQDN
        FQDN=$(echo "$FQDN" | tr -d ' ' | tr '[:upper:]' '[:lower:]')
        if [ -n "$FQDN" ]; then
            break
        fi
        echo -e "${RED}FQDN / Domain cannot be empty.${NC}"
    done

    echo -e "\n${BOLD}Select Web Protocol:${NC}"
    echo "  1) SSL / HTTPS (Recommended — Automatic Let's Encrypt certificate)"
    echo "  2) Non-SSL / HTTP (Plain port 80 — For local networks, test labs, or reverse proxies)"
    read_input "Choice [1/2, default: 1]: " SSL_CHOICE
    SSL_CHOICE=${SSL_CHOICE:-1}

    USE_SSL=true
    SCHEME="https"
    CERT_EMAIL=""

    if [ "$SSL_CHOICE" == "2" ]; then
        USE_SSL=false
        SCHEME="http"
        echo -e "${YELLOW}[!] Non-SSL mode selected. The Panel will be accessible over plain HTTP on port 80.${NC}"
    else
        echo -e "${GREEN}[*] SSL mode selected. Automatic Let's Encrypt certificates will be configured.${NC}"
        read_input "Enter email for Let's Encrypt renewal notices [default: $ADMIN_EMAIL]: " INPUT_CERT_EMAIL
        CERT_EMAIL=${INPUT_CERT_EMAIL:-"$ADMIN_EMAIL"}
    fi

    APP_URL="${SCHEME}://${FQDN}"
    echo -e "${GREEN}[✓] Application URL configured to: ${BOLD}${APP_URL}${NC}\n"

    # --------------------------------------------------------------------------
    # Step C: Optional SMTP Configuration
    # --------------------------------------------------------------------------
    echo -e "${BOLD}${CYAN}--- Step 3: Email / SMTP Configuration ---${NC}"
    echo -e "Enables automatic account emails and password reset links for users."
    read_input "Do you want to configure SMTP now? [y/N]: " CONFIGURE_SMTP

    SMTP_HOST=""
    SMTP_PORT="587"
    SMTP_USER=""
    SMTP_PASS=""
    SMTP_FROM=""

    if [[ "$CONFIGURE_SMTP" =~ ^[Yy]$ ]]; then
        read_input "SMTP Host (e.g. smtp.gmail.com): " SMTP_HOST
        read_input "SMTP Port [587]: " INPUT_SMTP_PORT
        SMTP_PORT=${INPUT_SMTP_PORT:-587}
        read_input "SMTP Username / Gmail Address: " SMTP_USER
        read_secret "SMTP Password / Gmail App Password: " SMTP_PASS
        read_input "From Address [default: \"Obsidian Panel\" <noreply@$FQDN>]: " INPUT_SMTP_FROM
        SMTP_FROM=${INPUT_SMTP_FROM:-"\"Obsidian Panel\" <noreply@$FQDN>"}
        echo -e "${GREEN}[✓] SMTP configured for ${SMTP_USER} on ${SMTP_HOST}:${SMTP_PORT}.${NC}"
    else
        echo -e "${YELLOW}[!] Skipping SMTP configuration. Account verification and reset links will be written to server logs.${NC}"
    fi

    echo -e "\n${GREEN}${BOLD}[*] All configuration parameters collected! Starting automated installation...${NC}\n"

    # --------------------------------------------------------------------------
    # Step D: Install System Dependencies & Node.js 20 LTS
    # --------------------------------------------------------------------------
    echo -e "${BOLD}${CYAN}--- Installing System Dependencies & Node.js 20 ---${NC}"
    apt-get update -y
    apt-get install -y curl wget git jq openssl ca-certificates gnupg lsb-release build-essential nginx

    if ! command -v node &> /dev/null || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 20 ]; then
        echo -e "${GREEN}[*] Installing Node.js 20 LTS from NodeSource...${NC}"
        mkdir -p /etc/apt/keyrings
        curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg --yes
        echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
        apt-get update -y
        apt-get install -y nodejs
    fi

    corepack enable
    corepack prepare pnpm@9.12.3 --activate

    if [ "$USE_SSL" = true ]; then
        echo -e "${GREEN}[*] Installing Certbot for Nginx...${NC}"
        apt-get install -y certbot python3-certbot-nginx
    fi

    # --------------------------------------------------------------------------
    # Step E: Local Database Setup (PostgreSQL & Redis)
    # --------------------------------------------------------------------------
    echo -e "\n${BOLD}${CYAN}--- Setting Up Local PostgreSQL & Redis ---${NC}"
    apt-get install -y postgresql postgresql-contrib redis-server
    systemctl enable --now postgresql
    systemctl enable --now redis-server

    DB_NAME="obsidian_panel"
    DB_USER="obsidian"
    DB_PASSWORD=$(openssl rand -hex 16)
    REDIS_PASSWORD=$(openssl rand -hex 16)
    SESSION_SECRET=$(openssl rand -hex 32)

    echo -e "${GREEN}[*] Initializing local database '${DB_NAME}' and user '${DB_USER}'...${NC}"

    sudo -u postgres psql -c "DO \$\$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
        CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
      ELSE
        ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
      END IF;
    END
    \$\$;"

    sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

    PG_CONF_DIR=$(ls -d /etc/postgresql/*/*/ 2>/dev/null | head -n 1)
    if [ -n "$PG_CONF_DIR" ] && [ -f "$PG_CONF_DIR/pg_hba.conf" ]; then
        grep -q "obsidian_panel" "$PG_CONF_DIR/pg_hba.conf" || \
        sed -i "1s|^|local   obsidian_panel  obsidian                                md5\nhost    obsidian_panel  obsidian        127.0.0.1/32            md5\n|" "$PG_CONF_DIR/pg_hba.conf"
        systemctl restart postgresql
    fi

    echo -e "${GREEN}[*] Local PostgreSQL successfully configured on 127.0.0.1:5432.${NC}"

    # --------------------------------------------------------------------------
    # Step F: SSL Certificate Request (if SSL selected)
    # --------------------------------------------------------------------------
    if [ "$USE_SSL" = true ]; then
        echo -e "\n${BOLD}${CYAN}--- Requesting Let's Encrypt SSL Certificate ---${NC}"
        systemctl stop nginx || true

        certbot certonly --standalone -d "$FQDN" --non-interactive --agree-tos -m "$CERT_EMAIL" || {
            echo -e "${YELLOW}[WARNING] Standalone certbot failed. Trying webroot / nginx method...${NC}"
            systemctl start nginx
            certbot certonly --nginx -d "$FQDN" --non-interactive --agree-tos -m "$CERT_EMAIL" || {
                echo -e "${RED}[ERROR] Let's Encrypt certificate issuance failed.${NC}"
                echo -e "${RED}Please verify that ${FQDN} points to this server IP address.${NC}"
                read_input "Do you want to switch to Non-SSL mode and continue? [y/N]: " switch_non_ssl
                if [[ "$switch_non_ssl" =~ ^[Yy]$ ]]; then
                    USE_SSL=false
                    SCHEME="http"
                    APP_URL="${SCHEME}://${FQDN}"
                else
                    exit 1
                fi
            }
        }
    fi

    # --------------------------------------------------------------------------
    # Step G: Automatic Nginx Reverse Proxy Setup
    # --------------------------------------------------------------------------
    echo -e "\n${BOLD}${CYAN}--- Configuring Nginx Reverse Proxy ---${NC}"
    NGINX_CONF="/etc/nginx/sites-available/obsidian.conf"

    if [ "$USE_SSL" = true ]; then
        cat << EOF > "$NGINX_CONF"
# Obsidian Panel — Production SSL Configuration
server {
    listen 80;
    listen [::]:80;
    server_name $FQDN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $FQDN;

    ssl_certificate /etc/letsencrypt/live/$FQDN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$FQDN/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    client_max_body_size 100M;

    # Backend API & Wings Remote callbacks
    location ^~ /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # Next.js Web Frontend & Real-Time Console WebSocket
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
EOF
    else
        cat << EOF > "$NGINX_CONF"
# Obsidian Panel — Non-SSL HTTP Configuration
server {
    listen 80;
    listen [::]:80;
    server_name $FQDN;

    client_max_body_size 100M;

    # Backend API & Wings Remote callbacks
    location ^~ /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto http;
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # Next.js Web Frontend & WebSocket streaming
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto http;
    }
}
EOF
    fi

    rm -f /etc/nginx/sites-enabled/default
    ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/obsidian.conf

    nginx -t
    systemctl restart nginx
    systemctl enable nginx

    echo -e "${GREEN}[*] Nginx configured and running.${NC}"

    # --------------------------------------------------------------------------
    # Step H: Application Code Installation & Build
    # --------------------------------------------------------------------------
    echo -e "\n${BOLD}${CYAN}--- Building Application Components ---${NC}"
    INSTALL_DIR="/var/www/obsidian"
    mkdir -p "$INSTALL_DIR"

    NODE_BIN=$(command -v node || echo "/usr/bin/node")
    PNPM_BIN=$(command -v pnpm || echo "/usr/local/bin/pnpm")

    if [ -f "$PWD/package.json" ] && [ -d "$PWD/apps/api" ]; then
        echo -e "${GREEN}[*] Using local codebase from $PWD...${NC}"
        if [ "$PWD" != "$INSTALL_DIR" ]; then
            cp -rf "$PWD"/* "$INSTALL_DIR"/ 2>/dev/null || cp -r "$PWD"/* "$INSTALL_DIR"/
        fi
    elif [ ! -f "$INSTALL_DIR/package.json" ]; then
        echo -e "${GREEN}[*] Downloading Obsidian Panel codebase via Git...${NC}"
        REPO_URL=${PANEL_REPO_URL:-""}
        if [ -z "$REPO_URL" ]; then
            read_input "Enter Obsidian Panel Git Repository URL [default: https://github.com/obsidian-ontop/obsiden-panel.git]: " INPUT_REPO_URL
            REPO_URL=${INPUT_REPO_URL:-"https://github.com/obsidian-ontop/obsiden-panel.git"}
        fi
        echo -e "${GREEN}[*] Cloning from ${REPO_URL}...${NC}"
        git clone "$REPO_URL" "$INSTALL_DIR" || {
            echo -e "${RED}[ERROR] Failed to clone repository from $REPO_URL.${NC}"
            echo -e "${YELLOW}You can clone your repository manually to /var/www/obsidian and re-run this script.${NC}"
            exit 1
        }
    fi

    cd "$INSTALL_DIR"

    JWT_SECRET=$(openssl rand -hex 32)

    cat << EOF > "$INSTALL_DIR/.env"
NODE_ENV=production
PORT=3001
APP_URL=$APP_URL
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}?schema=public
REDIS_URL=redis://127.0.0.1:6379
SESSION_SECRET=$SESSION_SECRET
JWT_SECRET=$JWT_SECRET
COOKIE_SECURE=$( [ "$USE_SSL" = true ] && echo "true" || echo "false" )
SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS
SMTP_FROM=$SMTP_FROM
EOF

    cat << EOF > "$INSTALL_DIR/apps/api/.env"
NODE_ENV=production
PORT=3001
APP_URL=$APP_URL
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}?schema=public
REDIS_URL=redis://127.0.0.1:6379
SESSION_SECRET=$SESSION_SECRET
JWT_SECRET=$JWT_SECRET
COOKIE_SECURE=$( [ "$USE_SSL" = true ] && echo "true" || echo "false" )
SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS
SMTP_FROM=$SMTP_FROM
EOF

    cat << EOF > "$INSTALL_DIR/apps/web/.env"
NODE_ENV=production
PORT=3000
API_URL=http://127.0.0.1:3001
NEXT_PUBLIC_APP_URL=$APP_URL
EOF

    echo -e "${GREEN}[*] Installing monorepo packages via pnpm...${NC}"
    NODE_ENV=development pnpm install --prod=false

    echo -e "${GREEN}[*] Building contracts, permissions, and wings adapter...${NC}"
    pnpm --filter @obsidian/contracts build
    pnpm --filter @obsidian/permissions build
    pnpm --filter @obsidian/wings-adapter build

    echo -e "${GREEN}[*] Generating Prisma database client and synchronizing schema...${NC}"
    cd "$INSTALL_DIR/apps/api"
    npx prisma generate
    if [ -d "$INSTALL_DIR/apps/api/prisma/migrations" ]; then
        npx prisma migrate deploy || npx prisma db push --accept-data-loss
    else
        npx prisma db push --accept-data-loss
    fi
    cd "$INSTALL_DIR"

    echo -e "${GREEN}[*] Building Monorepo Packages, NestJS Backend & Next.js Frontend...${NC}"
    rm -f "$INSTALL_DIR/apps/api/tsconfig.tsbuildinfo" "$INSTALL_DIR/tsconfig.tsbuildinfo" 2>/dev/null || true
    pnpm -r build

    if [ -f "$INSTALL_DIR/apps/web/node_modules/.bin/next" ]; then
        NEXT_BIN="$INSTALL_DIR/apps/web/node_modules/.bin/next"
    elif [ -f "$INSTALL_DIR/node_modules/.bin/next" ]; then
        NEXT_BIN="$INSTALL_DIR/node_modules/.bin/next"
    else
        NEXT_BIN=$(which next 2>/dev/null || echo "$INSTALL_DIR/node_modules/.bin/next")
    fi

    chown -R www-data:www-data "$INSTALL_DIR"
    chmod -R 755 "$INSTALL_DIR"

    # --------------------------------------------------------------------------
    # Step I: Crash Support & Systemd Watchdogs
    # --------------------------------------------------------------------------
    echo -e "\n${BOLD}${CYAN}--- Configuring Crash Auto-Restart Services ---${NC}"

    cat << EOF > /etc/systemd/system/obsidian-api.service
[Unit]
Description=Obsidian Panel API Daemon (Control Plane)
Documentation=https://github.com/obsidian-ontop/obsiden-panel
After=network.target postgresql.service redis.service
Requires=postgresql.service redis.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/obsidian
Environment=NODE_ENV=production
EnvironmentFile=/var/www/obsidian/.env
ExecStart=$NODE_BIN /var/www/obsidian/apps/api/dist/main.js

Restart=always
RestartSec=3s
StartLimitInterval=180s
StartLimitBurst=30

LimitNOFILE=65535
StandardOutput=journal
StandardError=journal
SyslogIdentifier=obsidian-api

[Install]
WantedBy=multi-user.target
EOF

    cat << EOF > /etc/systemd/system/obsidian-web.service
[Unit]
Description=Obsidian Panel Web Frontend (Next.js)
Documentation=https://github.com/obsidian-ontop/obsiden-panel
After=network.target obsidian-api.service
Wants=obsidian-api.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/obsidian/apps/web
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/var/www/obsidian/apps/web/node_modules/.bin/next start -p 3000

Restart=always
RestartSec=3s
StartLimitInterval=180s
StartLimitBurst=30

LimitNOFILE=65535
StandardOutput=journal
StandardError=journal
SyslogIdentifier=obsidian-web

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable --now obsidian-api
    systemctl enable --now obsidian-web

    echo -e "${GREEN}[*] Obsidian systemd services enabled with crash auto-restart.${NC}"

    # --------------------------------------------------------------------------
    # Step J: Apply Administrator Bootstrap (using credentials from Step A)
    # --------------------------------------------------------------------------
    echo -e "\n${BOLD}${CYAN}--- Bootstrapping Administrator Account ---${NC}"
    pnpm --filter @obsidian/api run bootstrap -- --username "${ADMIN_USERNAME}" --email "${ADMIN_EMAIL}" --password "${ADMIN_PASSWORD}"

    # Summary
    echo -e "\n${GREEN}${BOLD}================================================================${NC}"
    echo -e "${GREEN}${BOLD}       OBSIDIAN PANEL INSTALLATION COMPLETE!                   ${NC}"
    echo -e "${GREEN}${BOLD}================================================================${NC}\n"

    echo -e "Panel URL:       ${CYAN}${BOLD}${APP_URL}${NC}"
    echo -e "Protocol:        ${BOLD}$( [ "$USE_SSL" = true ] && echo "HTTPS (SSL Active)" || echo "HTTP (Non-SSL)" )${NC}"
    echo -e "Local Database:  ${BOLD}PostgreSQL on 127.0.0.1:5432 (Database: ${DB_NAME})${NC}"
    echo -e "Nginx Config:    /etc/nginx/sites-available/obsidian.conf"
    echo -e "Crash Recovery:  ${GREEN}Active (systemd: obsidian-api.service & obsidian-web.service)${NC}"
    echo -e "Admin Account:   ${BOLD}${ADMIN_USERNAME}${NC} (${ADMIN_EMAIL})\n"

    echo -e "${CYAN}Next Steps:${NC}"
    echo -e "  1. Open your browser and navigate to: ${BOLD}${APP_URL}/login${NC}"
    echo -e "  2. Sign in with username '${ADMIN_USERNAME}'."
    echo -e "  3. Go to ${BOLD}Administration → Locations${NC} to create your first location."
    echo -e "  4. Go to ${BOLD}Administration → Nodes${NC} to register your node."
    echo -e "  5. Install Wings on your node server using this script: ${BOLD}bash install.sh${NC} (Select [3] Install Wings)"
    echo -e "  6. Copy generated ${BOLD}config.yml${NC} to ${BOLD}/etc/pterodactyl/config.yml${NC} and start Wings.\n"
}

# ------------------------------------------------------------------------------
# 2. DELETE / UNINSTALL OBSIDIAN PANEL
# ------------------------------------------------------------------------------
delete_panel() {
    show_banner
    verify_root

    echo -e "\n${BOLD}${RED}================================================================${NC}"
    echo -e "${BOLD}${RED}          DELETE / UNINSTALL OBSIDIAN PANEL                     ${NC}"
    echo -e "${BOLD}${RED}================================================================${NC}\n"

    echo -e "${YELLOW}[WARNING] This operation will completely remove:${NC}"
    echo -e "  - Obsidian Web and API systemd services"
    echo -e "  - Obsidian Nginx reverse proxy configuration"
    echo -e "  - Panel files in /var/www/obsidian"
    echo ""
    read_input "Are you sure you want to proceed? Type 'DELETE' to confirm: " CONFIRM_DELETE
    if [ "$CONFIRM_DELETE" != "DELETE" ]; then
        echo -e "${CYAN}[*] Deletion aborted. No changes were made.${NC}"
        return 0
    fi

    echo -e "\n${YELLOW}[*] Stopping and disabling Obsidian services...${NC}"
    systemctl stop obsidian-web 2>/dev/null || true
    systemctl disable obsidian-web 2>/dev/null || true
    systemctl stop obsidian-api 2>/dev/null || true
    systemctl disable obsidian-api 2>/dev/null || true

    echo -e "${YELLOW}[*] Removing systemd service units...${NC}"
    rm -f /etc/systemd/system/obsidian-web.service
    rm -f /etc/systemd/system/obsidian-api.service
    systemctl daemon-reload

    echo -e "${YELLOW}[*] Removing Nginx configuration...${NC}"
    rm -f /etc/nginx/sites-enabled/obsidian.conf
    rm -f /etc/nginx/sites-available/obsidian.conf
    if nginx -t 2>/dev/null; then
        systemctl reload nginx 2>/dev/null || systemctl restart nginx 2>/dev/null || true
    fi

    echo -e "${YELLOW}[*] Removing /var/www/obsidian directory...${NC}"
    if [ -d "/var/www/obsidian" ]; then
        CURRENT_SCRIPT=$(realpath "$0" 2>/dev/null || echo "")
        if [[ "$CURRENT_SCRIPT" == /var/www/obsidian/* ]]; then
            echo -e "${YELLOW}[!] Current script is running inside /var/www/obsidian. Deleting application files around it...${NC}"
            find /var/www/obsidian -mindepth 1 -maxdepth 1 ! -name "install.sh" -exec rm -rf {} +
        else
            rm -rf /var/www/obsidian
        fi
    fi

    # Database Deletion Option
    echo ""
    read_input "Do you also want to DROP the PostgreSQL database 'obsidian_panel' and user 'obsidian'? [y/N]: " DROP_DB
    if [[ "$DROP_DB" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}[*] Dropping database obsidian_panel and user obsidian...${NC}"
        sudo -u postgres psql -c "DROP DATABASE IF EXISTS obsidian_panel;" 2>/dev/null || true
        sudo -u postgres psql -c "DROP ROLE IF EXISTS obsidian;" 2>/dev/null || true
        sudo -u postgres psql -c "DROP USER IF EXISTS obsidian;" 2>/dev/null || true
        
        PG_CONF_DIR=$(ls -d /etc/postgresql/*/*/ 2>/dev/null | head -n 1)
        if [ -n "$PG_CONF_DIR" ] && [ -f "$PG_CONF_DIR/pg_hba.conf" ]; then
            sed -i '/obsidian_panel/d' "$PG_CONF_DIR/pg_hba.conf" 2>/dev/null || true
            systemctl restart postgresql 2>/dev/null || true
        fi
        echo -e "${GREEN}[*] PostgreSQL database and user dropped.${NC}"
    fi

    # SSL Certificate Deletion Option
    if command -v certbot &> /dev/null; then
        echo ""
        read_input "Do you want to delete Certbot SSL certificates for this panel domain? [y/N]: " DELETE_CERT
        if [[ "$DELETE_CERT" =~ ^[Yy]$ ]]; then
            read_input "Enter the domain name certificate to delete: " CERT_DOMAIN
            if [ -n "$CERT_DOMAIN" ]; then
                certbot delete --cert-name "$CERT_DOMAIN" --non-interactive 2>/dev/null || true
                echo -e "${GREEN}[*] Certbot certificate for $CERT_DOMAIN deleted.${NC}"
            fi
        fi
    fi

    echo -e "\n${GREEN}${BOLD}================================================================${NC}"
    echo -e "${GREEN}${BOLD}       OBSIDIAN PANEL HAS BEEN SUCCESSFULLY REMOVED             ${NC}"
    echo -e "${GREEN}${BOLD}================================================================${NC}\n"
}

# ------------------------------------------------------------------------------
# 3. INSTALL PTERODACTYL WINGS
# ------------------------------------------------------------------------------
install_wings() {
    show_banner
    verify_root
    verify_os

    echo -e "\n${BOLD}${CYAN}================================================================${NC}"
    echo -e "${BOLD}${CYAN}          INSTALLING PTERODACTYL WINGS DAEMON                   ${NC}"
    echo -e "${BOLD}${CYAN}================================================================${NC}\n"

    # Architecture Detection
    MACHINE_ARCH=$(uname -m)
    case "$MACHINE_ARCH" in
        x86_64)
            WINGS_ARCH="amd64"
            ;;
        aarch64|arm64)
            WINGS_ARCH="arm64"
            ;;
        *)
            echo -e "${RED}[ERROR] Unsupported CPU architecture: ${MACHINE_ARCH}. Wings requires x86_64 or arm64.${NC}"
            exit 1
            ;;
    esac

    echo -e "${GREEN}[*] Detected architecture: ${MACHINE_ARCH} (wings_${WINGS_ARCH})${NC}"

    # Install Pre-requisite Packages
    echo -e "\n${BOLD}${CYAN}--- Installing Dependencies & Docker ---${NC}"
    apt-get update -y
    apt-get install -y curl wget jq tar unzip ca-certificates gnupg lsb-release

    # Check and Install Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${GREEN}[*] Docker not found. Installing official Docker engine...${NC}"
        curl -fsSL https://get.docker.com | sh
        systemctl enable --now docker
        echo -e "${GREEN}[*] Docker successfully installed and enabled.${NC}"
    else
        echo -e "${GREEN}[*] Docker is already installed: $(docker --version)${NC}"
        systemctl enable --now docker
    fi

    # Create Required Directories
    echo -e "\n${BOLD}${CYAN}--- Creating Wings Working Directories ---${NC}"
    mkdir -p /etc/pterodactyl
    mkdir -p /var/lib/pterodactyl/volumes
    mkdir -p /var/lib/pterodactyl/backups
    mkdir -p /var/log/pterodactyl
    mkdir -p /tmp/pterodactyl
    chmod 750 /var/lib/pterodactyl

    # Download Latest Wings Binary
    echo -e "\n${BOLD}${CYAN}--- Downloading Wings Binary ---${NC}"
    WINGS_URL="https://github.com/pterodactyl/wings/releases/latest/download/wings_linux_${WINGS_ARCH}"
    echo -e "${GREEN}[*] Fetching binary from: ${WINGS_URL}${NC}"
    curl -L -o /usr/local/bin/wings "$WINGS_URL"
    chmod u+x /usr/local/bin/wings

    INSTALLED_WINGS_VER=$(/usr/local/bin/wings --version 2>/dev/null || echo "Wings (latest)")
    echo -e "${GREEN}[*] ${INSTALLED_WINGS_VER} successfully installed at /usr/local/bin/wings.${NC}"

    # Create Systemd Service Unit
    echo -e "\n${BOLD}${CYAN}--- Configuring Wings Systemd Service ---${NC}"
    cat << EOF > /etc/systemd/system/wings.service
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
EOF

    systemctl daemon-reload
    systemctl enable wings

    # SSL / Let's Encrypt Certificate Setup for Node FQDN
    echo -e "\n${BOLD}${CYAN}--- Node SSL Certificate (Let's Encrypt) ---${NC}"
    echo "Wings communicates over secure HTTPS/WSS when configured with SSL."
    read_input "Do you want to generate a free Let's Encrypt SSL certificate for this node? [Y/n]: " NODE_SSL_CHOICE
    NODE_SSL_CHOICE=${NODE_SSL_CHOICE:-Y}

    if [[ "$NODE_SSL_CHOICE" =~ ^[Yy]$ ]]; then
        read_input "Enter Node FQDN (e.g. node1.example.com): " NODE_FQDN
        read_input "Enter email for certificate renewal alerts: " NODE_CERT_EMAIL
        if [ -n "$NODE_FQDN" ] && [ -n "$NODE_CERT_EMAIL" ]; then
            apt-get install -y certbot
            systemctl stop nginx 2>/dev/null || true
            echo -e "${GREEN}[*] Requesting SSL certificate for ${NODE_FQDN}...${NC}"
            certbot certonly --standalone -d "$NODE_FQDN" --non-interactive --agree-tos -m "$NODE_CERT_EMAIL" || {
                echo -e "${YELLOW}[!] Standalone certbot failed. Trying standard certbot...${NC}"
            }
            if [ -f "/etc/letsencrypt/live/$NODE_FQDN/fullchain.pem" ]; then
                echo -e "${GREEN}[✓] SSL Certificate successfully generated for ${NODE_FQDN}!${NC}"
                echo -e "    Certificate: /etc/letsencrypt/live/${NODE_FQDN}/fullchain.pem"
                echo -e "    Private Key: /etc/letsencrypt/live/${NODE_FQDN}/privkey.pem"
                chmod -R 755 /etc/letsencrypt/live /etc/letsencrypt/archive 2>/dev/null || true
            else
                echo -e "${YELLOW}[!] Could not automatically generate certificate. Verify DNS points to this server.${NC}"
            fi
        fi
    fi

    # Configuration Step
    echo -e "\n${BOLD}${CYAN}--- Wings Node Configuration ---${NC}"
    echo "Choose how you want to configure this node:"
    echo "  1) Paste YAML configuration content directly from Obsidian Panel"
    echo "  2) Paste the auto-configure command (wings configure --panel-url ...)"
    echo "  3) I will configure /etc/pterodactyl/config.yml manually later"
    read_input "Choice [1/2/3, default: 1]: " CONFIG_CHOICE
    CONFIG_CHOICE=${CONFIG_CHOICE:-1}

    CONFIGURED=false

    if [ "$CONFIG_CHOICE" == "1" ]; then
        echo -e "\n${YELLOW}Please paste the entire contents of config.yml from Obsidian Panel.${NC}"
        echo -e "${YELLOW}When finished, press ENTER, then type ${BOLD}EOF${NC}${YELLOW} on a new line and press ENTER:${NC}\n"
        
        TMP_CONF=$(mktemp)
        if [ -t 0 ]; then
            INPUT_SRC="/dev/stdin"
        elif [ -e /dev/tty ]; then
            INPUT_SRC="/dev/tty"
        else
            INPUT_SRC="/dev/stdin"
        fi

        while IFS= read -r line < "$INPUT_SRC"; do
            if [ "$line" == "EOF" ]; then
                break
            fi
            echo "$line" >> "$TMP_CONF"
        done

        if [ -s "$TMP_CONF" ]; then
            mv "$TMP_CONF" /etc/pterodactyl/config.yml
            chmod 600 /etc/pterodactyl/config.yml
            CONFIGURED=true
            echo -e "${GREEN}[*] /etc/pterodactyl/config.yml saved successfully.${NC}"
        else
            rm -f "$TMP_CONF"
            echo -e "${YELLOW}[!] No configuration was entered.${NC}"
        fi
    elif [ "$CONFIG_CHOICE" == "2" ]; then
        echo -e "\n${YELLOW}Paste the full wings configure command from Obsidian Panel:${NC}"
        read_input "> " AUTO_CONF_CMD
        if [ -n "$AUTO_CONF_CMD" ]; then
            eval "$AUTO_CONF_CMD" || echo -e "${RED}[!] wings configure returned an error. Check credentials.${NC}"
            if [ -f "/etc/pterodactyl/config.yml" ]; then
                chmod 600 /etc/pterodactyl/config.yml
                CONFIGURED=true
                echo -e "${GREEN}[*] Configuration generated successfully.${NC}"
            fi
        fi
    else
        echo -e "${CYAN}[*] Manual configuration selected.${NC}"
    fi

    # Start Wings if Configured
    if [ "$CONFIGURED" = true ]; then
        echo -e "\n${GREEN}[*] Starting Pterodactyl Wings service...${NC}"
        systemctl restart wings || true
        sleep 2
        if systemctl is-active --quiet wings; then
            echo -e "${GREEN}[*] Wings daemon is actively running!${NC}"
        else
            echo -e "${YELLOW}[!] Wings service did not start cleanly. Check logs with: journalctl -u wings -n 50${NC}"
        fi
    else
        echo -e "\n${YELLOW}[!] Wings is installed but waiting for /etc/pterodactyl/config.yml.${NC}"
    fi

    # Wings Installation Summary
    echo -e "\n${GREEN}${BOLD}================================================================${NC}"
    echo -e "${GREEN}${BOLD}       PTERODACTYL WINGS INSTALLATION COMPLETE!                ${NC}"
    echo -e "${GREEN}${BOLD}================================================================${NC}\n"

    echo -e "Wings Binary:    /usr/local/bin/wings"
    echo -e "Service Name:    wings (systemctl status wings)"
    echo -e "Config Location: /etc/pterodactyl/config.yml"
    echo -e "Volumes Path:    /var/lib/pterodactyl/volumes\n"

    echo -e "${CYAN}Next Steps:${NC}"
    if [ "$CONFIGURED" = false ]; then
        echo -e "  1. In Obsidian Panel, go to ${BOLD}Administration → Nodes${NC}."
        echo -e "  2. Select your node and click ${BOLD}Configuration${NC}."
        echo -e "  3. Copy and save the YAML content into: ${BOLD}/etc/pterodactyl/config.yml${NC}"
        echo -e "  4. Start Wings with: ${BOLD}systemctl enable --now wings${NC}"
    else
        echo -e "  1. In Obsidian Panel, go to ${BOLD}Administration → Nodes${NC}."
        echo -e "  2. Verify that your node heartbeats green and connects successfully."
    fi
    echo -e "  - View live Wings logs anytime with: ${BOLD}journalctl -u wings -f${NC}\n"
}

# ------------------------------------------------------------------------------
# 4. DELETE / UNINSTALL PTERODACTYL WINGS
# ------------------------------------------------------------------------------
delete_wings() {
    show_banner
    verify_root

    echo -e "\n${BOLD}${RED}================================================================${NC}"
    echo -e "${BOLD}${RED}        DELETE / UNINSTALL PTERODACTYL WINGS                    ${NC}"
    echo -e "${BOLD}${RED}================================================================${NC}\n"

    echo -e "${YELLOW}[WARNING] This operation will uninstall the Pterodactyl Wings daemon.${NC}"
    echo -e "  - Stops and removes the wings systemd service"
    echo -e "  - Deletes /usr/local/bin/wings"
    echo ""
    read_input "Are you sure you want to proceed? Type 'DELETE' to confirm: " CONFIRM_DELETE
    if [ "$CONFIRM_DELETE" != "DELETE" ]; then
        echo -e "${CYAN}[*] Deletion aborted. No changes were made.${NC}"
        return 0
    fi

    echo -e "\n${YELLOW}[*] Stopping and disabling Wings service...${NC}"
    systemctl stop wings 2>/dev/null || true
    systemctl disable wings 2>/dev/null || true

    echo -e "${YELLOW}[*] Removing systemd service unit...${NC}"
    rm -f /etc/systemd/system/wings.service
    systemctl daemon-reload

    echo -e "${YELLOW}[*] Removing Wings executable...${NC}"
    rm -f /usr/local/bin/wings

    # Clean Configuration Directory
    echo ""
    read_input "Do you want to delete Wings configurations in /etc/pterodactyl? [y/N]: " DEL_CONFIG
    if [[ "$DEL_CONFIG" =~ ^[Yy]$ ]]; then
        rm -rf /etc/pterodactyl
        echo -e "${GREEN}[*] Removed /etc/pterodactyl.${NC}"
    fi

    # Clean Server Data / Volumes
    echo ""
    read_input "Do you want to delete all server volume data in /var/lib/pterodactyl? (CAUTION: Deletes game server files!) [y/N]: " DEL_VOLUMES
    if [[ "$DEL_VOLUMES" =~ ^[Yy]$ ]]; then
        rm -rf /var/lib/pterodactyl
        echo -e "${GREEN}[*] Removed /var/lib/pterodactyl.${NC}"
    fi

    echo -e "\n${GREEN}${BOLD}================================================================${NC}"
    echo -e "${GREEN}${BOLD}       PTERODACTYL WINGS HAS BEEN REMOVED                      ${NC}"
    echo -e "${GREEN}${BOLD}================================================================${NC}\n"
}

# ------------------------------------------------------------------------------
# 5. CREATE / RESET ADMIN USER (BOOTSTRAP)
# ------------------------------------------------------------------------------
create_admin_user() {
    show_banner
    verify_root

    echo -e "\n${BOLD}${CYAN}================================================================${NC}"
    echo -e "${BOLD}${CYAN}          CREATE / RESET OBSIDIAN ADMIN USER                    ${NC}"
    echo -e "${BOLD}${CYAN}================================================================${NC}\n"

    PANEL_DIR="/var/www/obsidian"
    if [ ! -d "$PANEL_DIR" ]; then
        echo -e "${RED}[ERROR] Obsidian Panel directory not found at $PANEL_DIR.${NC}"
        echo -e "Please install the panel first."
        return 1
    fi

    cd "$PANEL_DIR"

    while true; do
        read_input "Admin Username: " ADMIN_USERNAME
        ADMIN_USERNAME=$(echo "$ADMIN_USERNAME" | tr -d ' ')
        if [ -n "$ADMIN_USERNAME" ]; then
            break
        fi
        echo -e "${RED}Username cannot be empty.${NC}"
    done

    while true; do
        read_input "Admin Email: " ADMIN_EMAIL
        ADMIN_EMAIL=$(echo "$ADMIN_EMAIL" | tr -d ' ')
        if [ -n "$ADMIN_EMAIL" ]; then
            break
        fi
        echo -e "${RED}Email cannot be empty.${NC}"
    done

    while true; do
        read_secret "Admin Password (min 8 chars): " ADMIN_PASSWORD
        if [ ${#ADMIN_PASSWORD} -ge 8 ]; then
            break
        fi
        echo -e "${RED}Password must be at least 8 characters long.${NC}"
    done

    echo -e "\n${GREEN}[*] Registering administrator credentials...${NC}"
    cd "$PANEL_DIR/apps/api"
    npx prisma generate 2>/dev/null || true
    npx prisma db push --accept-data-loss 2>/dev/null || true
    cd "$PANEL_DIR"
    pnpm --filter @obsidian/api run bootstrap -- --username "${ADMIN_USERNAME}" --email "${ADMIN_EMAIL}" --password "${ADMIN_PASSWORD}"

    echo -e "\n${GREEN}${BOLD}================================================================${NC}"
    echo -e "${GREEN}${BOLD}          ADMINISTRATOR ACCOUNT READY                           ${NC}"
    echo -e "${GREEN}${BOLD}================================================================${NC}\n"
    echo -e "Username: ${BOLD}${ADMIN_USERNAME}${NC}"
    echo -e "Email:    ${BOLD}${ADMIN_EMAIL}${NC}\n"
}

# ------------------------------------------------------------------------------
# Interactive Menu & CLI Dispatcher
# ------------------------------------------------------------------------------
show_menu() {
    while true; do
        show_banner
        echo -e "${BOLD}Please choose an action:${NC}\n"
        echo -e "  ${CYAN}[1]${NC} Install Obsidian Panel"
        echo -e "  ${RED}[2]${NC} Delete / Uninstall Obsidian Panel"
        echo -e "  ${CYAN}[3]${NC} Install Pterodactyl Wings (Daemon)"
        echo -e "  ${RED}[4]${NC} Delete / Uninstall Pterodactyl Wings"
        echo -e "  ${GREEN}[5]${NC} Create / Reset Admin User"
        echo -e "  ${YELLOW}[0]${NC} Exit\n"
        read_input "Select option [0-5]: " ACTION

        case "$ACTION" in
            1)
                install_panel
                break
                ;;
            2)
                delete_panel
                break
                ;;
            3)
                install_wings
                break
                ;;
            4)
                delete_wings
                break
                ;;
            5)
                create_admin_user
                break
                ;;
            0|q|Q|exit)
                echo -e "\n${CYAN}Exiting installer. Goodbye!${NC}\n"
                exit 0
                ;;
            *)
                echo -e "\n${RED}Invalid option '${ACTION}'. Please select 0, 1, 2, 3, 4, or 5.${NC}"
                sleep 2
                ;;
        esac
    done
}

# Direct invocation dispatcher (runs menu by default without flags)
case "$1" in
    --install-panel|-ip|--panel|-p)
        install_panel
        ;;
    --delete-panel|-dp|--uninstall-panel)
        delete_panel
        ;;
    --install-wings|-iw|--wings|-w)
        install_wings
        ;;
    --delete-wings|-dw|--uninstall-wings)
        delete_wings
        ;;
    --create-user|-cu|--user|-u)
        create_admin_user
        ;;
    --help|-h)
        show_banner
        echo -e "Usage: sudo bash install.sh [OPTION]\n"
        echo -e "Options:"
        echo -e "  --install-panel, -ip, -p    Run Obsidian Panel automated installer"
        echo -e "  --delete-panel, -dp         Uninstall / completely delete Obsidian Panel"
        echo -e "  --install-wings, -iw, -w    Install official Pterodactyl Wings daemon & Docker"
        echo -e "  --delete-wings, -dw         Uninstall / completely delete Pterodactyl Wings"
        echo -e "  --create-user, -cu, -u      Create / Reset master administrator account"
        echo -e "  --help, -h                  Display this help message"
        echo -e "\nIf no option is provided, the interactive menu is launched automatically.\n"
        exit 0
        ;;
    *)
        show_menu
        ;;
esac
