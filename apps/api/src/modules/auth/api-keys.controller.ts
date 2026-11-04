import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { SessionGuard } from './guards/session.guard';
import { AdminGuard } from './guards/admin.guard';

@ApiTags('Admin Application API Keys')
@ApiCookieAuth()
@UseGuards(SessionGuard, AdminGuard)
@Controller('api/admin/api-keys')
export class AdminApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  @ApiOperation({ summary: 'List all Application API keys (ptla_...)' })
  async listKeys() {
    return this.apiKeysService.listApplicationKeys();
  }

  @Post()
  @ApiOperation({ summary: 'Generate a new Application API key (ptla_...)' })
  async createKey(
    @Req() req: any,
    @Body() body: { description: string; allowedIps?: string[] },
  ) {
    return this.apiKeysService.createApplicationKey(
      req.user.id,
      body.description,
      body.allowedIps || [],
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke an Application API key' })
  async deleteKey(@Param('id', ParseIntPipe) id: number) {
    return this.apiKeysService.deleteApplicationKey(id);
  }
}

@ApiTags('Account Client API Keys')
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller('api/account/api-keys')
export class AccountApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  @ApiOperation({ summary: 'List personal Client API keys (ptlc_...)' })
  async listKeys(@Req() req: any) {
    return this.apiKeysService.listAccountKeys(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Generate a new Client API key (ptlc_...)' })
  async createKey(
    @Req() req: any,
    @Body() body: { description: string; allowedIps?: string[] },
  ) {
    return this.apiKeysService.createAccountKey(
      req.user.id,
      body.description,
      body.allowedIps || [],
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke a Client API key' })
  async deleteKey(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.apiKeysService.deleteAccountKey(req.user.id, id);
  }
}

