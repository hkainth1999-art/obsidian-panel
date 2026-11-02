import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { SecurityService } from './security.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('Admin Security & Firewall')
@ApiCookieAuth()
@UseGuards(SessionGuard, AdminGuard)
@Controller('api/admin/security')
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get live DDoS and firewall security statistics' })
  getStats() {
    return this.securityService.getSecurityStats();
  }

  @Get('requests')
  @ApiOperation({ summary: 'Get rolling live request activity log for all IPs' })
  getRequests() {
    const requests = this.securityService.getRecentRequests();
    // Return requests with indication if IP is banned
    return requests.map(r => ({
      ...r,
      isBanned: this.securityService.isIpBanned(r.ip),
    }));
  }

  @Get('banned-ips')
  @ApiOperation({ summary: 'List all currently banned IP addresses' })
  getBannedIps() {
    return this.securityService.getBannedIps();
  }

  @Post('ban-ip')
  @ApiOperation({ summary: 'Ban an IP address from accessing the panel' })
  async banIp(
    @Body() body: { ip: string; reason?: string },
    @Req() req: any,
  ) {
    const adminUsername = req.user?.username || 'admin';
    return this.securityService.banIp(
      body.ip,
      body.reason || 'Manual ban by administrator',
      adminUsername,
    );
  }

  @Delete('ban-ip/:ip')
  @ApiOperation({ summary: 'Unban an IP address' })
  async unbanIp(@Param('ip') ip: string) {
    const success = await this.securityService.unbanIp(ip);
    return { success, ip };
  }
}

