import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { ServersService } from './servers.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('Admin Servers')
@ApiCookieAuth()
@UseGuards(SessionGuard, AdminGuard)
@Controller('api/admin/servers')
export class AdminServersController {
  constructor(private readonly serversService: ServersService) {}

  @Get()
  @ApiOperation({ summary: 'List all servers across all nodes for administration' })
  async listAllServers() {
    return this.serversService.listAllServersAdmin();
  }

  @Post()
  @ApiOperation({ summary: 'Provision a new server onto a Wings node' })
  async createServer(
    @Body()
    dto: {
      name: string;
      description?: string;
      ownerId: number;
      nodeId: number;
      allocationId: number;
      additionalAllocationIds?: number[];
      eggId: number;
      nestId: number;
      dockerImage?: string;
      startup?: string;
      environment?: Record<string, string>;
      memory: number;
      swap?: number;
      disk: number;
      io?: number;
      cpu: number;
      threads?: string;
      databases?: number;
      allocationsLimit?: number;
      backups?: number;
      startOnCompletion?: boolean;
    },
  ) {
    return this.serversService.createServer(dto);
  }

  @Post(':uuid/reinstall')
  @ApiOperation({ summary: 'Trigger server reinstallation' })
  async reinstallServer(@Param('uuid') uuid: string) {
    return this.serversService.reinstallServer(uuid);
  }

  @Post(':uuid/suspend')
  @ApiOperation({ summary: 'Suspend a server (kill container and prevent customer access)' })
  async suspendServer(@Param('uuid') uuid: string) {
    return this.serversService.suspendServer(uuid);
  }

  @Post(':uuid/unsuspend')
  @ApiOperation({ summary: 'Unsuspend a server (restore customer access)' })
  async unsuspendServer(@Param('uuid') uuid: string) {
    return this.serversService.unsuspendServer(uuid);
  }

  // ─── Allocations Management ─────────────────────────────────────────

  @Get(':uuid/allocations')
  @ApiOperation({ summary: 'List allocations for a server and available unassigned node allocations' })
  async getServerAllocations(@Param('uuid') uuid: string) {
    return this.serversService.getServerAllocations(uuid);
  }

  @Post(':uuid/allocations')
  @ApiOperation({ summary: 'Assign an additional allocation to an existing server' })
  async assignAllocation(
    @Param('uuid') uuid: string,
    @Body() body: { allocationId: number },
  ) {
    return this.serversService.assignAllocationToServer(uuid, Number(body.allocationId));
  }

  @Delete(':uuid/allocations/:allocationId')
  @ApiOperation({ summary: 'Unassign a secondary allocation from a server' })
  async unassignAllocation(
    @Param('uuid') uuid: string,
    @Param('allocationId', ParseIntPipe) allocationId: number,
  ) {
    return this.serversService.unassignAllocationFromServer(uuid, allocationId);
  }

  @Post(':uuid/allocations/:allocationId/primary')
  @ApiOperation({ summary: 'Set an allocation as the primary allocation for a server' })
  async setPrimaryAllocation(
    @Param('uuid') uuid: string,
    @Param('allocationId', ParseIntPipe) allocationId: number,
  ) {
    return this.serversService.setPrimaryAllocationForServer(uuid, allocationId);
  }

  @Delete(':uuid')
  @ApiOperation({ summary: 'Delete a server, its files, and container from Wings' })
  async deleteServer(@Param('uuid') uuid: string) {
    return this.serversService.deleteServer(uuid);
  }
}
