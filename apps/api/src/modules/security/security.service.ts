import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface BannedIpEntry {
  ip: string;
  reason: string;
  bannedAt: string;
  bannedBy?: string;
}

export interface RequestLogEntry {
  id: string;
  ip: string;
  method: string;
  path: string;
  status: number;
  timestamp: string;
  userAgent: string;
}

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);

  // In-memory set for O(1) IP ban lookup
  private bannedIpsMap = new Map<string, BannedIpEntry>();

  // Rolling in-memory request log (last 500 requests)
  private readonly requestLog: RequestLogEntry[] = [];
  private readonly maxLogEntries = 500;

  // Rate limiting tracker per IP: IP -> array of timestamps
  private ipRequestTimestamps = new Map<string, number[]>();

  // Login attempt tracker per IP: IP -> array of timestamps
  private loginAttemptTimestamps = new Map<string, number[]>();

  // Global DDoS threshold: max requests per minute per IP
  private readonly ddosMaxRequestsPerMinute = 120;

  // Login brute force threshold: 5 attempts per minute per IP
  private readonly loginMaxAttemptsPerMinute = 5;

  constructor(private readonly prisma: PrismaService) {
    this.loadBannedIps();
  }

  private async loadBannedIps() {
    try {
      const record = await this.prisma.setting.findUnique({
        where: { key: 'banned_ips' },
      });
      if (record?.value) {
        const list: BannedIpEntry[] = JSON.parse(record.value);
        if (Array.isArray(list)) {
          for (const item of list) {
            this.bannedIpsMap.set(item.ip, item);
          }
        }
      }
    } catch (e: any) {
      this.logger.warn(`Could not load banned IPs: ${e.message}`);
    }
  }

  private async persistBannedIps() {
    try {
      const list = Array.from(this.bannedIpsMap.values());
      await this.prisma.setting.upsert({
        where: { key: 'banned_ips' },
        create: { key: 'banned_ips', value: JSON.stringify(list) },
        update: { value: JSON.stringify(list) },
      });
    } catch (e: any) {
      this.logger.error(`Failed to persist banned IPs: ${e.message}`);
    }
  }

  isIpBanned(ip: string): boolean {
    if (!ip) return false;
    const cleanIp = ip.replace(/^::ffff:/, '').trim();
    return this.bannedIpsMap.has(cleanIp) || this.bannedIpsMap.has(ip);
  }

  getBannedIps(): BannedIpEntry[] {
    return Array.from(this.bannedIpsMap.values());
  }

  async banIp(ip: string, reason: string = 'Administrative ban / DDoS mitigation', bannedBy: string = 'admin'): Promise<BannedIpEntry> {
    const cleanIp = ip.replace(/^::ffff:/, '').trim();
    const entry: BannedIpEntry = {
      ip: cleanIp,
      reason,
      bannedAt: new Date().toISOString(),
      bannedBy,
    };
    this.bannedIpsMap.set(cleanIp, entry);
    await this.persistBannedIps();
    this.logger.warn(`🛡️ Banned IP: ${cleanIp} (Reason: ${reason})`);
    return entry;
  }

  async unbanIp(ip: string): Promise<boolean> {
    const cleanIp = ip.replace(/^::ffff:/, '').trim();
    const removed = this.bannedIpsMap.delete(cleanIp) || this.bannedIpsMap.delete(ip);
    if (removed) {
      await this.persistBannedIps();
      this.logger.log(`🛡️ Unbanned IP: ${cleanIp}`);
    }
    return removed;
  }

  /**
   * Tracks an incoming request, tests for DDoS volume, Layer 7 exploit scans, and records to the live monitor
   */
  recordAndFilterRequest(ip: string, method: string, path: string, userAgent: string = ''): { allowed: boolean; reason?: string } {
    const cleanIp = ip ? ip.replace(/^::ffff:/, '').trim() : '127.0.0.1';

    // 1. IP Ban check
    if (this.isIpBanned(cleanIp)) {
      return { allowed: false, reason: 'Your IP address has been permanently blocked by the firewall.' };
    }

    // 2. Layer 7 Exploit & Malicious Bot Defense
    const lowerPath = (path || '').toLowerCase();
    const lowerUa = (userAgent || '').toLowerCase();
    const maliciousProbes = [
      '/.env',
      '/.git',
      '/wp-login.php',
      '/xmlrpc.php',
      '/phpmyadmin',
      '/pma',
      '/cgi-bin/',
      '/etc/passwd',
      'win.ini',
      '/.aws/',
      '/actuator/',
      '/telescope/',
      '/server-status',
    ];
    const hostileScanners = [
      'sqlmap',
      'nikto',
      'masscan',
      'zgrab',
      'gobuster',
      'dirbuster',
      'nuclei',
      'nmap',
    ];

    const matchedProbe = maliciousProbes.find(p => lowerPath.includes(p));
    const matchedScanner = hostileScanners.find(s => lowerUa.includes(s));

    if (matchedProbe || matchedScanner) {
      const banReason = matchedProbe
        ? `L7 Exploit Scanner Ban: malicious probe for ${matchedProbe}`
        : `L7 Hostile Bot Ban: scanner user-agent ${matchedScanner}`;
      this.banIp(cleanIp, banReason, 'Layer 7 Defense Engine').catch(() => {});
      this.logger.warn(`🛑 Banned attacker IP ${cleanIp}: ${banReason}`);
      return { allowed: false, reason: 'Request blocked and IP banned by Layer 7 DDoS & Exploit Protection.' };
    }

    // 3. DDoS Burst & Volume Rate Limiting
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window
    const burstStart = now - 2000; // 2 second burst window

    let timestamps = this.ipRequestTimestamps.get(cleanIp) || [];
    timestamps = timestamps.filter(t => t > windowStart);
    timestamps.push(now);
    this.ipRequestTimestamps.set(cleanIp, timestamps);

    const burstCount = timestamps.filter(t => t > burstStart).length;
    if (burstCount > 35) {
      this.banIp(cleanIp, 'L7 DDoS Burst Flood: >35 req in 2 seconds', 'Layer 7 Defense Engine').catch(() => {});
      return { allowed: false, reason: 'High-speed request burst flood detected. IP address banned.' };
    }

    // If rate limit exceeded, block request and ban repeat floods
    if (timestamps.length > this.ddosMaxRequestsPerMinute) {
      this.banIp(cleanIp, `L7 DDoS Sustained Flood: >${this.ddosMaxRequestsPerMinute} req/min`, 'Layer 7 Defense Engine').catch(() => {});
      this.logger.warn(`⚠️ High-rate request traffic detected from ${cleanIp}: ${timestamps.length} req/min`);
      return {
        allowed: false,
        reason: 'Too many requests. Global rate limit exceeded and IP temporarily restricted.',
      };
    }

    return { allowed: true };
  }

  /**
   * Finalizes the request log with the response status code
   */
  logCompletedRequest(ip: string, method: string, path: string, status: number, userAgent: string = '') {
    const cleanIp = ip ? ip.replace(/^::ffff:/, '').trim() : '127.0.0.1';
    const entry: RequestLogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      ip: cleanIp,
      method,
      path,
      status,
      timestamp: new Date().toISOString(),
      userAgent: userAgent.substring(0, 150),
    };

    this.requestLog.unshift(entry);
    if (this.requestLog.length > this.maxLogEntries) {
      this.requestLog.pop();
    }
  }

  /**
   * Strict login brute-force rate limiter: max 5 attempts per minute per IP
   */
  checkLoginRateLimit(ip: string) {
    const cleanIp = ip ? ip.replace(/^::ffff:/, '').trim() : '127.0.0.1';
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute

    let attempts = this.loginAttemptTimestamps.get(cleanIp) || [];
    attempts = attempts.filter(t => t > windowStart);

    if (attempts.length >= this.loginMaxAttemptsPerMinute) {
      const oldestAttempt = attempts[0] ?? now;
      const waitSeconds = Math.ceil((oldestAttempt + 60000 - now) / 1000);
      this.logger.warn(`🛑 Login brute-force rate limit hit for IP: ${cleanIp}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Too many login attempts. Please wait ${Math.max(1, waitSeconds)} seconds before trying again to prevent brute-force attacks.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    attempts.push(now);
    this.loginAttemptTimestamps.set(cleanIp, attempts);
  }

  /**
   * Reset login attempts on successful login
   */
  resetLoginAttempts(ip: string) {
    const cleanIp = ip ? ip.replace(/^::ffff:/, '').trim() : '127.0.0.1';
    this.loginAttemptTimestamps.delete(cleanIp);
  }

  getRecentRequests(): RequestLogEntry[] {
    return this.requestLog;
  }

  getSecurityStats() {
    const now = Date.now();
    const oneMinAgo = now - 60000;

    let totalRecentRequests = 0;
    const activeIps = new Set<string>();

    for (const [ip, timestamps] of this.ipRequestTimestamps.entries()) {
      const recent = timestamps.filter(t => t > oneMinAgo);
      if (recent.length > 0) {
        totalRecentRequests += recent.length;
        activeIps.add(ip);
      }
    }

    return {
      bannedIpsCount: this.bannedIpsMap.size,
      activeIpsInLastMinute: activeIps.size,
      requestsInLastMinute: totalRecentRequests,
      maxRequestsPerMinuteLimit: this.ddosMaxRequestsPerMinute,
      loginMaxAttemptsPerMinuteLimit: this.loginMaxAttemptsPerMinute,
      ddosProtectionActive: true,
    };
  }
}
