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
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ApplicationApiGuard } from '../auth/guards/application-api.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { ServersService } from '../servers/servers.service';
import {
  fractalItem,
  fractalList,
  transformServer,
} from './application-transformers';

@ApiTags('Application API - Servers')
@ApiBearerAuth()
@UseGuards(ApplicationApiGuard)
@Controller('api/application/servers')
export class ApplicationServersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serversService: ServersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all servers (Application API)' })
  async listServers(
    @Query('page') pageStr?: string,
    @Query('per_page') perPageStr?: string,
    @Query('filter[name]') filterName?: string,
    @Query('filter[uuid]') filterUuid?: string,
    @Query('filter[external_id]') filterExternalId?: string,
    @Query('include') include?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(perPageStr || '50', 10) || 50));
    const skip = (page - 1) * perPage;

    const where: any = {};
    if (filterName) where.name = { contains: filterName, mode: 'insensitive' };
    if (filterUuid) where.uuid = { contains: filterUuid, mode: 'insensitive' };
    if (filterExternalId) where.externalId = filterExternalId;

    const [total, servers] = await Promise.all([
      this.prisma.server.count({ where }),
      this.prisma.server.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { id: 'asc' },
      }),
    ]);

    return fractalList('server', servers.map(transformServer), total, page, perPage);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details for a specific server by ID or UUID' })
  async getServer(@Param('id') idParam: string) {
    const isNum = /^\d+$/.test(idParam);
    const server = isNum
      ? await this.prisma.server.findUnique({ where: { id: parseInt(idParam, 10) } })
      : await this.prisma.server.findFirst({
          where: {
            OR: [
              { uuid: idParam },
              { uuidShort: idParam },
              { externalId: idParam },
            ],
          },
        });

    if (!server) throw new NotFoundException('Server not found');
    return fractalItem('server', transformServer(server));
  }

  @Get('external/:externalId')
  @ApiOperation({ summary: 'Get details for a server by external ID' })
  async getServerByExternalId(@Param('externalId') externalId: string) {
    const server = await this.prisma.server.findFirst({
      where: { externalId },
    });
    if (!server) throw new NotFoundException('Server with specified external_id not found');
    return fractalItem('server', transformServer(server));
  }

  @Post()
  @ApiOperation({ summary: 'Create and deploy a new server container' })
  async createServer(@Body() body: any) {
    const name = body.name?.trim();
    if (!name) throw new BadRequestException('name is required');

    const userId = Number(body.user || body.owner_id || body.ownerId);
    if (!userId || isNaN(userId)) throw new BadRequestException('user (owner ID) is required');

    const eggId = Number(body.egg || body.egg_id || body.eggId);
    if (!eggId || isNaN(eggId)) throw new BadRequestException('egg is required');

    const egg = await this.prisma.egg.findUnique({
      where: { id: eggId },
      include: { nest: true },
    });
    if (!egg) throw new BadRequestException(`Egg ${eggId} not found`);

    const nestId = Number(body.nest || body.nest_id || egg.nestId);

    // Resolve primary allocation and hosting node
    let allocationId: number | null = null;
    let nodeId: number | null = null;

    if (body.allocation?.default) {
      allocationId = Number(body.allocation.default);
    } else if (body.allocation_id || body.allocationId) {
      allocationId = Number(body.allocation_id || body.allocationId);
    }

    if (allocationId) {
      const alloc = await this.prisma.allocation.findUnique({ where: { id: allocationId } });
      if (!alloc) throw new BadRequestException(`Allocation ${allocationId} not found`);
      if (alloc.serverId) throw new BadRequestException(`Allocation ${allocationId} is already in use`);
      nodeId = alloc.nodeId;
    } else {
      // Auto-deploy to specified location or first node with available allocation
      const locationIds: number[] = Array.isArray(body.deploy?.locations)
        ? body.deploy.locations.map(Number)
        : [];

      const allocWhere: any = { serverId: null };
      if (locationIds.length > 0) {
        allocWhere.node = { locationId: { in: locationIds } };
      }

      const availableAlloc = await this.prisma.allocation.findFirst({
        where: allocWhere,
        include: { node: true },
        orderBy: { id: 'asc' },
      });

      if (!availableAlloc) {
        throw new BadRequestException('No free allocations available in the requested location or nodes');
      }

      allocationId = availableAlloc.id;
      nodeId = availableAlloc.nodeId;
    }

    if (!nodeId) throw new BadRequestException('Unable to resolve hosting node');

    const limits = body.limits || {};
    const memory = Number(limits.memory ?? body.memory ?? 1024);
    const swap = Number(limits.swap ?? body.swap ?? 0);
    const disk = Number(limits.disk ?? body.disk ?? 5120);
    const io = Number(limits.io ?? body.io ?? 500);
    const cpu = Number(limits.cpu ?? body.cpu ?? 100);
    const threads = limits.threads ? String(limits.threads) : undefined;

    const featureLimits = body.feature_limits || {};
    const databases = Number(featureLimits.databases ?? body.databases ?? 0);
    const allocationsLimit = Number(featureLimits.allocations ?? body.allocations ?? 1);
    const backups = Number(featureLimits.backups ?? body.backups ?? 0);

    const firstEggImage = Array.isArray(egg.dockerImages)
      ? String(egg.dockerImages[0])
      : typeof egg.dockerImages === 'object' && egg.dockerImages !== null
        ? String(Object.values(egg.dockerImages as Record<string, any>)[0])
        : null;
    const dockerImage = body.docker_image || body.image || firstEggImage || 'ghcr.io/pterodactyl/yolks:java_17';
    const startup = body.startup || egg.startup;
    const description = body.description || '';

    const created = await this.serversService.createServer({
      name,
      description,
      ownerId: userId,
      nodeId,
      allocationId,
      eggId,
      nestId,
      dockerImage,
      startup,
      memory,
      swap,
      disk,
      io,
      cpu,
      threads,
      databases,
      allocationsLimit,
      backups,
    });

    // Update external_id if provided
    if (body.external_id) {
      await this.prisma.server.update({
        where: { id: created.id },
        data: { externalId: String(body.external_id).trim() },
      });
      (created as any).externalId = String(body.external_id).trim();
    }

    return fractalItem('server', transformServer(created));
  }

  @Patch(':id/details')
  @ApiOperation({ summary: 'Update server details (name, owner, external_id, description)' })
  async updateDetails(@Param('id') idParam: string, @Body() body: any) {
    const isNum = /^\d+$/.test(idParam);
    const server = isNum
      ? await this.prisma.server.findUnique({ where: { id: parseInt(idParam, 10) } })
      : await this.prisma.server.findFirst({ where: { OR: [{ uuid: idParam }, { externalId: idParam }] } });

    if (!server) throw new NotFoundException('Server not found');

    const updateData: any = {};
    if (body.name) updateData.name = body.name.trim();
    if (body.description !== undefined) updateData.description = body.description;
    if (body.external_id !== undefined) updateData.externalId = body.external_id ? String(body.external_id) : null;
    if (body.user) {
      const newOwner = await this.prisma.user.findUnique({ where: { id: Number(body.user) } });
      if (!newOwner) throw new BadRequestException(`User ${body.user} not found`);
      updateData.userId = newOwner.id;
    }

    const updated = await this.prisma.server.update({
      where: { id: server.id },
      data: updateData,
    });

    return fractalItem('server', transformServer(updated));
  }

  @Patch(':id/build')
  @ApiOperation({ summary: 'Update server build limits and allocation mapping' })
  async updateBuild(@Param('id') idParam: string, @Body() body: any) {
    const isNum = /^\d+$/.test(idParam);
    const server = isNum
      ? await this.prisma.server.findUnique({ where: { id: parseInt(idParam, 10) } })
      : await this.prisma.server.findFirst({ where: { OR: [{ uuid: idParam }, { externalId: idParam }] } });

    if (!server) throw new NotFoundException('Server not found');

    const limits = body.limits || {};
    const featureLimits = body.feature_limits || {};
    const updateData: any = {};

    if (limits.memory !== undefined) updateData.memory = Number(limits.memory);
    if (limits.swap !== undefined) updateData.swap = Number(limits.swap);
    if (limits.disk !== undefined) updateData.disk = Number(limits.disk);
    if (limits.io !== undefined) updateData.io = Number(limits.io);
    if (limits.cpu !== undefined) updateData.cpu = Number(limits.cpu);
    if (limits.threads !== undefined) updateData.threads = limits.threads ? String(limits.threads) : null;
    if (limits.oom_disabled !== undefined) updateData.oomDisabled = Boolean(limits.oom_disabled);

    if (featureLimits.databases !== undefined) updateData.databaseLimit = Number(featureLimits.databases);
    if (featureLimits.allocations !== undefined) updateData.allocationLimit = Number(featureLimits.allocations);
    if (featureLimits.backups !== undefined) updateData.backupLimit = Number(featureLimits.backups);

    if (body.allocation) {
      const primaryAllocId = Number(body.allocation);
      const alloc = await this.prisma.allocation.findFirst({
        where: { id: primaryAllocId, nodeId: server.nodeId },
      });
      if (alloc) {
        updateData.allocationId = alloc.id;
      }
    }

    const updated = await this.prisma.server.update({
      where: { id: server.id },
      data: updateData,
    });

    return fractalItem('server', transformServer(updated));
  }

  @Patch(':id/startup')
  @ApiOperation({ summary: 'Update server startup command, egg, image, and environment' })
  async updateStartup(@Param('id') idParam: string, @Body() body: any) {
    const isNum = /^\d+$/.test(idParam);
    const server = isNum
      ? await this.prisma.server.findUnique({ where: { id: parseInt(idParam, 10) } })
      : await this.prisma.server.findFirst({ where: { OR: [{ uuid: idParam }, { externalId: idParam }] } });

    if (!server) throw new NotFoundException('Server not found');

    const updateData: any = {};
    if (body.startup) updateData.startup = body.startup;
    if (body.docker_image || body.image) updateData.image = body.docker_image || body.image;
    if (body.egg) {
      const egg = await this.prisma.egg.findUnique({ where: { id: Number(body.egg) } });
      if (egg) {
        updateData.eggId = egg.id;
        updateData.nestId = egg.nestId;
      }
    }

    if (body.environment && typeof body.environment === 'object') {
      updateData.environment = body.environment;
    }

    const updated = await this.prisma.server.update({
      where: { id: server.id },
      data: updateData,
    });

    return fractalItem('server', transformServer(updated));
  }

  @Post(':id/suspend')
  @ApiOperation({ summary: 'Suspend server container' })
  async suspendServer(@Param('id') idParam: string) {
    const isNum = /^\d+$/.test(idParam);
    const server = isNum
      ? await this.prisma.server.findUnique({ where: { id: parseInt(idParam, 10) } })
      : await this.prisma.server.findFirst({ where: { OR: [{ uuid: idParam }, { externalId: idParam }] } });

    if (!server) throw new NotFoundException('Server not found');
    await this.serversService.suspendServer(server.uuid);
    return {};
  }

  @Post(':id/unsuspend')
  @ApiOperation({ summary: 'Unsuspend server container' })
  async unsuspendServer(@Param('id') idParam: string) {
    const isNum = /^\d+$/.test(idParam);
    const server = isNum
      ? await this.prisma.server.findUnique({ where: { id: parseInt(idParam, 10) } })
      : await this.prisma.server.findFirst({ where: { OR: [{ uuid: idParam }, { externalId: idParam }] } });

    if (!server) throw new NotFoundException('Server not found');
    await this.serversService.unsuspendServer(server.uuid);
    return {};
  }

  @Post(':id/reinstall')
  @ApiOperation({ summary: 'Trigger server reinstallation' })
  async reinstallServer(@Param('id') idParam: string) {
    const isNum = /^\d+$/.test(idParam);
    const server = isNum
      ? await this.prisma.server.findUnique({ where: { id: parseInt(idParam, 10) } })
      : await this.prisma.server.findFirst({ where: { OR: [{ uuid: idParam }, { externalId: idParam }] } });

    if (!server) throw new NotFoundException('Server not found');
    await this.serversService.reinstallServer(server.uuid);
    return {};
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete server container and allocations' })
  async deleteServer(@Param('id') idParam: string) {
    const isNum = /^\d+$/.test(idParam);
    const server = isNum
      ? await this.prisma.server.findUnique({ where: { id: parseInt(idParam, 10) } })
      : await this.prisma.server.findFirst({ where: { OR: [{ uuid: idParam }, { externalId: idParam }] } });

    if (!server) throw new NotFoundException('Server not found');
    await this.serversService.deleteServer(server.uuid);
    return {};
  }

  @Delete(':id/force')
  @ApiOperation({ summary: 'Force-delete server container immediately' })
  async forceDeleteServer(@Param('id') idParam: string) {
    return this.deleteServer(idParam);
  }
}

