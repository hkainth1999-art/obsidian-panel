import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ApplicationApiGuard } from '../auth/guards/application-api.guard';
import { PrismaService } from '../../prisma/prisma.service';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import {
  fractalItem,
  fractalList,
  transformUser,
} from './application-transformers';

@ApiTags('Application API - Users')
@ApiBearerAuth()
@UseGuards(ApplicationApiGuard)
@Controller('api/application/users')
export class ApplicationUsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List all panel users (Application API)' })
  async listUsers(
    @Query('page') pageStr?: string,
    @Query('per_page') perPageStr?: string,
    @Query('filter[email]') filterEmail?: string,
    @Query('filter[username]') filterUsername?: string,
    @Query('search') search?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(perPageStr || '50', 10) || 50));
    const skip = (page - 1) * perPage;

    const where: any = {};
    if (filterEmail) where.email = { contains: filterEmail, mode: 'insensitive' };
    if (filterUsername) where.username = { contains: filterUsername, mode: 'insensitive' };
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { id: 'asc' },
      }),
    ]);

    return fractalList('user', users.map(transformUser), total, page, perPage);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details for a specific user' })
  async getUser(@Param('id', ParseIntPipe) id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return fractalItem('user', transformUser(user));
  }

  @Get('external/:externalId')
  @ApiOperation({ summary: 'Get details for a user by external ID' })
  async getUserByExternalId(@Param('externalId') externalId: string) {
    const user = await this.prisma.user.findFirst({
      where: { externalId },
    });
    if (!user) throw new NotFoundException('User with specified external_id not found');
    return fractalItem('user', transformUser(user));
  }

  @Post()
  @ApiOperation({ summary: 'Create a new panel user' })
  async createUser(@Body() body: any) {
    const email = body.email?.trim()?.toLowerCase();
    const username = body.username?.trim();
    const firstName = body.first_name?.trim() || username;
    const lastName = body.last_name?.trim() || '';
    const externalId = body.external_id ? String(body.external_id).trim() : null;
    const rootAdmin = Boolean(body.root_admin);
    const password = body.password || crypto.randomBytes(12).toString('base64url');

    if (!email || !username) {
      throw new BadRequestException('email and username are required fields');
    }

    // Check unique email and username
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existing) {
      if (existing.email === email) throw new ConflictException('Email address already registered');
      throw new ConflictException('Username already taken');
    }

    const passwordHash = await argon2.hash(password);
    const user = await this.prisma.user.create({
      data: {
        uuid: crypto.randomUUID(),
        email,
        username,
        externalId,
        password: passwordHash,
        isAdmin: rootAdmin,
        language: body.language || 'en',
      },
    });

    return fractalItem('user', transformUser(user));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing user' })
  async updateUser(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const data: any = {};
    if (body.email) data.email = body.email.trim().toLowerCase();
    if (body.username) data.username = body.username.trim();
    if (body.external_id !== undefined) data.externalId = body.external_id ? String(body.external_id) : null;
    if (body.root_admin !== undefined) data.isAdmin = Boolean(body.root_admin);
    if (body.language) data.language = body.language;

    if (body.password) {
      data.password = await argon2.hash(body.password);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data,
    });

    return fractalItem('user', transformUser(updated));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user' })
  async deleteUser(@Param('id', ParseIntPipe) id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    // Prevent deletion if user owns servers
    const serverCount = await this.prisma.server.count({ where: { userId: id } });
    if (serverCount > 0) {
      throw new BadRequestException('Cannot delete user who still owns servers');
    }

    await this.prisma.user.delete({ where: { id } });
    return {};
  }
}

