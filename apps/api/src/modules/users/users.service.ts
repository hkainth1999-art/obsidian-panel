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

    return {
      data: users,
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
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
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
    },
  ) {
    await this.getUserById(id);

    const updateData: any = {};
    if (dto.username) updateData.username = dto.username;
    if (dto.email) updateData.email = dto.email.toLowerCase();
    if (dto.language) updateData.language = dto.language;
    if (typeof dto.isAdmin === 'boolean') updateData.isAdmin = dto.isAdmin;

    if (dto.password) {
      updateData.password = await argon2.hash(dto.password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
      });
    }

    return this.prisma.user.update({
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
