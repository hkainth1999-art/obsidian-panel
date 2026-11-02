import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  Logger,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WingsNodeAuthGuard } from './guards/wings-node-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { verify } from 'argon2';
import { hasPermission, Permission } from '@obsidian/permissions';

/**
 * Wings Remote SFTP Authentication Controller
 *
 * Implements POST /api/remote/sftp/auth
 *
 * When a user connects to Wings SFTP, Wings forwards the credentials
 * to this endpoint for validation. The Panel authenticates the user
 * and returns the server UUID and applicable permissions.
 *
 * Username format: <username>.<server_identifier>
 * where server_identifier is the first 8 chars of the server UUID.
 */
@ApiTags('Wings Remote')
@ApiBearerAuth()
@UseGuards(WingsNodeAuthGuard)
@Controller('api/remote/sftp')
export class WingsRemoteSftpController {
  private readonly logger = new Logger(WingsRemoteSftpController.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * POST /api/remote/sftp/auth
   *
   * Validates SFTP credentials sent by Wings. Supports password authentication.
   * Public key authentication is defined in the protocol but requires
   * stored public keys in the user model (not yet implemented — documented limitation).
   */
  @Post('auth')
  @HttpCode(200)
  @ApiOperation({ summary: 'Authenticate SFTP credentials' })
  async authenticate(
    @Body() body: {
      type: 'password' | 'public_key';
      username: string;
      password: string;
      ip: string;
      session_id?: string;
    },
  ) {
    if (body.type === 'public_key') {
      // Public key auth is in the protocol but not implemented yet.
      // Document as known limitation rather than silently fail.
      throw new BadRequestException(
        'Public key SFTP authentication is not yet supported. Use password authentication.',
      );
    }

    // Parse username format: user.server_id
    const connection = this.parseUsername(body.username);
    if (!connection.server) {
      throw new BadRequestException(
        'No valid server identifier was included in the request.',
      );
    }

    // Find the user
    const user = await this.prisma.user.findFirst({
      where: {
        username: { equals: connection.username, mode: 'insensitive' },
      },
    });

    if (!user) {
      this.logger.warn(`SFTP auth failed: user "${connection.username}" not found`);
      throw new UnauthorizedException('Invalid credentials.');
    }

    // Verify password using Argon2id
    const passwordValid = await verify(user.password, body.password);
    if (!passwordValid) {
      // Log failed attempt
      await this.prisma.activityLog.create({
        data: {
          userId: user.id,
          event: 'auth:sftp.fail',
          properties: {},
          ip: body.ip,
        },
      });

      this.logger.warn(`SFTP auth failed: invalid password for user "${user.username}"`);
      throw new UnauthorizedException('Invalid credentials.');
    }

    // Find the server by short UUID identifier
    const server = await this.prisma.server.findFirst({
      where: {
        uuidShort: connection.server,
      },
      include: {
        subusers: {
          where: { userId: user.id },
        },
      },
    });

    if (!server) {
      throw new BadRequestException('The requested server was not found.');
    }

    // Check if the server is suspended
    if (server.status === 'suspended') {
      throw new ForbiddenException('This server is currently suspended.');
    }

    // Determine permissions
    let permissions: string[];

    if (user.isAdmin || server.userId === user.id) {
      // Admin or server owner gets all permissions
      permissions = ['*'];
    } else if (server.subusers.length > 0) {
      // Subuser — check for SFTP permission
      const subuser = server.subusers[0]!;
      if (!subuser.permissions.includes(Permission.FILE_SFTP) &&
          !subuser.permissions.includes('*')) {
        throw new ForbiddenException(
          'You do not have permission to access this server via SFTP.',
        );
      }
      permissions = subuser.permissions;
    } else {
      throw new ForbiddenException(
        'You do not have permission to access this server.',
      );
    }

    // Log successful SFTP authentication
    await this.prisma.activityLog.create({
      data: {
        userId: user.id,
        serverId: server.id,
        event: 'auth:sftp.success',
        properties: {},
        ip: body.ip,
      },
    });

    return {
      server: server.uuid,
      permissions,
    };
  }

  /**
   * Parse SFTP username in the format "user.server_id"
   */
  private parseUsername(username: string): { username: string; server: string } {
    const parts = username.split('.');
    if (parts.length < 2) {
      return { username, server: '' };
    }

    // The server ID is the last part (first 8 chars of UUID)
    const server = parts.pop()!;
    const user = parts.join('.');

    return { username: user, server };
  }
}
