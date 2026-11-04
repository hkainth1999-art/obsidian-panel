import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Application API Keys (Admin / ptla_...) ────────────────────────

  async listApplicationKeys() {
    const keys = await this.prisma.apiKey.findMany({
      where: {
        OR: [
          { keyType: 'application' },
          { identifier: { startsWith: 'ptla_' } },
        ],
      },
      include: {
        user: { select: { id: true, username: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return keys.map((k) => ({
      id: k.id,
      identifier: k.identifier,
      description: k.description,
      allowedIps: k.allowedIps,
      lastUsedAt: k.lastUsedAt,
      createdAt: k.createdAt,
      user: k.user,
    }));
  }

  async createApplicationKey(
    userId: number,
    description: string,
    allowedIps: string[] = [],
  ) {
    if (!description || !description.trim()) {
      throw new BadRequestException('A description for the API key is required.');
    }

    // Pterodactyl Application Key standard: ptla_ followed by secure random string
    const secretPart = crypto.randomBytes(24).toString('base64url');
    const secretToken = `ptla_${secretPart}`;
    const identifier = secretToken.substring(0, 16);
    const tokenHash = crypto.createHash('sha256').update(secretToken).digest('hex');

    const cleanIps = allowedIps
      .map((ip) => ip.trim())
      .filter((ip) => ip.length > 0);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        identifier,
        tokenHash,
        userId,
        keyType: 'application',
        description: description.trim(),
        allowedIps: cleanIps,
      },
      include: {
        user: { select: { id: true, username: true, email: true } },
      },
    });

    this.logger.log(`Created Application API key [${identifier}] for admin user #${userId} (${description})`);

    return {
      apiKey: {
        id: apiKey.id,
        identifier: apiKey.identifier,
        description: apiKey.description,
        allowedIps: apiKey.allowedIps,
        lastUsedAt: apiKey.lastUsedAt,
        createdAt: apiKey.createdAt,
        user: apiKey.user,
      },
      // Secret token is returned ONCE only upon creation
      secretToken,
    };
  }

  async deleteApplicationKey(id: number) {
    const key = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!key) throw new NotFoundException('API key not found');

    await this.prisma.apiKey.delete({ where: { id } });
    return { success: true, message: `Application API key ${key.identifier} revoked` };
  }

  // ─── Account / Client API Keys (User / ptlc_...) ───────────────────

  async listAccountKeys(userId: number) {
    const keys = await this.prisma.apiKey.findMany({
      where: {
        userId,
        AND: [
          { keyType: { not: 'application' } },
          { identifier: { not: { startsWith: 'ptla_' } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    return keys.map((k) => ({
      id: k.id,
      identifier: k.identifier,
      description: k.description,
      allowedIps: k.allowedIps,
      lastUsedAt: k.lastUsedAt,
      createdAt: k.createdAt,
    }));
  }

  async createAccountKey(
    userId: number,
    description: string,
    allowedIps: string[] = [],
  ) {
    if (!description || !description.trim()) {
      throw new BadRequestException('A description for the API key is required.');
    }

    // Pterodactyl Client Key standard: ptlc_ followed by secure random string
    const secretPart = crypto.randomBytes(24).toString('base64url');
    const secretToken = `ptlc_${secretPart}`;
    const identifier = secretToken.substring(0, 16);
    const tokenHash = crypto.createHash('sha256').update(secretToken).digest('hex');

    const cleanIps = allowedIps
      .map((ip) => ip.trim())
      .filter((ip) => ip.length > 0);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        identifier,
        tokenHash,
        userId,
        keyType: 'account',
        description: description.trim(),
        allowedIps: cleanIps,
      },
    });

    return {
      apiKey: {
        id: apiKey.id,
        identifier: apiKey.identifier,
        description: apiKey.description,
        allowedIps: apiKey.allowedIps,
        lastUsedAt: apiKey.lastUsedAt,
        createdAt: apiKey.createdAt,
      },
      secretToken,
    };
  }

  async deleteAccountKey(userId: number, id: number) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id, userId },
    });
    if (!key) throw new NotFoundException('API key not found');

    await this.prisma.apiKey.delete({ where: { id } });
    return { success: true, message: `Account API key ${key.identifier} revoked` };
  }
}

