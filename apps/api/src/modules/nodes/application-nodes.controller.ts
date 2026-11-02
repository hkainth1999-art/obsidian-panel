import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Header,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NodesService } from './nodes.service';

/**
 * Public/Daemon endpoints matching Pterodactyl Application API standard
 * Wings configure CLI connects here:
 * GET /api/application/nodes/:id/configuration with Authorization: Bearer <token>
 */
@ApiTags('Application Nodes')
@Controller('api/application/nodes')
export class ApplicationNodesController {
  constructor(private readonly nodesService: NodesService) {}

  @Get(':id/configuration')
  @ApiOperation({ summary: 'Upstream Wings configure CLI endpoint' })
  async getApplicationConfiguration(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Query('token') queryToken?: string,
  ) {
    const authHeader = req.headers['authorization'] || '';
    const bearerToken = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';
    const token = bearerToken || queryToken;
    return this.nodesService.getWingsApplicationConfiguration(id, token);
  }

  @Get(':id/configuration/raw')
  @Header('Content-Type', 'text/yaml; charset=utf-8')
  @ApiOperation({ summary: 'Raw YAML configuration for curl deploy script' })
  async getRawYaml(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Query('token') queryToken?: string,
  ) {
    const authHeader = req.headers['authorization'] || '';
    const bearerToken = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';
    const token = bearerToken || queryToken;
    return this.nodesService.getRawConfigurationYaml(id, token);
  }
}

