import {
  Controller,
  Post,
  Body,
  Req,
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
import { Permission } from '@obsidian/permissions';

/**
 * Wings Remote SFTP Authentication Controller
 *
 * Implements POST /api/remote/sftp/auth
 *
 * When a user connects to Wings SFTP, Wings forwards credentials here.
 * Validates credentials and returns:
 * {
 *   server: server.uuid,
 *   user: user.uuid,
 *   permissions: string[]
 * }
 */
@ApiTags('Wings Remote')
@ApiBearerAuth()
@UseGuards(WingsNodeAuthGuard)
@Controller('api/remote/sftp')
export class WingsRemoteSftpController {
  private readonly logger = new Logger(WingsRemoteSftpController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Post('auth')
  @HttpCode(200)
  @ApiOperation({ summary: 'Authenticate SFTP credentials' })
  async authenticate(
    @Req() req: any,
    @Body()
    body: {
      type: 'password' | 'public_key';
      username: string;
      password?: string;
      ip: string;
      session_id?: string;
    },
  ) {
    if (body.type === 'public_key') {
      throw new BadRequestException(
        'Public key SFTP authentication is not yet supported. Use password authentication.',
      );
    }

    if (!body.username || !body.password) {
      throw new UnauthorizedException('Username and password are required.');
    }

    const callingNode = req.authenticatedNode;

    // Parse username format: user.server_identifier
    const connection = this.parseUsername(body.username.trim());

    // Find the user by username or email
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: connection.username, mode: 'insensitive' } },
          { email: { equals: connection.username, mode: 'insensitive' } },
        ],
      },
    });

    if (!user) {
      this.logger.warn(`SFTP auth failed: user "${connection.username}" not found`);
      throw new UnauthorizedException('Invalid credentials.');
    }

    // Verify password safely
    let passwordValid = false;
    try {
      passwordValid = await verify(user.password, body.password);
    } catch (err: any) {
      this.logger.warn(`SFTP password verification error for user "${user.username}": ${err.message}`);
    }

    if (!passwordValid) {
      this.prisma.activityLog
        .create({
          data: {
            userId: user.id,
            event: 'auth:sftp.fail',
            properties: { reason: 'bad_password' },
            ip: body.ip || '0.0.0.0',
          },
        })
        .catch(() => {});

      this.logger.warn(`SFTP auth failed: invalid password for user "${user.username}" from ${body.ip}`);
      throw new UnauthorizedException('Invalid credentials.');
    }

    // Resolve target server
    let server: any = null;
    if (connection.server) {
      server = await this.prisma.server.findFirst({
        where: {
          OR: [
            { uuidShort: connection.server },
            { uuidShort: connection.server.substring(0, 8) },
            ...(connection.server.length === 36 ? [{ uuid: connection.server }] : []),
          ],
        },
        include: {
          subusers: {
            where: { userId: user.id },
          },
        },
      });
    } else {
      // User didn't specify server identifier in username (just typed their username)
      // Check if user has only 1 server on this node
      const userServers = await this.prisma.server.findMany({
        where: {
          nodeId: callingNode?.id,
          OR: [{ userId: user.id }, { subusers: { some: { userId: user.id } } }],
        },
        include: {
          subusers: {
            where: { userId: user.id },
          },
        },
        take: 2,
      });

      if (userServers.length === 1) {
        server = userServers[0];
      } else if (userServers.length > 1) {
        throw new BadRequestException(
          `You have multiple servers on this node. Please specify which server in your SFTP username: ${user.username}.<server_identifier>`,
        );
      }
    }

    if (!server) {
      this.logger.warn(`SFTP auth failed: server "${connection.server}" not found for user "${user.username}"`);
      throw new BadRequestException('The requested server was not found on this node.');
    }

    // Check if the server is suspended
    if (server.status === 'suspended') {
      throw new ForbiddenException('This server is currently suspended.');
    }

    // Full standard file permissions list recognized by Wings
    const ALL_FILE_PERMISSIONS = [
      '*',
      'file.*',
      'file.create',
      'file.read',
      'file.read-content',
      'file.update',
      'file.delete',
      'file.archive',
      'file.sftp',
    ];

    let permissions: string[];
    if (user.isAdmin || server.userId === user.id) {
      permissions = ALL_FILE_PERMISSIONS;
    } else if (server.subusers && server.subusers.length > 0) {
      const subuser = server.subusers[0];
      const hasSftp =
        subuser.permissions.includes(Permission.FILE_SFTP) ||
        subuser.permissions.includes('file.sftp') ||
        subuser.permissions.includes('*');

      if (!hasSftp) {
        throw new ForbiddenException(
          'You do not have permission to access this server via SFTP.',
        );
      }

      // Map subuser permissions
      permissions = subuser.permissions.includes('*') ? ALL_FILE_PERMISSIONS : subuser.permissions;
    } else {
      throw new ForbiddenException(
        'You do not have permission to access this server.',
      );
    }

    // Log successful SFTP authentication safely (non-blocking)
    this.prisma.activityLog
      .create({
        data: {
          userId: user.id,
          serverId: server.id,
          event: 'auth:sftp.success',
          properties: {},
          ip: body.ip || '0.0.0.0',
        },
      })
      .catch(() => {});

    this.logger.log(`✅ SFTP login success: ${user.username} -> server ${server.uuidShort} (${server.name})`);

    // SftpAuthResponse struct in Wings:
    // type SftpAuthResponse struct { Server string, User string, Permissions []string }
    return {
      server: server.uuid,
      user: user.uuid,
      username: user.username,
      permissions,
    };
  }

  /**
   * Parse SFTP username in the format "user.server_identifier"
   * Handles:
   * - "admin.705b36d4" -> user: "admin", server: "705b36d4"
   * - "admin.705b36d4-7d84-4009-a4ef-3bbc1b8e5fb3" -> user: "admin", server: "705b36d4-7d84-4009-a4ef-3bbc1b8e5fb3"
   * - "admin@example.com.705b36d4" -> user: "admin@example.com", server: "705b36d4"
   * - "admin" -> user: "admin", server: ""
   */
  private parseUsername(username: string): { username: string; server: string } {
    const parts = username.split('.');
    if (parts.length < 2) {
      return { username, server: '' };
    }

    const server = parts.pop()!;
    const user = parts.join('.');

    return { username: user, server };
  }
}
