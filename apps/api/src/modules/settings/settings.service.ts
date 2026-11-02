import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

export interface PanelSettings {
  panelName: string;
  accentColor: string;
  appUrl?: string;
  allowRegistration: boolean;
  requireMfa: boolean;
  mailHost?: string;
  mailPort?: number;
  mailUsername?: string;
  mailPassword?: string;
  mailEncryption?: 'tls' | 'ssl' | 'none';
  mailFromAddress?: string;
  mailFromName?: string;
}

function loadEnvFileMap(): Record<string, string> {
  const envMap: Record<string, string> = {};
  const possiblePaths = [
    '/var/www/obsidian/.env',
    '/var/www/obsidian/apps/api/.env',
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(process.cwd(), 'apps/api/.env'),
  ];

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const key = trimmed.substring(0, eqIdx).trim();
            let val = trimmed.substring(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (!envMap[key] && val) {
              envMap[key] = val;
            }
          }
        }
      }
    } catch {}
  }
  return envMap;
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  // Cached settings in memory for ultra-fast response
  private cachedSettings: PanelSettings = {
    panelName: 'Obsidian Panel',
    accentColor: '#06B6D4',
    appUrl: '',
    allowRegistration: false,
    requireMfa: false,
    mailHost: '',
    mailPort: 587,
    mailUsername: '',
    mailPassword: '',
    mailEncryption: 'tls',
    mailFromAddress: '',
    mailFromName: 'Obsidian Panel',
  };

  constructor(private readonly prisma: PrismaService) {
    this.loadSettings();
  }

  private async loadSettings() {
    try {
      const records = await this.prisma.setting.findMany();
      const settingsMap = new Map<string, string>();
      for (const r of records) {
        settingsMap.set(r.key, r.value);
      }

      const envMap = loadEnvFileMap();
      const getEnv = (key: string): string => process.env[key] || envMap[key] || '';

      // Parse installation .env SMTP_FROM which may be: "Obsidian Panel" <noreply@domain.com> or noreply@domain.com
      const rawFrom = getEnv('SMTP_FROM');
      let envFromAddress = '';
      let envFromName = '';
      if (rawFrom.includes('<') && rawFrom.includes('>')) {
        const match = rawFrom.match(/^(?:["']?([^"']+)["']?\s*)?<([^>]+)>/);
        if (match) {
          envFromName = match[1]?.trim() || '';
          envFromAddress = match[2]?.trim() || '';
        }
      } else {
        envFromAddress = rawFrom;
      }

      const panelName = settingsMap.get('panel_name') || getEnv('APP_NAME') || 'Obsidian Panel';
      const accentColor = settingsMap.get('theme_accent_color') || '#06B6D4';
      const appUrl = settingsMap.get('app_url') || getEnv('APP_URL') || getEnv('NEXT_PUBLIC_APP_URL') || '';
      const allowRegistration = settingsMap.get('allow_registration')
        ? settingsMap.get('allow_registration') === 'true'
        : false;
      const requireMfa = settingsMap.get('require_mfa')
        ? settingsMap.get('require_mfa') === 'true'
        : false;

      const mailHost = settingsMap.get('mail_host') || getEnv('SMTP_HOST') || '';
      const mailPort = parseInt(settingsMap.get('mail_port') || getEnv('SMTP_PORT') || '587', 10);
      const mailUsername = settingsMap.get('mail_username') || getEnv('SMTP_USER') || '';
      const mailPassword = settingsMap.get('mail_password') || getEnv('SMTP_PASS') || '';
      const mailEncryption = (settingsMap.get('mail_encryption') as any) ||
        (String(mailPort) === '465' || getEnv('SMTP_SECURE') === 'true' ? 'ssl' : 'tls');
      const mailFromAddress = settingsMap.get('mail_from_address') || envFromAddress || getEnv('SMTP_USER') || '';
      const mailFromName = settingsMap.get('mail_from_name') || envFromName || panelName || 'Obsidian Panel';

      this.cachedSettings = {
        panelName,
        accentColor,
        appUrl,
        allowRegistration,
        requireMfa,
        mailHost,
        mailPort,
        mailUsername,
        mailPassword,
        mailEncryption,
        mailFromAddress,
        mailFromName,
      };

      // Auto-persist installation env settings to DB if DB records don't exist yet
      if (!settingsMap.has('app_url') && appUrl) {
        await this.prisma.setting.create({ data: { key: 'app_url', value: appUrl } }).catch(() => {});
      }
      if (!settingsMap.has('mail_host') && mailHost) {
        await this.prisma.setting.create({ data: { key: 'mail_host', value: mailHost } }).catch(() => {});
      }
      if (!settingsMap.has('mail_port') && mailPort) {
        await this.prisma.setting.create({ data: { key: 'mail_port', value: String(mailPort) } }).catch(() => {});
      }
      if (!settingsMap.has('mail_username') && mailUsername) {
        await this.prisma.setting.create({ data: { key: 'mail_username', value: mailUsername } }).catch(() => {});
      }
      if (!settingsMap.has('mail_password') && mailPassword) {
        await this.prisma.setting.create({ data: { key: 'mail_password', value: mailPassword } }).catch(() => {});
      }
      if (!settingsMap.has('mail_from_address') && mailFromAddress) {
        await this.prisma.setting.create({ data: { key: 'mail_from_address', value: mailFromAddress } }).catch(() => {});
      }
      if (!settingsMap.has('mail_from_name') && mailFromName) {
        await this.prisma.setting.create({ data: { key: 'mail_from_name', value: mailFromName } }).catch(() => {});
      }
    } catch (e: any) {
      this.logger.warn(`Could not load settings from DB: ${e.message}`);
    }
  }

  getPublicSettings() {
    return {
      panelName: this.cachedSettings.panelName,
      accentColor: this.cachedSettings.accentColor,
      allowRegistration: this.cachedSettings.allowRegistration,
    };
  }

  getAllSettings(): PanelSettings {
    return { ...this.cachedSettings };
  }

  async updateSettings(dto: Partial<PanelSettings>): Promise<PanelSettings> {
    if (dto.panelName !== undefined) {
      this.cachedSettings.panelName = dto.panelName.trim() || 'Obsidian Panel';
      await this.prisma.setting.upsert({
        where: { key: 'panel_name' },
        create: { key: 'panel_name', value: this.cachedSettings.panelName },
        update: { value: this.cachedSettings.panelName },
      });
    }

    if (dto.accentColor !== undefined) {
      this.cachedSettings.accentColor = dto.accentColor.trim() || '#06B6D4';
      await this.prisma.setting.upsert({
        where: { key: 'theme_accent_color' },
        create: { key: 'theme_accent_color', value: this.cachedSettings.accentColor },
        update: { value: this.cachedSettings.accentColor },
      });
    }

    if (dto.appUrl !== undefined) {
      this.cachedSettings.appUrl = dto.appUrl.trim();
      await this.prisma.setting.upsert({
        where: { key: 'app_url' },
        create: { key: 'app_url', value: this.cachedSettings.appUrl },
        update: { value: this.cachedSettings.appUrl },
      });
    }

    if (dto.allowRegistration !== undefined) {
      this.cachedSettings.allowRegistration = Boolean(dto.allowRegistration);
      await this.prisma.setting.upsert({
        where: { key: 'allow_registration' },
        create: { key: 'allow_registration', value: String(this.cachedSettings.allowRegistration) },
        update: { value: String(this.cachedSettings.allowRegistration) },
      });
    }

    if (dto.requireMfa !== undefined) {
      this.cachedSettings.requireMfa = Boolean(dto.requireMfa);
      await this.prisma.setting.upsert({
        where: { key: 'require_mfa' },
        create: { key: 'require_mfa', value: String(this.cachedSettings.requireMfa) },
        update: { value: String(this.cachedSettings.requireMfa) },
      });
    }

    if (dto.mailHost !== undefined) {
      this.cachedSettings.mailHost = dto.mailHost.trim();
      await this.prisma.setting.upsert({
        where: { key: 'mail_host' },
        create: { key: 'mail_host', value: this.cachedSettings.mailHost },
        update: { value: this.cachedSettings.mailHost },
      });
    }

    if (dto.mailPort !== undefined) {
      this.cachedSettings.mailPort = Number(dto.mailPort) || 587;
      await this.prisma.setting.upsert({
        where: { key: 'mail_port' },
        create: { key: 'mail_port', value: String(this.cachedSettings.mailPort) },
        update: { value: String(this.cachedSettings.mailPort) },
      });
    }

    if (dto.mailUsername !== undefined) {
      this.cachedSettings.mailUsername = dto.mailUsername.trim();
      await this.prisma.setting.upsert({
        where: { key: 'mail_username' },
        create: { key: 'mail_username', value: this.cachedSettings.mailUsername },
        update: { value: this.cachedSettings.mailUsername },
      });
    }

    if (dto.mailPassword !== undefined) {
      this.cachedSettings.mailPassword = dto.mailPassword;
      await this.prisma.setting.upsert({
        where: { key: 'mail_password' },
        create: { key: 'mail_password', value: this.cachedSettings.mailPassword },
        update: { value: this.cachedSettings.mailPassword },
      });
    }

    if (dto.mailEncryption !== undefined) {
      this.cachedSettings.mailEncryption = dto.mailEncryption;
      await this.prisma.setting.upsert({
        where: { key: 'mail_encryption' },
        create: { key: 'mail_encryption', value: this.cachedSettings.mailEncryption },
        update: { value: this.cachedSettings.mailEncryption },
      });
    }

    if (dto.mailFromAddress !== undefined) {
      this.cachedSettings.mailFromAddress = dto.mailFromAddress.trim();
      await this.prisma.setting.upsert({
        where: { key: 'mail_from_address' },
        create: { key: 'mail_from_address', value: this.cachedSettings.mailFromAddress },
        update: { value: this.cachedSettings.mailFromAddress },
      });
    }

    if (dto.mailFromName !== undefined) {
      this.cachedSettings.mailFromName = dto.mailFromName.trim();
      await this.prisma.setting.upsert({
        where: { key: 'mail_from_name' },
        create: { key: 'mail_from_name', value: this.cachedSettings.mailFromName },
        update: { value: this.cachedSettings.mailFromName },
      });
    }

    return { ...this.cachedSettings };
  }
}

