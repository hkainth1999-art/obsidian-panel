import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  Header,
  UseGuards,
  ParseIntPipe,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ApplicationApiGuard } from '../auth/guards/application-api.guard';
import { NodesService } from './nodes.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  fractalItem,
  fractalList,
  transformNode,
  transformAllocation,
} from '../application-api/application-transformers';

@ApiTags('Application API - Nodes')
@ApiBearerAuth()
@Controller('api/application/nodes')
export class ApplicationNodesController {
  constructor(
    private readonly nodesService: NodesService,
    private readonly prisma: PrismaService,
  ) { }

  @Get()
  @UseGuards(ApplicationApiGuard)
  @ApiOperation({ summary: 'List all nodes (Application API)' })
  async listNodes(
    @Query('page') pageStr?: string,
    @Query('per_page') perPageStr?: string,
    @Query('filter[name]') filterName?: string,
    @Query('filter[fqdn]') filterFqdn?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(perPageStr || '50', 10) || 50));
    const skip = (page - 1) * perPage;

    const where: any = {};
    if (filterName) where.name = { contains: filterName, mode: 'insensitive' };
    if (filterFqdn) where.fqdn = { contains: filterFqdn, mode: 'insensitive' };

    const [total, nodes] = await Promise.all([
      this.prisma.node.count({ where }),
      this.prisma.node.findMany({
        where,
        skip,
        take: perPage,
        include: {
          location: true,
          _count: { select: { servers: true, allocations: true } },
        },
        orderBy: { id: 'asc' },
      }),
    ]);

    return fractalList('node', nodes.map(transformNode), total, page, perPage);
  }

  @Get(':id')
  @UseGuards(ApplicationApiGuard)
  @ApiOperation({ summary: 'Get details for a specific node' })
  async getNode(@Param('id', ParseIntPipe) id: number) {
    const node = await this.prisma.node.findUnique({
      where: { id },
      include: {
        location: true,
        _count: { select: { servers: true, allocations: true } },
      },
    });

    if (!node) throw new NotFoundException('Node not found');
    return fractalItem('node', transformNode(node));
  }

  @Post()
  @UseGuards(ApplicationApiGuard)
  @ApiOperation({ summary: 'Create a new node' })
  async createNode(@Body() body: any) {
    const name = body.name?.trim();
    const fqdn = body.fqdn?.trim();
    const locationId = Number(body.location_id || body.locationId);

    if (!name || !fqdn || !locationId) {
      throw new BadRequestException('name, fqdn, and location_id are required fields');
    }

    const created = await this.nodesService.createNode({
      name,
      description: body.description,
      locationId,
      fqdn,
      scheme: body.scheme === 'http' ? 'http' : 'https',
      behindProxy: Boolean(body.behind_proxy ?? body.behindProxy),
      memory: Number(body.memory || 1024),
      memoryOverallocate: Number(body.memory_overallocate || 0),
      disk: Number(body.disk || 10240),
      diskOverallocate: Number(body.disk_overallocate || 0),
      uploadSize: Number(body.upload_size || 100),
      daemonPort: Number(body.daemon_listen || body.daemonPort || 8080),
      daemonSftpPort: Number(body.daemon_sftp || body.daemonSftpPort || 2022),
      daemonBase: body.daemon_base || body.daemonBase || '/var/lib/pterodactyl/volumes',
    });

    const fullNode = await this.prisma.node.findUnique({
      where: { id: created.id },
      include: {
        location: true,
        _count: { select: { servers: true, allocations: true } },
      },
    });

    return fractalItem('node', transformNode(fullNode));
  }

  @Patch(':id')
  @UseGuards(ApplicationApiGuard)
  @ApiOperation({ summary: 'Update an existing node' })
  async updateNode(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const updateDto: any = {};
    if (body.name) updateDto.name = body.name.trim();
    if (body.description !== undefined) updateDto.description = body.description;
    if (body.location_id || body.locationId) updateDto.locationId = Number(body.location_id || body.locationId);
    if (body.fqdn) updateDto.fqdn = body.fqdn.trim();
    if (body.scheme) updateDto.scheme = body.scheme;
    if (body.behind_proxy !== undefined) updateDto.behindProxy = Boolean(body.behind_proxy);
    if (body.maintenance_mode !== undefined) updateDto.maintenanceMode = Boolean(body.maintenance_mode);
    if (body.memory !== undefined) updateDto.memory = Number(body.memory);
    if (body.memory_overallocate !== undefined) updateDto.memoryOverallocate = Number(body.memory_overallocate);
    if (body.disk !== undefined) updateDto.disk = Number(body.disk);
    if (body.disk_overallocate !== undefined) updateDto.diskOverallocate = Number(body.disk_overallocate);
    if (body.upload_size !== undefined) updateDto.uploadSize = Number(body.upload_size);
    if (body.daemon_listen || body.daemonPort) updateDto.daemonPort = Number(body.daemon_listen || body.daemonPort);
    if (body.daemon_sftp || body.daemonSftpPort) updateDto.daemonSftpPort = Number(body.daemon_sftp || body.daemonSftpPort);
    if (body.daemon_base || body.daemonBase) updateDto.daemonBase = body.daemon_base || body.daemonBase;

    await this.nodesService.updateNode(id, updateDto);

    const fullNode = await this.prisma.node.findUnique({
      where: { id },
      include: {
        location: true,
        _count: { select: { servers: true, allocations: true } },
      },
    });

    return fractalItem('node', transformNode(fullNode));
  }

  @Delete(':id')
  @UseGuards(ApplicationApiGuard)
  @ApiOperation({ summary: 'Delete a node' })
  async deleteNode(@Param('id', ParseIntPipe) id: number) {
    await this.nodesService.deleteNode(id);
    return {};
  }

  // ─── Wings CLI / Deploy Script Endpoints ──────────────────────────────

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

  // ─── Node Allocations ───────────────────────────────────────────────────

  @Get(':id/allocations')
  @UseGuards(ApplicationApiGuard)
  @ApiOperation({ summary: 'List allocations for a node (Application API)' })
  async listNodeAllocations(
    @Param('id', ParseIntPipe) nodeId: number,
    @Query('page') pageStr?: string,
    @Query('per_page') perPageStr?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(perPageStr || '50', 10) || 50));
    const skip = (page - 1) * perPage;

    const [total, allocs] = await Promise.all([
      this.prisma.allocation.count({ where: { nodeId } }),
      this.prisma.allocation.findMany({
        where: { nodeId },
        skip,
        take: perPage,
        orderBy: [{ ip: 'asc' }, { port: 'asc' }],
      }),
    ]);

    return fractalList('allocation', allocs.map(transformAllocation), total, page, perPage);
  }

  @Post(':id/allocations')
  @UseGuards(ApplicationApiGuard)
  @ApiOperation({ summary: 'Create allocations for a node' })
  async createNodeAllocations(
    @Param('id', ParseIntPipe) nodeId: number,
    @Body() body: any,
  ) {
    const ip = body.ip?.trim();
    const ports = Array.isArray(body.ports) ? body.ports.map(String) : [];
    const alias = body.alias?.trim() || null;

    if (!ip || ports.length === 0) {
      throw new BadRequestException('ip and ports array are required');
    }

    const node = await this.prisma.node.findUnique({ where: { id: nodeId } });
    if (!node) throw new NotFoundException('Node not found');

    const portsToCreate = new Set<number>();
    for (const portEntry of ports) {
      if (portEntry.includes('-')) {
        const [startStr = '', endStr = ''] = portEntry.split('-');
        const start = parseInt(startStr.trim(), 10);
        const end = parseInt(endStr.trim(), 10);
        if (isNaN(start) || isNaN(end) || start < 1024 || end > 65535 || start > end) {
          throw new BadRequestException(`Invalid port range: ${portEntry}`);
        }
        for (let p = start; p <= end; p++) portsToCreate.add(p);
      } else {
        const port = parseInt(portEntry.trim(), 10);
        if (isNaN(port) || port < 1024 || port > 65535) {
          throw new BadRequestException(`Invalid port: ${portEntry}`);
        }
        portsToCreate.add(port);
      }
    }

    const createdAllocations = await this.prisma.$transaction(
      Array.from(portsToCreate).map((port) =>
        this.prisma.allocation.upsert({
          where: {
            nodeId_ip_port: { nodeId, ip, port },
          },
          update: { alias },
          create: { nodeId, ip, port, alias },
        }),
      ),
    );

    return fractalList('allocation', createdAllocations.map(transformAllocation));
  }

  @Delete(':id/allocations/:allocationId')
  @UseGuards(ApplicationApiGuard)
  @ApiOperation({ summary: 'Delete an allocation from a node' })
  async deleteNodeAllocation(
    @Param('id', ParseIntPipe) nodeId: number,
    @Param('allocationId', ParseIntPipe) allocationId: number,
  ) {
    const alloc = await this.prisma.allocation.findFirst({
      where: { id: allocationId, nodeId },
    });

    if (!alloc) throw new NotFoundException('Allocation not found on this node');
    if (alloc.serverId) {
      throw new BadRequestException('Cannot delete an allocation that is assigned to a server');
    }

    await this.prisma.allocation.delete({ where: { id: allocationId } });
    return {};
  }
}
