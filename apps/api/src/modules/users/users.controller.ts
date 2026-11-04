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
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('Users')
@ApiCookieAuth()
@UseGuards(SessionGuard, AdminGuard)
@Controller('api/admin/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all users (paginated, searchable)' })
  async listUsers(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limit = perPage ? parseInt(perPage, 10) : 25;
    return this.usersService.listUsers(pageNum, limit, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user details by ID' })
  async getUser(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getUserById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  async createUser(
    @Body()
    dto: {
      username: string;
      email: string;
      password: string;
      isAdmin?: boolean;
      language?: string;
    },
  ) {
    return this.usersService.createUser(dto);
  }

  @Post('transfer-server')
  @ApiOperation({ summary: 'Transfer server ownership to another user' })
  async transferServer(
    @Body() body: { serverIdOrUuid: string | number; newOwnerId: number },
  ) {
    return this.usersService.transferServerOwnership(body.serverIdOrUuid, Number(body.newOwnerId));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing user' })
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    dto: {
      username?: string;
      email?: string;
      password?: string;
      isAdmin?: boolean;
      language?: string;
      avatarUrl?: string | null;
    },
  ) {
    return this.usersService.updateUser(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user' })
  async deleteUser(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.usersService.deleteUser(id, req.user.id);
  }
}

@ApiTags('User Profile')
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller('api/users')
export class UserProfileController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('profile')
  @ApiOperation({ summary: 'Update logged-in user profile (avatar, language)' })
  async updateProfile(
    @Req() req: any,
    @Body() dto: { avatarUrl?: string | null; language?: string },
  ) {
    return this.usersService.updateProfile(req.user.id, dto);
  }
}

@ApiTags('Account Self-Service')
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller('api/account')
export class AccountController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('username')
  @ApiOperation({ summary: 'Update username for the authenticated user' })
  async updateUsername(
    @Req() req: any,
    @Body() body: { username: string },
  ) {
    return this.usersService.updateUsername(req.user.id, body.username, req.ip);
  }

  @Patch('email')
  @ApiOperation({ summary: 'Update email address (requires current password)' })
  async updateEmail(
    @Req() req: any,
    @Body() body: { email: string; currentPassword: string },
  ) {
    return this.usersService.updateEmail(req.user.id, body, req.ip);
  }

  @Patch('password')
  @ApiOperation({ summary: 'Update password (requires current password)' })
  async updatePassword(
    @Req() req: any,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.usersService.updatePassword(req.user.id, body, req.ip);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get recent account and server activity logs' })
  async getActivity(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limit = perPage ? parseInt(perPage, 10) : 25;
    return this.usersService.getActivity(req.user.id, pageNum, limit, search);
  }
}
