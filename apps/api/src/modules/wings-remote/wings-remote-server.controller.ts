import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WingsNodeAuthGuard } from './guards/wings-node-auth.guard';
import { WingsRemoteService } from './wings-remote.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Wings Remote Server Controller
 *
 * Implements the Panel endpoints that Wings v1.11.13 calls to:
 * - Fetch server configurations
 * - Report installation status
 * - Report archive status
 * - Report transfer status
 * - Reset server states on startup
 *
 * All routes are under /api/remote/servers/*
 * Authentication: Wings node Bearer token
 */
@ApiTags('Wings Remote')
@ApiBearerAuth()
@UseGuards(WingsNodeAuthGuard)
@Controller('api/remote/servers')
export class WingsRemoteServerController {
  private readonly logger = new Logger(WingsRemoteServerController.name);

  constructor(
    private readonly wingsRemoteService: WingsRemoteService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * GET /api/remote/servers
   *
   * Returns all servers assigned to the requesting node.
   * Wings calls this on startup to sync its local state.
   * Supports pagination via ?page=N&per_page=N query params.
   */
  @Get()
  @ApiOperation({ summary: 'List servers for the requesting node' })
  async list(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
  ) {
    const node = req.authenticatedNode;
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const perPageNum = Math.min(50, Math.max(1, parseInt(perPage ?? '50', 10) || 50));

    return this.wingsRemoteService.getServersForNode(node.id, pageNum, perPageNum);
  }

  /**
   * POST /api/remote/servers/reset
   *
   * Wings calls this after boot to reset any servers stuck in
   * 'installing' or 'restoring' state. This handles cases where
   * Wings was terminated during those operations.
   */
  @Post('reset')
  @HttpCode(204)
  @ApiOperation({ summary: 'Reset stuck server states for this node' })
  async resetState(@Req() req: any) {
    const node = req.authenticatedNode;

    await this.prisma.server.updateMany({
      where: {
        nodeId: node.id,
        status: { in: ['installing', 'restoring'] },
      },
      data: {
        status: null, // null = normal state
      },
    });

    this.logger.log(`Reset stuck server states for node ${node.id} (${node.name})`);
  }

  /**
   * GET /api/remote/servers/:uuid
   *
   * Returns the full server configuration for a specific server.
   * Wings calls this when it needs to (re)provision a server.
   */
  @Get(':uuid')
  @ApiOperation({ summary: 'Get server configuration' })
  async getConfiguration(@Req() req: any, @Param('uuid') uuid: string) {
    const node = req.authenticatedNode;
    const server = await this.wingsRemoteService.getServerForWings(uuid, node.id);

    if (!server) {
      throw new NotFoundException('The requested server does not exist on this node.');
    }

    return this.wingsRemoteService.buildServerConfiguration(server);
  }

  /**
   * GET /api/remote/servers/:uuid/install
   *
   * Returns the installation script for a server.
   * Wings calls this when provisioning a new server.
   */
  @Get(':uuid/install')
  @ApiOperation({ summary: 'Get server installation script' })
  async getInstallScript(@Req() req: any, @Param('uuid') uuid: string) {
    const node = req.authenticatedNode;
    const server = await this.prisma.server.findFirst({
      where: { uuid, nodeId: node.id },
      include: { egg: true },
    });

    if (!server) {
      throw new NotFoundException('The requested server does not exist on this node.');
    }

    return this.wingsRemoteService.buildInstallationScript(server.egg);
  }

  /**
   * POST /api/remote/servers/:uuid/install
   *
   * Wings calls this to report that server installation has completed.
   * Updates the server's installation status in the database.
   */
  @Post(':uuid/install')
  @HttpCode(204)
  @ApiOperation({ summary: 'Report server installation status' })
  async setInstallStatus(
    @Req() req: any,
    @Param('uuid') uuid: string,
    @Body() body: { successful: boolean; reinstall?: boolean },
  ) {
    const node = req.authenticatedNode;
    const server = await this.prisma.server.findFirst({
      where: { uuid, nodeId: node.id },
    });

    if (!server) {
      throw new NotFoundException('The requested server does not exist on this node.');
    }

    await this.prisma.server.update({
      where: { id: server.id },
      data: {
        status: body.successful ? null : 'install_failed',
        installedAt: body.successful ? new Date() : null,
      },
    });

    // Log the installation result
    await this.prisma.activityLog.create({
      data: {
        serverId: server.id,
        event: body.reinstall
          ? (body.successful ? 'server:reinstall.completed' : 'server:reinstall.failed')
          : (body.successful ? 'server:install.completed' : 'server:install.failed'),
        properties: {},
        ip: req.ip,
      },
    });

    this.logger.log(
      `Server ${server.uuid} installation ${body.successful ? 'completed' : 'failed'} ` +
      `(reinstall: ${body.reinstall ?? false})`,
    );
  }

  /**
   * POST /api/remote/servers/:uuid/archive
   *
   * Wings calls this to report that server archival (for transfer) has completed.
   */
  @Post(':uuid/archive')
  @HttpCode(204)
  @ApiOperation({ summary: 'Report server archive status' })
  async setArchiveStatus(
    @Req() req: any,
    @Param('uuid') uuid: string,
    @Body() body: { successful: boolean },
  ) {
    const node = req.authenticatedNode;
    const server = await this.prisma.server.findFirst({
      where: { uuid, nodeId: node.id },
    });

    if (!server) {
      throw new NotFoundException('The requested server does not exist on this node.');
    }

    // Update the transfer log
    await this.prisma.transferLog.updateMany({
      where: {
        serverId: server.id,
        phase: 'archiving',
      },
      data: {
        phase: body.successful ? 'archived' : 'failed',
        archived: body.successful,
      },
    });

    if (!body.successful) {
      await this.prisma.server.update({
        where: { id: server.id },
        data: { status: null }, // Reset from 'transferring'
      });
    }

    this.logger.log(
      `Server ${server.uuid} archival ${body.successful ? 'completed' : 'failed'}`,
    );
  }

  /**
   * POST /api/remote/servers/:uuid/transfer
   *
   * Wings calls this to report that server transfer has completed or failed.
   */
  @Post(':uuid/transfer')
  @HttpCode(204)
  @ApiOperation({ summary: 'Report server transfer status' })
  async setTransferStatus(
    @Req() req: any,
    @Param('uuid') uuid: string,
    @Body() body: { successful: boolean },
  ) {
    const node = req.authenticatedNode;
    const server = await this.prisma.server.findFirst({
      where: { uuid, nodeId: node.id },
    });

    if (!server) {
      throw new NotFoundException('The requested server does not exist on this node.');
    }

    if (body.successful) {
      // Update the server's node to the destination node
      const transfer = await this.prisma.transferLog.findFirst({
        where: {
          serverId: server.id,
          phase: { in: ['transferring', 'archived'] },
        },
        orderBy: { startedAt: 'desc' },
      });

      if (transfer) {
        await this.prisma.$transaction([
          this.prisma.server.update({
            where: { id: server.id },
            data: {
              nodeId: transfer.targetNodeId,
              allocationId: transfer.targetAllocationId,
              status: null,
            },
          }),
          this.prisma.transferLog.update({
            where: { id: transfer.id },
            data: {
              phase: 'completed',
              successful: true,
              completedAt: new Date(),
            },
          }),
        ]);
      }
    } else {
      await this.prisma.$transaction([
        this.prisma.server.update({
          where: { id: server.id },
          data: { status: null },
        }),
        this.prisma.transferLog.updateMany({
          where: {
            serverId: server.id,
            phase: { in: ['transferring', 'archived', 'archiving'] },
          },
          data: {
            phase: 'failed',
            successful: false,
            completedAt: new Date(),
          },
        }),
      ]);
    }

    this.logger.log(
      `Server ${server.uuid} transfer ${body.successful ? 'completed' : 'failed'}`,
    );
  }
}
