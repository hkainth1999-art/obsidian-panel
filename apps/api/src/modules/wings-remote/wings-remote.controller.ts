import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WingsNodeAuthGuard } from './guards/wings-node-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Wings Remote Controller
 *
 * Implements general Panel endpoints Wings calls:
 * - POST /api/remote/activity - Send activity logs from Wings
 */
@ApiTags('Wings Remote')
@ApiBearerAuth()
@UseGuards(WingsNodeAuthGuard)
@Controller('api/remote')
export class WingsRemoteController {
  private readonly logger = new Logger(WingsRemoteController.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * POST /api/remote/activity
   *
   * Wings sends activity logs for file operations and other server-side events.
   * These are ingested into our activity log system.
   */
  @Post('activity')
  @HttpCode(200)
  @ApiOperation({ summary: 'Receive activity logs from Wings' })
  async receiveActivityLogs(
    @Body() body: Array<{
      user: string;
      server: string;
      event: string;
      metadata: Record<string, unknown>;
      ip: string;
      timestamp: string;
    }>,
  ) {
    if (!Array.isArray(body) || body.length === 0) {
      return { processed: 0 };
    }

    // Batch insert activity logs, resolving user UUIDs
    const logs = [];
    for (const entry of body) {
      // Resolve user by UUID if provided
      let userId: number | null = null;
      if (entry.user) {
        const user = await this.prisma.user.findUnique({
          where: { uuid: entry.user },
          select: { id: true },
        });
        userId = user?.id ?? null;
      }

      // Resolve server by UUID if provided
      let serverId: number | null = null;
      if (entry.server) {
        const server = await this.prisma.server.findUnique({
          where: { uuid: entry.server },
          select: { id: true },
        });
        serverId = server?.id ?? null;
      }

      logs.push({
        userId,
        serverId,
        event: entry.event,
        properties: this.redactSecrets(entry.metadata),
        ip: entry.ip,
        timestamp: new Date(entry.timestamp),
      });
    }

    await this.prisma.activityLog.createMany({ data: logs as any });

    this.logger.debug(`Ingested ${logs.length} activity logs from Wings`);
    return { processed: logs.length };
  }

  /**
   * Redact potentially sensitive values from activity metadata.
   * Never log passwords, tokens, or full file contents.
   */
  private redactSecrets(metadata: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization', 'cookie'];
    const redacted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(metadata)) {
      if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
        redacted[key] = '[REDACTED]';
      } else if (typeof value === 'string' && value.length > 10000) {
        redacted[key] = `[TRUNCATED: ${value.length} chars]`;
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  }
}
