import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(page: number = 1, perPage: number = 25, search?: string) {
    const skip = (page - 1) * perPage;
    const cleanSearch = search?.trim();
    const where = cleanSearch
      ? {
          OR: [
            { username: { contains: cleanSearch, mode: 'insensitive' as const } },
            { email: { contains: cleanSearch, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { id: 'desc' },
        select: {
          id: true,
          uuid: true,
          username: true,
          email: true,
          isAdmin: true,
          language: true,
          totpEnabled: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              servers: true,
              subusers: true,
            },
          },
        },
      }),
    ]);

    const avatarKeys = users.map((u) => `user:avatar:${u.id}`);
    const avatarRecords = await this.prisma.setting.findMany({
      where: { key: { in: avatarKeys } },
    }).catch(() => []);
    const avatarMap = new Map(avatarRecords.map((r) => [r.key, r.value]));

    const mappedUsers = users.map((u) => ({
      ...u,
      avatarUrl: avatarMap.get(`user:avatar:${u.id}`) || null,
    }));

    return {
      data: mappedUsers,
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async getUserById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        uuid: true,
        username: true,
        email: true,
        isAdmin: true,
        language: true,
        totpEnabled: true,
        createdAt: true,
        updatedAt: true,
        servers: {
          select: {
            id: true,
            uuid: true,
            uuidShort: true,
            name: true,
            status: true,
            memory: true,
            cpu: true,
            disk: true,
            node: { select: { id: true, name: true, fqdn: true } },
            allocation: { select: { id: true, ip: true, port: true } },
          },
        },
        subusers: {
          include: {
            server: {
              select: {
                id: true,
                uuid: true,
                uuidShort: true,
                name: true,
                status: true,
                node: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const avatarRecord = await this.prisma.setting.findUnique({
      where: { key: `user:avatar:${id}` },
    }).catch(() => null);

    return {
      ...user,
      avatarUrl: avatarRecord?.value || null,
    };
  }

  async createUser(dto: {
    username: string;
    email: string;
    password: string;
    isAdmin?: boolean;
    language?: string;
  }) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: dto.username }, { email: dto.email.toLowerCase() }],
      },
    });

    if (existing) {
      throw new ConflictException('Username or email already in use');
    }

    const hashedPassword = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    return this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email.toLowerCase(),
        password: hashedPassword,
        isAdmin: dto.isAdmin ?? false,
        language: dto.language ?? 'en',
      },
      select: {
        id: true,
        uuid: true,
        username: true,
        email: true,
        isAdmin: true,
        language: true,
        createdAt: true,
      },
    });
  }

  async updateUser(
    id: number,
    dto: {
      username?: string;
      email?: string;
      password?: string;
      isAdmin?: boolean;
      language?: string;
      avatarUrl?: string | null;
    },
  ) {
    await this.getUserById(id);

    const updateData: any = {};
    if (dto.username) updateData.username = dto.username;
    if (dto.email) updateData.email = dto.email.toLowerCase();
    if (dto.language) updateData.language = dto.language;
    if (typeof dto.avatarUrl !== 'undefined') updateData.avatarUrl = dto.avatarUrl;
    if (typeof dto.isAdmin === 'boolean') updateData.isAdmin = dto.isAdmin;

    if (dto.password) {
      updateData.password = await argon2.hash(dto.password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
      });
    }

    if (typeof dto.avatarUrl !== 'undefined') {
      if (dto.avatarUrl) {
        await this.prisma.setting
          .upsert({
            where: { key: `user:avatar:${id}` },
            update: { value: dto.avatarUrl },
            create: { key: `user:avatar:${id}`, value: dto.avatarUrl },
          })
          .catch(() => {});
      } else {
        await this.prisma.setting
          .delete({ where: { key: `user:avatar:${id}` } })
          .catch(() => {});
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        uuid: true,
        username: true,
        email: true,
        isAdmin: true,
        language: true,
        updatedAt: true,
      },
    });

    const avatarRecord = await this.prisma.setting
      .findUnique({ where: { key: `user:avatar:${id}` } })
      .catch(() => null);

    return {
      ...updated,
      avatarUrl: avatarRecord?.value || null,
    };
  }

  async updateProfile(userId: number, dto: { avatarUrl?: string | null; language?: string }) {
    const updateData: any = {};
    if (dto.language) updateData.language = dto.language;

    if (typeof dto.avatarUrl !== 'undefined') {
      if (dto.avatarUrl) {
        await this.prisma.setting
          .upsert({
            where: { key: `user:avatar:${userId}` },
            update: { value: dto.avatarUrl },
            create: { key: `user:avatar:${userId}`, value: dto.avatarUrl },
          })
          .catch(() => {});
      } else {
        await this.prisma.setting
          .delete({ where: { key: `user:avatar:${userId}` } })
          .catch(() => {});
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        uuid: true,
        username: true,
        email: true,
        language: true,
        isAdmin: true,
      },
    });

    const avatarRecord = await this.prisma.setting
      .findUnique({ where: { key: `user:avatar:${userId}` } })
      .catch(() => null);

    return {
      ...updated,
      avatarUrl: avatarRecord?.value || null,
    };
  }

  async transferServerOwnership(serverIdOrUuid: string | number, newOwnerId: number) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: newOwnerId },
    });
    if (!targetUser) {
      throw new NotFoundException(`Target user ID ${newOwnerId} does not exist`);
    }

    const where = typeof serverIdOrUuid === 'number'
      ? { id: serverIdOrUuid }
      : (serverIdOrUuid.length === 36 ? { uuid: serverIdOrUuid } : { uuidShort: serverIdOrUuid });

    const server = await this.prisma.server.findFirst({
      where,
      include: { node: true },
    });
    if (!server) {
      throw new NotFoundException('Server not found');
    }

    // Remove new owner from subusers if they were previously a subuser
    await this.prisma.subuser.deleteMany({
      where: { serverId: server.id, userId: newOwnerId },
    }).catch(() => {});

    // Update server owner in database
    const updated = await this.prisma.server.update({
      where: { id: server.id },
      data: { userId: newOwnerId },
      include: {
        owner: { select: { id: true, username: true, email: true } },
        node: true,
      },
    });

    return {
      success: true,
      message: `Server "${server.name}" ownership transferred to ${targetUser.username}`,
      server: updated,
    };
  }

  async deleteUser(id: number, currentUserId: number) {
    if (id === currentUserId) {
      throw new BadRequestException('Cannot delete your own user account');
    }

    const user = await this.getUserById(id);

    // Check if user owns servers
    const serverCount = await this.prisma.server.count({
      where: { userId: id },
    });

    if (serverCount > 0) {
      throw new BadRequestException(
        `User owns ${serverCount} servers. Reassign or delete servers before deleting user.`,
      );
    }

    await this.prisma.user.delete({ where: { id } });
    return { success: true, message: `User ${user.username} deleted` };
  }

  // ─── Account Profile & Credentials Self-Service ─────────────────────

  async updateUsername(userId: number, newUsername: string, ip?: string) {
    const cleanUsername = newUsername?.trim();
    if (!cleanUsername || cleanUsername.length < 3) {
      throw new BadRequestException('Username must be at least 3 characters long.');
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
      throw new BadRequestException('Username can only contain letters, numbers, underscores, dots, and hyphens.');
    }

    const currentUser = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!currentUser) throw new NotFoundException('User not found.');

    if (currentUser.username.toLowerCase() === cleanUsername.toLowerCase()) {
      return currentUser;
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        username: { equals: cleanUsername, mode: 'insensitive' },
        NOT: { id: userId },
      },
    });

    if (existing) {
      throw new ConflictException(`Username '${cleanUsername}' is already taken.`);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { username: cleanUsername },
      select: {
        id: true,
        uuid: true,
        username: true,
        email: true,
        isAdmin: true,
        language: true,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        userId,
        event: 'account:username.updated',
        description: `Username changed from ${currentUser.username} to ${cleanUsername}`,
        ip: ip || null,
        properties: { oldUsername: currentUser.username, newUsername: cleanUsername },
      },
    }).catch(() => {});

    return updated;
  }

  async updateEmail(userId: number, dto: { email: string; currentPassword: string }, ip?: string) {
    const cleanEmail = dto.email?.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new BadRequestException('Please provide a valid email address.');
    }
    if (!dto.currentPassword) {
      throw new BadRequestException('Your current password is required to change your email address.');
    }

    const currentUser = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!currentUser) throw new NotFoundException('User not found.');

    // Verify current password
    const validPass = await argon2.verify(currentUser.password, dto.currentPassword);
    if (!validPass) {
      throw new BadRequestException('Incorrect current password.');
    }

    if (currentUser.email === cleanEmail) {
      return { success: true, message: 'Email is already set to this address.', email: cleanEmail };
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        email: cleanEmail,
        NOT: { id: userId },
      },
    });

    if (existing) {
      throw new ConflictException(`Email address '${cleanEmail}' is already registered to another account.`);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { email: cleanEmail },
      select: {
        id: true,
        uuid: true,
        username: true,
        email: true,
        isAdmin: true,
        language: true,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        userId,
        event: 'account:email.updated',
        description: `Email address changed to ${cleanEmail}`,
        ip: ip || null,
        properties: { oldEmail: currentUser.email, newEmail: cleanEmail },
      },
    }).catch(() => {});

    return {
      success: true,
      message: 'Email address updated successfully.',
      user: updated,
    };
  }

  async updatePassword(userId: number, dto: { currentPassword: string; newPassword: string }, ip?: string) {
    if (!dto.currentPassword) {
      throw new BadRequestException('Your current password is required.');
    }
    if (!dto.newPassword || dto.newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters long.');
    }

    const currentUser = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!currentUser) throw new NotFoundException('User not found.');

    // Verify current password
    const validPass = await argon2.verify(currentUser.password, dto.currentPassword);
    if (!validPass) {
      throw new BadRequestException('Incorrect current password.');
    }

    const newHash = await argon2.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: newHash },
    });

    await this.prisma.activityLog.create({
      data: {
        userId,
        event: 'account:password.updated',
        description: 'Account password changed successfully',
        ip: ip || null,
        properties: {},
      },
    }).catch(() => {});

    return {
      success: true,
      message: 'Password changed successfully.',
    };
  }

  async getActivity(userId: number, page: number = 1, perPage: number = 25, search?: string) {
    const skip = (page - 1) * perPage;
    const cleanSearch = search?.trim();

    // Query activity logs belonging to this user or servers owned by this user
    const where: any = {
      OR: [
        { userId },
        { server: { userId } },
      ],
    };

    if (cleanSearch) {
      where.AND = [
        {
          OR: [
            { event: { contains: cleanSearch, mode: 'insensitive' } },
            { description: { contains: cleanSearch, mode: 'insensitive' } },
            { ip: { contains: cleanSearch, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [total, logs] = await Promise.all([
      this.prisma.activityLog.count({ where }),
      this.prisma.activityLog.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { timestamp: 'desc' },
        include: {
          server: {
            select: { id: true, uuid: true, uuidShort: true, name: true },
          },
          user: {
            select: { id: true, username: true, email: true },
          },
        },
      }),
    ]);

    const mapped = logs.map((log) => ({
      id: String(log.id),
      event: log.event,
      description: log.description || this.formatEventDescription(log.event, log.properties),
      ip: log.ip,
      properties: log.properties,
      timestamp: log.timestamp.toISOString(),
      server: log.server,
      user: log.user,
    }));

    return {
      data: mapped,
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  private formatEventDescription(event: string, properties: any): string {
    switch (event) {
      case 'auth:login.success':
        return 'Logged in successfully';
      case 'auth:logout':
        return 'Logged out';
      case 'account:username.updated':
        return 'Changed account username';
      case 'account:email.updated':
        return 'Updated email address';
      case 'account:password.updated':
        return 'Changed account password';
      case 'account:apikey.created':
        return 'Generated a new API key';
      case 'account:apikey.deleted':
        return 'Revoked an API key';
      case 'server:power.start':
        return 'Sent start signal to server';
      case 'server:power.stop':
        return 'Sent graceful stop signal to server';
      case 'server:power.restart':
        return 'Sent restart signal to server';
      case 'server:power.kill':
        return 'Terminated server process';
      case 'server:console.command':
        return 'Dispatched console command';
      case 'server:backup.create':
        return 'Initiated server backup creation';
      case 'server:backup.delete':
        return 'Deleted server backup';
      case 'server:version.install':
        return `Installed version ${(properties as any)?.software || ''} ${(properties as any)?.version || ''}`;
      case 'backup:completed':
        return 'Server backup finished successfully';
      case 'backup:failed':
        return 'Server backup failed to complete';
      case 'backup:restore.completed':
        return 'Server backup restoration finished';
      default:
        return event.replace(/[:._]/g, ' ');
    }
  }
}
