import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { SettingsService, PanelSettings } from './settings.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('Settings')
@Controller('api')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('settings/public')
  @ApiOperation({ summary: 'Get public branding settings (panel name, accent color)' })
  getPublicSettings() {
    return this.settingsService.getPublicSettings();
  }

  @Get('admin/settings')
  @UseGuards(SessionGuard, AdminGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get all panel administration settings' })
  getAllSettings() {
    return this.settingsService.getAllSettings();
  }

  @Patch('admin/settings')
  @UseGuards(SessionGuard, AdminGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Update panel administration settings' })
  updateSettings(@Body() dto: Partial<PanelSettings>) {
    return this.settingsService.updateSettings(dto);
  }
}

