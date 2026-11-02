import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(page: number = 1, perPage: number = 25, search?: string) {
    const skip = (page - 1) * perPage;
    const where = search
      ? {
          OR: [
            { username: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
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
}
