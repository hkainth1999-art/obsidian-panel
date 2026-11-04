import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { WingsRemoteService } from '../wings-remote/wings-remote.service';
import { AuthService } from '../auth/auth.service';
import { WingsClient } from '@obsidian/wings-adapter';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import { Readable } from 'stream';

// Maximum signed 32-bit integer supported by PostgreSQL INT4 (2,147,483,647 MiB = ~2 Petabytes)
const MAX_INT4 = 2147483647;

function clampInt4(val: any, fallback = 0, max = MAX_INT4): number {
  if (val === undefined || val === null || val === '') return fallback;
  const num = Number(val);
  if (isNaN(num)) return fallback;
  if (num > max) return max;
  if (num < 0) return 0;
  return Math.floor(num);
}

@Injectable()
export class ServersService {
  private readonly logger = new Logger(ServersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wingsRemoteService: WingsRemoteService,
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {
    // Periodic background sweep for automatic server suspensions (every 60 seconds)
    setInterval(() => {
      this.processAutoSuspensions().catch(() => {});
    }, 60000);
  }

  private static readonly stateCache = new Map<string, { status: string; ts: number }>();

  static setServerState(uuid: string, status: string) {
    ServersService.stateCache.set(uuid, { status, ts: Date.now() });
  }

  static getServerState(uuid: string): string | null {
    const entry = ServersService.stateCache.get(uuid);
    if (!entry) return null;
    if (Date.now() - entry.ts > 15 * 60 * 1000) {
      ServersService.stateCache.delete(uuid);
      return null;
    }
    return entry.status;
  }

  private getWingsClient(node: {
    scheme: string;
    fqdn: string;
    daemonPort: number;
    daemonToken: string;
  }): WingsClient {
    return new WingsClient({
      scheme: node.scheme as 'http' | 'https',
      fqdn: node.fqdn,
      daemonListen: node.daemonPort,
      daemonToken: node.daemonToken,
    });
  }

  // ─── Listing ───────────────────────────────────────────────────────

  async listAllServersAdmin() {
    const servers = await this.prisma.server.findMany({
      include: {
        node: {
          select: { id: true, name: true, fqdn: true, scheme: true, daemonPort: true },
        },
        allocation: {
          select: { id: true, ip: true, port: true, alias: true },
        },
        allocations: {
          select: { id: true, ip: true, port: true, alias: true },
        },
        egg: {
          select: { id: true, name: true },
        },
        nest: {
          select: { id: true, name: true },
        },
        owner: {
          select: { id: true, username: true, email: true },
        },
      },
      orderBy: { id: 'desc' },
    });

    return servers.map((s) => {
      const cached = ServersService.getServerState(s.uuid);
      const isSuspended = s.status === 'suspended';
      const suspendMatch = s.description?.match(/\[suspend:([^\]]+)\]/);
      const cleanDescription = (s.description || '').replace(/\s*\[suspend:[^\]]+\]\s*/g, '').trim();

      return {
        id: s.id,
        uuid: s.uuid,
        uuidShort: s.uuidShort,
        name: s.name,
        description: cleanDescription,
        autoSuspendAt: suspendMatch ? suspendMatch[1] : null,
        status: isSuspended ? 'suspended' : (cached || s.status || 'offline'),
        node: s.node?.name || 'Unknown',
        nodeId: s.node?.id,
        nodeFqdn: s.node?.fqdn,
        allocation: s.allocation
          ? `${s.node?.fqdn || s.allocation.alias || s.allocation.ip}:${s.allocation.port}`
          : 'None',
        allocations: s.allocations || [],
        allocationsCount: s.allocations?.length || (s.allocation ? 1 : 0),
        owner: s.owner
          ? { id: s.owner.id, username: s.owner.username, email: s.owner.email }
          : null,
        egg: s.egg ? { id: s.egg.id, name: s.egg.name } : null,
        nest: s.nest ? { id: s.nest.id, name: s.nest.name } : null,
        limits: {
          memory: s.memory,
          swap: s.swap,
          disk: s.disk,
          io: s.io,
          cpu: s.cpu,
          threads: s.threads,
        },
        isOwner: true,
        permissions: ['*'],
        createdAt: s.createdAt,
      };
    });
  }

  async listClientServers(userId: number, isAdmin: boolean) {
    const servers = await this.prisma.server.findMany({
      where: isAdmin
        ? {}
        : {
            OR: [
              { userId },
              { subusers: { some: { userId } } },
            ],
          },
      include: {
        node: {
          select: { id: true, name: true, fqdn: true, scheme: true, daemonPort: true, daemonToken: true },
        },
        allocation: {
          select: { id: true, ip: true, port: true, alias: true },
        },
        egg: {
          select: { id: true, name: true },
        },
        owner: {
          select: { id: true, username: true, email: true },
        },
        subusers: {
          where: { userId },
          select: { permissions: true },
        },
      },
      orderBy: { id: 'desc' },
    });

    return servers.map((s) => {
      const cached = ServersService.getServerState(s.uuid);
      const isSuspended = s.status === 'suspended';
      const suspendMatch = s.description?.match(/\[suspend:([^\]]+)\]/);
      const cleanDescription = (s.description || '').replace(/\s*\[suspend:[^\]]+\]\s*/g, '').trim();

      return {
        id: s.id,
        uuid: s.uuid,
        uuidShort: s.uuidShort,
        name: s.name,
        description: cleanDescription,
        autoSuspendAt: suspendMatch ? suspendMatch[1] : null,
        status: isSuspended ? 'suspended' : (cached || s.status || 'offline'),
        node: s.node.name,
        allocation: `${s.node?.fqdn || s.allocation.alias || s.allocation.ip}:${s.allocation.port}`,
        owner: s.owner ? { id: s.owner.id, username: s.owner.username, email: s.owner.email } : null,
        limits: {
          memory: s.memory,
          swap: s.swap,
          disk: s.disk,
          io: s.io,
          cpu: s.cpu,
          threads: s.threads,
        },
        isOwner: s.userId === userId,
        permissions: isAdmin || s.userId === userId ? ['*'] : s.subusers[0]?.permissions || [],
        createdAt: s.createdAt,
      };
    });
  }

  async getServerByUuid(uuid: string) {
    const server = await this.prisma.server.findUnique({
      where: { uuid },
      include: {
        node: true,
        allocation: true,
        allocations: {
          select: { id: true, ip: true, port: true, alias: true, notes: true },
        },
        egg: {
          include: { variables: true },
        },
        nest: {
          select: { id: true, name: true },
        },
        owner: {
          select: { id: true, uuid: true, username: true, email: true },
        },
        variables: {
          include: {
            variable: true,
          },
        },
        subusers: {
          include: {
            user: {
              select: { id: true, uuid: true, username: true, email: true },
            },
          },
        },
      },
    });

    if (!server) {
      throw new NotFoundException(`Server with UUID ${uuid} not found`);
    }

    const cachedState = ServersService.getServerState(server.uuid);
    const isSuspended = server.status === 'suspended';
    const suspendMatch = server.description?.match(/\[suspend:([^\]]+)\]/);
    const cleanDescription = (server.description || '').replace(/\s*\[suspend:[^\]]+\]\s*/g, '').trim();

    return {
      ...server,
      description: cleanDescription,
      autoSuspendAt: suspendMatch ? suspendMatch[1] : null,
      status: isSuspended ? 'suspended' : server.status,
      liveStatus: isSuspended ? 'suspended' : (cachedState || server.status || 'offline'),
    };
  }

  async updateServerStartup(uuid: string, data: { dockerImage?: string; startup?: string }) {
    const server = await this.prisma.server.findUnique({
      where: { uuid },
      include: { node: true },
    });
    if (!server) {
      throw new NotFoundException(`Server with UUID ${uuid} not found`);
    }

    const updateData: { dockerImage?: string; startup?: string } = {};
    if (data.dockerImage && data.dockerImage.trim()) {
      updateData.dockerImage = data.dockerImage.trim();
    }
    if (data.startup && data.startup.trim()) {
      updateData.startup = data.startup.trim();
    }

    const updated = await this.prisma.server.update({
      where: { uuid },
      data: updateData,
      include: { node: true, egg: true },
    });

    // Sync updated settings to Wings daemon
    try {
      const client = this.getWingsClient(updated.node);
      await client.syncServer(updated.uuid);
    } catch (err: any) {
      this.logger.warn(`Failed to sync updated startup/docker image with Wings: ${err.message}`);
    }

    return updated;
  }

  // ─── Provisioning ──────────────────────────────────────────────────

  async createServer(dto: {
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
    suspendAt?: string;
  }) {
    const owner = await this.prisma.user.findUnique({ where: { id: dto.ownerId } });
    if (!owner) throw new BadRequestException(`User ${dto.ownerId} does not exist`);

    const node = await this.prisma.node.findUnique({ where: { id: dto.nodeId } });
    if (!node) throw new BadRequestException(`Node ${dto.nodeId} does not exist`);

    const egg = await this.prisma.egg.findUnique({
      where: { id: dto.eggId },
      include: { variables: true },
    });
    if (!egg) throw new BadRequestException(`Egg ${dto.eggId} does not exist`);

    // Verify primary allocation is unassigned and on this node
    const primaryAlloc = await this.prisma.allocation.findFirst({
      where: { id: dto.allocationId, nodeId: dto.nodeId, serverId: null },
    });
    if (!primaryAlloc) {
      throw new ConflictException(`Allocation ${dto.allocationId} is already assigned or not found on this node`);
    }

    const uuid = crypto.randomUUID();
    const uuidShort = uuid.substring(0, 8);

    let defaultDockerImage = 'ghcr.io/pterodactyl/yolks:java_25';
    try {
      const parsedImages = typeof egg.dockerImages === 'object' && egg.dockerImages !== null
        ? (egg.dockerImages as Record<string, string>)
        : {};
      const imgValues = Object.values(parsedImages);
      // Prioritize Java 25 as the primary default runtime if present, then Java 21, then first image
      const java25 = imgValues.find(
        (img) => typeof img === 'string' && (img.includes('java_25') || img.includes('java:25'))
      );
      const java21 = imgValues.find(
        (img) => typeof img === 'string' && (img.includes('java_21') || img.includes('java:21'))
      );
      defaultDockerImage = (java25 as string) || (java21 as string) || (imgValues[0] as string) || defaultDockerImage;
    } catch {}

    const dockerImage = dto.dockerImage || defaultDockerImage;
    const startup = dto.startup || egg.startup;

    const createdServer = await this.prisma.$transaction(async (tx) => {
      let description = dto.description?.trim() || '';
      if (dto.suspendAt) {
        description += ` [suspend:${new Date(dto.suspendAt).toISOString()}]`;
      }

      const s = await tx.server.create({
        data: {
          uuid,
          uuidShort,
          name: dto.name.trim(),
          description,
          status: 'installing',
          userId: dto.ownerId,
          nodeId: dto.nodeId,
          allocationId: dto.allocationId,
          eggId: dto.eggId,
          nestId: dto.nestId,
          dockerImage,
          startup,
          memory: clampInt4(dto.memory, 512),
          swap: clampInt4(dto.swap, 0),
          disk: clampInt4(dto.disk, 1024),
          io: clampInt4(dto.io, 500, 1000),
          cpu: clampInt4(dto.cpu, 100),
          threads: dto.threads || null,
          databaseLimit: clampInt4(dto.databases, 0),
          allocationLimit: clampInt4(dto.allocationsLimit, 0),
          backupLimit: clampInt4(dto.backups, 0),
        },
      });

      // Assign primary and additional allocations
      const allAllocationIds = [dto.allocationId, ...(dto.additionalAllocationIds || [])];
      await tx.allocation.updateMany({
        where: { id: { in: allAllocationIds } },
        data: { serverId: s.id },
      });

      // Setup server variables
      for (const eggVar of egg.variables) {
        const val = dto.environment?.[eggVar.envVariable] ?? eggVar.defaultValue;
        await tx.serverVariable.create({
          data: {
            serverId: s.id,
            variableId: eggVar.id,
            variableValue: String(val),
          },
        });
      }

      return s;
    });

    // Provision on Wings using Wings installer payload { uuid, start_on_completion }
    try {
      const client = this.getWingsClient(node);
      await client.createServer({
        uuid: createdServer.uuid,
        start_on_completion: false,
      });
      this.logger.log(`Server ${createdServer.uuid} successfully provisioned to Wings node ${node.name}`);

      // Pre-seed server.properties with 0.0.0.0 (or explicit IP) and allocated port, and accept eula.txt
      try {
        const fullServer = await this.prisma.server.findUnique({
          where: { id: createdServer.id },
          include: { allocation: true },
        });
        if (fullServer?.allocation) {
          const targetPort = String(fullServer.allocation.port);
          const rawIp = fullServer.allocation.ip;
          const targetIp = rawIp && rawIp.trim() !== '' && rawIp !== '0.0.0.0' && rawIp !== '127.0.0.1' ? rawIp : '0.0.0.0';
          const props = [
            '# Minecraft server properties generated by Obsidian Panel',
            `server-ip=${targetIp}`,
            `server-port=${targetPort}`,
            `query.port=${targetPort}`,
            'enable-query=true',
            'motd=A Minecraft Server powered by Obsidian Panel',
            '',
          ].join('\n');
          await client.writeFile(createdServer.uuid, 'server.properties', props);
          await client.writeFile(createdServer.uuid, 'eula.txt', 'eula=true\n');
        }
      } catch (seedErr: any) {
        this.logger.warn(`Non-critical: could not pre-seed server.properties for ${createdServer.uuid}: ${seedErr.message}`);
      }
    } catch (err: any) {
      this.logger.error(`Failed to push server ${createdServer.uuid} to Wings: ${err.message}`);
      // Clean up database completely so rejected server is not saved or left dangling in panel
      try {
        await this.prisma.$transaction([
          this.prisma.allocation.updateMany({
            where: { serverId: createdServer.id },
            data: { serverId: null },
          }),
          this.prisma.serverVariable.deleteMany({
            where: { serverId: createdServer.id },
          }),
          this.prisma.server.delete({
            where: { id: createdServer.id },
          }),
        ]);
        this.logger.log(`Rolled back server ${createdServer.uuid} from database after Wings rejection`);
      } catch (cleanupErr: any) {
        this.logger.error(`Failed to clean up rejected server ${createdServer.uuid}: ${cleanupErr.message}`);
      }

      throw new BadRequestException(
        `Wings daemon rejected server creation: ${err.message}. Server was not created.`,
      );
    }

    return this.getServerByUuid(createdServer.uuid);
  }

  // ─── Lifecycle & Power ─────────────────────────────────────────────

  async sendPowerAction(uuid: string, action: 'start' | 'stop' | 'restart' | 'kill') {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    await client.sendPowerAction(server.uuid, action);
    if (action === 'start' || action === 'restart') {
      ServersService.setServerState(uuid, 'running');
    } else if (action === 'stop') {
      ServersService.setServerState(uuid, 'stopping');
    } else if (action === 'kill') {
      ServersService.setServerState(uuid, 'offline');
    }
    return { success: true, action };
  }

  async sendConsoleCommand(uuid: string, command: string) {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    await client.sendCommands(server.uuid, [command]);
    return { success: true };
  }

  async updateServerVariables(uuid: string, variables: Record<string, string>) {
    const server = await this.getServerByUuid(uuid);

    for (const [key, value] of Object.entries(variables)) {
      const eggVar = server.egg.variables.find((v) => v.envVariable === key);
      if (!eggVar) continue;

      const existing = server.variables.find((v) => v.variableId === eggVar.id);
      if (existing) {
        await this.prisma.serverVariable.update({
          where: { id: existing.id },
          data: { variableValue: String(value) },
        });
      } else {
        await this.prisma.serverVariable.create({
          data: {
            serverId: server.id,
            variableId: eggVar.id,
            variableValue: String(value),
          },
        });
      }
    }

    // Tell Wings to sync the updated configuration
    try {
      const client = this.getWingsClient(server.node);
      await client.syncServer(server.uuid);
      this.logger.log(`Server ${server.uuid} configuration synced to Wings after variable update`);
    } catch (err: any) {
      this.logger.warn(`Could not sync updated variables to Wings: ${err.message}`);
    }

    return this.getServerByUuid(uuid);
  }

  async reinstallServer(uuid: string) {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);

    try {
      await client.reinstallServer(server.uuid);
    } catch (err: any) {
      // If server does not exist on Wings daemon (HTTP 404), provision it from scratch
      if (err.statusCode === 404 || err.message?.includes('404')) {
        this.logger.warn(
          `Server ${server.uuid} does not exist on Wings node ${server.node.name} (404). Re-provisioning server via createServer...`,
        );
        await client.createServer({
          uuid: server.uuid,
          start_on_completion: false,
        });
      } else {
        throw err;
      }
    }

    await this.prisma.server.update({
      where: { id: server.id },
      data: { status: 'installing' },
    });
    return { success: true, message: 'Server reinstallation triggered' };
  }

  async deleteServer(uuid: string) {
    const server = await this.getServerByUuid(uuid);

    try {
      const client = this.getWingsClient(server.node);
      await client.deleteServer(server.uuid);
    } catch (err: any) {
      this.logger.warn(`Wings server deletion error (proceeding with DB cleanup): ${err.message}`);
    }

    await this.prisma.$transaction([
      this.prisma.allocation.updateMany({
        where: { serverId: server.id },
        data: { serverId: null },
      }),
      this.prisma.serverVariable.deleteMany({ where: { serverId: server.id } }),
      this.prisma.subuser.deleteMany({ where: { serverId: server.id } }),
      this.prisma.backup.deleteMany({ where: { serverId: server.id } }),
      this.prisma.server.delete({ where: { id: server.id } }),
    ]);

    return { success: true, message: `Server ${server.name} deleted` };
  }

  // ─── WebSocket Token for Real-Time Console ─────────────────────────

  async getWebSocketCredentials(uuid: string, user: { id: number; uuid: string; isAdmin: boolean }) {
    const server = await this.getServerByUuid(uuid);

    let permissions = ['*'];
    if (!user.isAdmin && server.userId !== user.id) {
      const sub = server.subusers.find((s) => s.userId === user.id);
      permissions = sub ? sub.permissions : [];
    }

    const { token, socket } = await this.authService.generateWebSocketToken(
      server.uuid,
      server.node.id,
      user.id,
      user.uuid,
      permissions,
    );

    return {
      data: {
        token,
        socket,
      },
    };
  }

  // ─── Files ─────────────────────────────────────────────────────────

  async listFiles(uuid: string, directory: string = '/') {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    return client.listFiles(server.uuid, directory);
  }

  async getFileContents(uuid: string, filePath: string) {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    return client.getFileContents(server.uuid, filePath);
  }

  async writeFile(uuid: string, filePath: string, content: string | Buffer) {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    await client.writeFile(server.uuid, filePath, content);
    return { success: true };
  }

  async renameFiles(uuid: string, root: string, files: Array<{ from: string; to: string }>) {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    await client.renameFiles(server.uuid, root, files);
    return { success: true };
  }

  async deleteFiles(uuid: string, root: string, files: string[]) {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    await client.deleteFiles(server.uuid, root, files);
    return { success: true };
  }

  async createFolder(uuid: string, root: string, name: string) {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    await client.createFolder(server.uuid, root, name);
    return { success: true, name };
  }

  async compressFiles(uuid: string, root: string, files: string[]) {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    return client.compressFiles(server.uuid, root, files);
  }

  async decompressFile(uuid: string, root: string, file: string) {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    await client.decompressFile(server.uuid, root, file);
    return { success: true };
  }

  async chmodFiles(uuid: string, root: string, files: Array<{ file: string; mode: string }>) {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    await client.chmodFiles(server.uuid, root, files);
    return { success: true };
  }

  // ─── Allocations Management ─────────────────────────────────────────

  async syncServerToWings(serverOrUuid: any) {
    try {
      const server =
        typeof serverOrUuid === 'string'
          ? await this.getServerByUuid(serverOrUuid)
          : serverOrUuid;
      const client = this.getWingsClient(server.node);
      await client.syncServer(server.uuid);
      this.logger.log(`Server ${server.uuid} configuration synced to Wings.`);
    } catch (err: any) {
      this.logger.warn(
        `Failed to sync server ${
          typeof serverOrUuid === 'string' ? serverOrUuid : serverOrUuid?.uuid
        } to Wings: ${err.message}`,
      );
    }
  }

  async getServerAllocations(uuid: string) {
    const server = await this.prisma.server.findUnique({
      where: { uuid },
      include: {
        node: true,
        allocation: true,
        allocations: true,
      },
    });

    if (!server) {
      throw new NotFoundException(`Server ${uuid} not found`);
    }

    const unassigned = await this.prisma.allocation.findMany({
      where: {
        nodeId: server.nodeId,
        serverId: null,
      },
      orderBy: [{ ip: 'asc' }, { port: 'asc' }],
    });

    return {
      server: {
        id: server.id,
        uuid: server.uuid,
        name: server.name,
        nodeId: server.nodeId,
        nodeName: server.node.name,
        allocationId: server.allocationId,
        allocationLimit: server.allocationLimit,
      },
      primary: server.allocation,
      assigned: server.allocations,
      unassigned,
    };
  }

  async assignAllocationToServer(uuid: string, allocationId: number) {
    const server = await this.getServerByUuid(uuid);
    const allocation = await this.prisma.allocation.findUnique({
      where: { id: allocationId },
    });

    if (!allocation) {
      throw new NotFoundException(`Allocation ${allocationId} not found`);
    }

    if (allocation.nodeId !== server.nodeId) {
      throw new BadRequestException('Allocation does not belong to the same node as the server');
    }

    if (allocation.serverId && allocation.serverId !== server.id) {
      throw new ConflictException('Allocation is already assigned to another server');
    }

    await this.prisma.allocation.update({
      where: { id: allocationId },
      data: { serverId: server.id },
    });

    await this.syncServerToWings(server);
    return this.getServerAllocations(uuid);
  }

  async unassignAllocationFromServer(uuid: string, allocationId: number) {
    const server = await this.getServerByUuid(uuid);

    if (server.allocationId === allocationId) {
      throw new BadRequestException('Cannot unassign the primary allocation. Set another allocation as primary first.');
    }

    const allocation = await this.prisma.allocation.findFirst({
      where: { id: allocationId, serverId: server.id },
    });

    if (!allocation) {
      throw new NotFoundException('Allocation not found or not assigned to this server');
    }

    await this.prisma.allocation.update({
      where: { id: allocationId },
      data: { serverId: null },
    });

    await this.syncServerToWings(server);
    return this.getServerAllocations(uuid);
  }

  async setPrimaryAllocationForServer(uuid: string, allocationId: number) {
    const server = await this.getServerByUuid(uuid);

    const allocation = await this.prisma.allocation.findFirst({
      where: { id: allocationId, serverId: server.id },
    });

    if (!allocation) {
      throw new BadRequestException('Allocation must be assigned to this server before setting it as primary');
    }

    await this.prisma.server.update({
      where: { id: server.id },
      data: { allocationId },
    });

    await this.syncServerToWings(server);
    return this.getServerAllocations(uuid);
  }

  async assignClientAllocation(uuid: string, requestedAllocationId?: number) {
    const server = await this.prisma.server.findUnique({
      where: { uuid },
      include: {
        node: true,
        allocation: true,
        allocations: true,
      },
    });

    if (!server) {
      throw new NotFoundException(`Server ${uuid} not found`);
    }

    // Check limit
    if (server.allocationLimit > 0 && server.allocations.length >= server.allocationLimit) {
      throw new BadRequestException(
        `Allocation limit reached (${server.allocationLimit} maximum allocations for this server). Contact an administrator to add more.`,
      );
    }

    let allocation;
    if (requestedAllocationId) {
      allocation = await this.prisma.allocation.findFirst({
        where: { id: requestedAllocationId, nodeId: server.nodeId, serverId: null },
      });
      if (!allocation) {
        throw new NotFoundException('Requested allocation is not available on this server node');
      }
    } else {
      allocation = await this.prisma.allocation.findFirst({
        where: { nodeId: server.nodeId, serverId: null },
        orderBy: [{ ip: 'asc' }, { port: 'asc' }],
      });
      if (!allocation) {
        throw new BadRequestException('No unassigned allocations currently available on this node');
      }
    }

    await this.prisma.allocation.update({
      where: { id: allocation.id },
      data: { serverId: server.id },
    });

    await this.syncServerToWings(server);
    return this.getServerAllocations(uuid);
  }

  // ─── Backups ───────────────────────────────────────────────────────

  async listBackups(uuid: string) {
    const server = await this.getServerByUuid(uuid);
    const backups = await this.prisma.backup.findMany({
      where: { serverId: server.id },
      orderBy: { createdAt: 'desc' },
    });
    return backups.map((b) => ({
      ...b,
      bytes: typeof b.bytes === 'bigint' ? Number(b.bytes) : Number(b.bytes) || 0,
    }));
  }

  async createBackup(uuid: string, name?: string, ignored?: string) {
    const server = await this.getServerByUuid(uuid);

    const backupLimit = server.backupLimit ?? 0;
    if (backupLimit <= 0) {
      throw new BadRequestException('Backups are disabled for this server (backup limit is 0). Contact an administrator to allocate backup slots.');
    }

    const count = await this.prisma.backup.count({ where: { serverId: server.id } });
    if (count >= backupLimit) {
      throw new BadRequestException(`Backup limit reached (${count}/${backupLimit}). Delete an existing backup before creating a new one.`);
    }

    const backupUuid = crypto.randomUUID();
    const backup = await this.prisma.backup.create({
      data: {
        uuid: backupUuid,
        serverId: server.id,
        name: name?.trim() || `Backup at ${new Date().toISOString()}`,
        ignoredFiles: ignored ? ignored.split('\n').map((s) => s.trim()) : [],
        disk: 'wings',
        checksum: null,
        bytes: BigInt(0),
        isSuccessful: false,
      },
    });

    try {
      const client = this.getWingsClient(server.node);
      await client.createBackup(server.uuid, backupUuid, 'wings', ignored);
    } catch (err: any) {
      this.logger.error(`Wings daemon failed to initiate backup for server ${server.uuid}: ${err.message}`);
      await this.prisma.backup.delete({ where: { id: backup.id } }).catch(() => {});
      throw new BadRequestException(`Wings daemon failed to start backup: ${err.message}`);
    }

    return {
      ...backup,
      bytes: Number(backup.bytes),
    };
  }

  async deleteBackup(uuid: string, backupUuid: string) {
    const server = await this.getServerByUuid(uuid);
    const backup = await this.prisma.backup.findFirst({
      where: { uuid: backupUuid, serverId: server.id },
    });

    if (!backup) throw new NotFoundException('Backup not found');

    const client = this.getWingsClient(server.node);
    try {
      await client.deleteBackup(server.uuid, backupUuid);
    } catch (err: any) {
      this.logger.warn(`Failed to delete backup on Wings: ${err.message}`);
    }

    await this.prisma.backup.delete({ where: { id: backup.id } });
    return { success: true, message: 'Backup deleted' };
  }

  async restoreBackup(uuid: string, backupUuid: string, truncateDirectory: boolean = false) {
    const server = await this.getServerByUuid(uuid);
    const backup = await this.prisma.backup.findFirst({
      where: { uuid: backupUuid, serverId: server.id },
    });

    if (!backup) throw new NotFoundException('Backup not found');

    const client = this.getWingsClient(server.node);
    await client.restoreBackup(server.uuid, backupUuid, {
      adapter: (backup.disk as any) || 'wings',
      truncate_directory: truncateDirectory,
    });

    return { success: true, message: 'Backup restore initiated' };
  }

  async getBackupDownload(uuid: string, backupUuid: string, user?: any) {
    const server = await this.getServerByUuid(uuid);
    const backup = await this.prisma.backup.findFirst({
      where: { uuid: backupUuid, serverId: server.id },
    });

    if (!backup) throw new NotFoundException('Backup not found');
    if (!backup.isSuccessful) {
      throw new BadRequestException('This backup is still processing. Please wait for it to complete.');
    }

    const node = await this.prisma.node.findUnique({
      where: { id: server.nodeId },
    });

    if (!node) throw new NotFoundException('Hosting node not found');

    const panelUrl = (this.config.get<string>('APP_URL') || process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const now = Math.floor(Date.now() / 1000);
    const connectionAddress = `${node.scheme}://${node.fqdn}:${node.daemonPort}`;

    // Generate signed JWT for Wings /download/backup conforming to standard Pterodactyl NodeJWTService specifications
    const token = jwt.sign(
      {
        iss: panelUrl,
        aud: [
          connectionAddress,
          `${node.scheme}://${node.fqdn}:${node.daemonPort}`,
          `${node.scheme}://${node.fqdn}`,
        ],
        jti: uniqueId,
        sub: 'backup-download',
        scope: 'backup-download',
        scopes: ['backup-download'],
        permissions: ['backup-download', 'backup.download', '*'],
        user_uuid: user?.uuid || server.owner?.uuid || server.uuid,
        user_id: user?.id || server.owner?.id || 1,
        npid: node.uuid,
        server_uuid: server.uuid,
        backup_uuid: backup.uuid,
        unique_id: uniqueId,
        iat: now,
        nbf: now - 300, // 5 min clock drift allowance
        exp: now + 3600, // 1 hour
      },
      node.daemonToken,
      {
        algorithm: 'HS256',
      },
    );

    const safeName = (backup.name || 'backup').replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = safeName.endsWith('.tar.gz') ? safeName : `${safeName}.tar.gz`;
    const downloadUrl = `${connectionAddress}/download/backup?token=${token}`;

    return {
      url: downloadUrl,
      filename,
      token,
      backupUuid: backup.uuid,
    };
  }

  async streamBackup(uuid: string, backupUuid: string, reply: any, user?: any) {
    const server = await this.getServerByUuid(uuid);
    const backup = await this.prisma.backup.findFirst({
      where: { uuid: backupUuid, serverId: server.id },
    });

    if (!backup) throw new NotFoundException('Backup not found');
    if (!backup.isSuccessful) {
      throw new BadRequestException('This backup is still processing. Please wait for it to complete.');
    }

    const safeName = (backup.name || 'backup').replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = safeName.endsWith('.tar.gz') ? safeName : `${safeName}.tar.gz`;

    // 1. Direct Local Archive Stream (Co-located host optimization)
    // On unified VPS installations where Panel and Wings run on the same server, streaming directly
    // from disk bypasses all daemon HTTP port restrictions, JWT scope mismatches, and network roundtrips.
    const localDir = process.env.BACKUP_DIRECTORY || '/var/lib/pterodactyl/backups';
    const localCandidates = [
      path.join(localDir, `${backup.uuid}.tar.gz`),
      path.join(localDir, backup.uuid),
      `/var/lib/pterodactyl/backups/${backup.uuid}.tar.gz`,
      `/var/lib/pterodactyl/backups/${backup.uuid}`,
    ];

    let foundLocalPath: string | null = null;
    for (const p of localCandidates) {
      try {
        if (fs.existsSync(p)) {
          foundLocalPath = p;
          break;
        }
      } catch {}
    }

    if (foundLocalPath) {
      try {
        const stat = fs.statSync(foundLocalPath);
        reply.header('Content-Type', 'application/x-gzip');
        reply.header('Content-Disposition', `attachment; filename="${filename}"`);
        reply.header('Content-Length', stat.size);
        const nodeStream = fs.createReadStream(foundLocalPath);
        return reply.send(nodeStream);
      } catch (e: any) {
        this.logger.warn(`Local backup file exists at ${foundLocalPath} but failed to read: ${e.message}. Falling back to Wings daemon HTTP stream.`);
      }
    }

    // 2. Wings daemon HTTP stream (for multi-node or remote wings daemons)
    const { url } = await this.getBackupDownload(uuid, backupUuid, user);

    return new Promise<void>((resolve, reject) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const reqOptions: http.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: 'GET',
        headers: {
          'User-Agent': 'Obsidian-Panel/0.1.0',
          Accept: 'application/x-gzip, application/octet-stream, */*',
        },
        // Allow connections to remote nodes with self-signed TLS certificates
        ...(isHttps ? { rejectUnauthorized: false } : {}),
      };

      const daemonReq = httpModule.request(reqOptions, (daemonRes) => {
        if (daemonRes.statusCode && (daemonRes.statusCode < 200 || daemonRes.statusCode >= 300)) {
          let errBody = '';
          daemonRes.on('data', (c) => (errBody += c));
          daemonRes.on('end', () => {
            this.logger.error(`Wings daemon download failed with HTTP ${daemonRes.statusCode}: ${errBody}`);
            if (daemonRes.statusCode === 404) {
              reply.status(404).send({
                statusCode: 404,
                error: 'Not Found',
                message: 'Backup archive not found on node. It may have been pruned or deleted.',
              });
            } else {
              reply.status(502).send({
                statusCode: 502,
                error: 'Bad Gateway',
                message: `Node daemon rejected download with HTTP ${daemonRes.statusCode}: ${errBody.slice(0, 200)}`,
              });
            }
            resolve();
          });
          return;
        }

        reply.header('Content-Type', 'application/x-gzip');
        reply.header('Content-Disposition', `attachment; filename="${filename}"`);
        if (daemonRes.headers['content-length']) {
          reply.header('Content-Length', daemonRes.headers['content-length']);
        }

        // Pipe directly from daemon stream to client response
        daemonRes.pipe(reply.raw);
        daemonRes.on('end', () => resolve());
        daemonRes.on('error', (err) => {
          this.logger.error(`Error streaming backup from Wings: ${err.message}`);
          reject(err);
        });
      });

      daemonReq.on('error', (err) => {
        this.logger.error(`Failed to connect to Wings daemon for backup download: ${err.message}`);
        reply.status(502).send({
          statusCode: 502,
          error: 'Bad Gateway',
          message: `Unable to connect to hosting node: ${err.message}`,
        });
        resolve();
      });

      daemonReq.setTimeout(60000, () => {
        daemonReq.destroy(new Error('Connection to node timed out after 60s'));
      });

      daemonReq.end();
    });
  }

  // ─── Subusers ──────────────────────────────────────────────────────

  async listSubusers(uuid: string) {
    const server = await this.getServerByUuid(uuid);
    return this.prisma.subuser.findMany({
      where: { serverId: server.id },
      include: {
        user: {
          select: { id: true, uuid: true, username: true, email: true },
        },
      },
    });
  }

  async addSubuser(uuid: string, email: string, permissions: string[]) {
    const server = await this.getServerByUuid(uuid);
    const targetUser = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!targetUser) {
      throw new NotFoundException(`No user found with email '${email}'`);
    }

    if (targetUser.id === server.userId) {
      throw new BadRequestException('Cannot add the server owner as a subuser');
    }

    const existing = await this.prisma.subuser.findUnique({
      where: {
        userId_serverId: {
          userId: targetUser.id,
          serverId: server.id,
        },
      },
    });

    if (existing) {
      throw new ConflictException('User is already a subuser for this server');
    }

    return this.prisma.subuser.create({
      data: {
        serverId: server.id,
        userId: targetUser.id,
        permissions,
      },
      include: {
        user: { select: { id: true, uuid: true, username: true, email: true } },
      },
    });
  }

  async updateSubuser(uuid: string, subuserId: number, permissions: string[]) {
    const server = await this.getServerByUuid(uuid);
    const subuser = await this.prisma.subuser.findFirst({
      where: { id: subuserId, serverId: server.id },
    });

    if (!subuser) throw new NotFoundException('Subuser not found');

    return this.prisma.subuser.update({
      where: { id: subuserId },
      data: { permissions },
      include: {
        user: { select: { id: true, uuid: true, username: true, email: true } },
      },
    });
  }

  async deleteSubuser(uuid: string, subuserId: number) {
    const server = await this.getServerByUuid(uuid);
    const subuser = await this.prisma.subuser.findFirst({
      where: { id: subuserId, serverId: server.id },
    });

    if (!subuser) throw new NotFoundException('Subuser not found');

    await this.prisma.subuser.delete({ where: { id: subuserId } });
    return { success: true, message: 'Subuser removed' };
  }

  // ─── Databases ─────────────────────────────────────────────────────

  async listDatabases(uuid: string) {
    const server = await this.getServerByUuid(uuid);
    const databases = await this.prisma.serverDatabase.findMany({
      where: { serverId: server.id },
      include: {
        databaseHost: {
          select: { id: true, name: true, host: true, port: true },
        },
      },
    });

    return {
      data: databases.map((db) => ({
        id: db.id,
        database: db.database,
        username: db.username,
        password: db.password,
        remoteHost: db.remoteHost,
        maxConnections: db.maxConnections,
        host: {
          name: db.databaseHost.name,
          address: db.databaseHost.host,
          port: db.databaseHost.port,
        },
        relationships: {
          password: {
            attributes: {
              password: db.password,
            },
          },
        },
      })),
      meta: {
        current: databases.length,
        limit: server.databaseLimit,
      },
    };
  }

  async createDatabase(uuid: string, databaseName: string, remote: string = '%') {
    const server = await this.getServerByUuid(uuid);
    if (server.databaseLimit > 0) {
      const count = await this.prisma.serverDatabase.count({
        where: { serverId: server.id },
      });
      if (count >= server.databaseLimit) {
        throw new BadRequestException(`Database limit reached (${server.databaseLimit})`);
      }
    }

    const host = await this.prisma.databaseHost.findFirst({
      where: server.node.id ? { OR: [{ nodeId: server.node.id }, { nodeId: null }] } : undefined,
    });

    if (!host) {
      throw new BadRequestException('No database host available on this node.');
    }

    const cleanDbName = `s${server.id}_${databaseName.replace(/[^a-zA-Z0-9_]/g, '')}`.substring(0, 48);
    const cleanUsername = `u${server.id}_${crypto.randomBytes(4).toString('hex')}`;
    const generatedPassword = crypto.randomBytes(16).toString('hex');

    const newDb = await this.prisma.serverDatabase.create({
      data: {
        serverId: server.id,
        databaseHostId: host.id,
        database: cleanDbName,
        username: cleanUsername,
        password: generatedPassword,
        remoteHost: remote || '%',
      },
      include: {
        databaseHost: true,
      },
    });

    return {
      success: true,
      database: newDb,
    };
  }

  async deleteDatabase(uuid: string, databaseId: number) {
    const server = await this.getServerByUuid(uuid);
    const db = await this.prisma.serverDatabase.findFirst({
      where: { id: databaseId, serverId: server.id },
    });

    if (!db) throw new NotFoundException('Database not found');

    await this.prisma.serverDatabase.delete({
      where: { id: db.id },
    });

    return { success: true, message: 'Database deleted' };
  }

  async rotateDatabasePassword(uuid: string, databaseId: number) {
    const server = await this.getServerByUuid(uuid);
    const db = await this.prisma.serverDatabase.findFirst({
      where: { id: databaseId, serverId: server.id },
    });

    if (!db) throw new NotFoundException('Database not found');

    const newPassword = crypto.randomBytes(16).toString('hex');
    await this.prisma.serverDatabase.update({
      where: { id: db.id },
      data: { password: newPassword },
    });

    return { success: true, password: newPassword };
  }

  // ─── Schedules ─────────────────────────────────────────────────────

  async listSchedules(uuid: string) {
    const server = await this.getServerByUuid(uuid);
    return this.prisma.schedule.findMany({
      where: { serverId: server.id },
      include: {
        tasks: {
          orderBy: { sequenceId: 'asc' },
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  async createSchedule(
    uuid: string,
    dto: {
      name: string;
      cronMinute: string;
      cronHour: string;
      cronDayOfMonth: string;
      cronMonth: string;
      cronDayOfWeek: string;
      isActive?: boolean;
      onlyWhenOnline?: boolean;
    },
  ) {
    const server = await this.getServerByUuid(uuid);
    return this.prisma.schedule.create({
      data: {
        serverId: server.id,
        name: dto.name.trim(),
        cronMinute: dto.cronMinute || '*',
        cronHour: dto.cronHour || '*',
        cronDayOfMonth: dto.cronDayOfMonth || '*',
        cronMonth: dto.cronMonth || '*',
        cronDayOfWeek: dto.cronDayOfWeek || '*',
        isActive: dto.isActive ?? true,
        onlyWhenOnline: dto.onlyWhenOnline ?? true,
      },
      include: {
        tasks: true,
      },
    });
  }

  async deleteSchedule(uuid: string, scheduleId: number) {
    const server = await this.getServerByUuid(uuid);
    const schedule = await this.prisma.schedule.findFirst({
      where: { id: scheduleId, serverId: server.id },
    });

    if (!schedule) throw new NotFoundException('Schedule not found');

    await this.prisma.schedule.delete({
      where: { id: schedule.id },
    });

    return { success: true, message: 'Schedule deleted' };
  }

  // ─── Server Suspension & Auto-Suspend Timer ────────────────────────

  async suspendServer(uuid: string) {
    const server = await this.prisma.server.findUnique({
      where: { uuid },
      include: { node: true },
    });
    if (!server) throw new NotFoundException('Server not found');

    // Force stop / kill container on Wings
    try {
      const client = this.getWingsClient(server.node);
      await client.sendPowerAction(server.uuid, 'kill').catch(() => {});
    } catch (e: any) {
      this.logger.warn(`Could not kill container for suspended server ${uuid}: ${e.message}`);
    }

    const updated = await this.prisma.server.update({
      where: { uuid },
      data: { status: 'suspended' },
    });
    ServersService.setServerState(uuid, 'suspended');
    this.logger.warn(`🛑 Server ${server.name} (${uuid}) suspended by administrator.`);
    return { success: true, message: 'Server suspended successfully', server: updated };
  }

  async unsuspendServer(uuid: string) {
    const server = await this.prisma.server.findUnique({
      where: { uuid },
    });
    if (!server) throw new NotFoundException('Server not found');

    const updated = await this.prisma.server.update({
      where: { uuid },
      data: { status: null },
    });
    ServersService.setServerState(uuid, 'offline');
    this.logger.log(`✅ Server ${server.name} (${uuid}) unsuspended by administrator.`);
    return { success: true, message: 'Server unsuspended successfully', server: updated };
  }

  async processAutoSuspensions() {
    try {
      const now = new Date();
      const activeServers = await this.prisma.server.findMany({
        where: {
          status: { not: 'suspended' },
          description: { contains: '[suspend:' },
        },
      });

      for (const s of activeServers) {
        const match = s.description.match(/\[suspend:([^\]]+)\]/);
        if (match && match[1]) {
          const suspendDate = new Date(match[1]);
          if (!isNaN(suspendDate.getTime()) && now >= suspendDate) {
            this.logger.warn(`⏳ Auto-suspending server ${s.name} (${s.uuid}) - expired at ${suspendDate.toISOString()}`);
            await this.suspendServer(s.uuid);
          }
        }
      }
    } catch (e: any) {
      this.logger.warn(`Error during auto-suspension sweep: ${e.message}`);
    }
  }

  // ─── Admin Full Server Reconfiguration ──────────────────────────────

  async adminUpdateServer(
    uuid: string,
    dto: {
      name?: string;
      description?: string;
      ownerId?: number;
      nodeId?: number;
      memory?: number;
      swap?: number;
      cpu?: number;
      disk?: number;
      io?: number;
      threads?: string;
      databases?: number;
      allocationsLimit?: number;
      backups?: number;
      autoSuspendDate?: string | null;
    },
  ) {
    const server = await this.getServerByUuid(uuid);

    const updateData: any = {};
    if (dto.name && dto.name.trim()) updateData.name = dto.name.trim();

    if (typeof dto.description !== 'undefined' || typeof dto.autoSuspendDate !== 'undefined') {
      const cleanDesc = (dto.description ?? server.description ?? '').replace(/\s*\[suspend:[^\]]+\]\s*/g, '').trim();
      const suspendTag = dto.autoSuspendDate ? ` [suspend:${dto.autoSuspendDate}]` : '';
      updateData.description = `${cleanDesc}${suspendTag}`.trim();
    }

    if (typeof dto.ownerId === 'number' && dto.ownerId !== server.userId) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.ownerId } });
      if (!user) throw new NotFoundException(`User with ID ${dto.ownerId} not found`);
      updateData.userId = dto.ownerId;
      await this.prisma.subuser.deleteMany({
        where: { serverId: server.id, userId: dto.ownerId },
      }).catch(() => {});
    }

    if (typeof dto.nodeId === 'number') updateData.nodeId = dto.nodeId;
    if (dto.memory !== undefined && dto.memory !== null) updateData.memory = clampInt4(dto.memory, 512);
    if (dto.swap !== undefined && dto.swap !== null) updateData.swap = clampInt4(dto.swap, 0);
    if (dto.cpu !== undefined && dto.cpu !== null) updateData.cpu = clampInt4(dto.cpu, 0);
    if (dto.disk !== undefined && dto.disk !== null) updateData.disk = clampInt4(dto.disk, 1024);
    if (dto.io !== undefined && dto.io !== null) updateData.io = clampInt4(dto.io, 500, 1000);
    if (typeof dto.threads !== 'undefined') updateData.threads = dto.threads;
    if (dto.databases !== undefined && dto.databases !== null) updateData.databaseLimit = clampInt4(dto.databases, 0);
    if (dto.allocationsLimit !== undefined && dto.allocationsLimit !== null) updateData.allocationLimit = clampInt4(dto.allocationsLimit, 0);
    if (dto.backups !== undefined && dto.backups !== null) updateData.backupLimit = clampInt4(dto.backups, 0);

    const updated = await this.prisma.server.update({
      where: { id: server.id },
      data: updateData,
      include: {
        node: true,
        owner: { select: { id: true, username: true, email: true } },
        allocation: true,
        allocations: true,
      },
    });

    // Sync updated build limits & configuration to Wings daemon
    try {
      const client = this.getWingsClient(updated.node);
      await client.syncServer(updated.uuid);
    } catch (err: any) {
      this.logger.warn(`Failed to sync server ${updated.uuid} to Wings after admin update: ${err.message}`);
    }

    return updated;
  }

  // ─── Minecraft Player Management ────────────────────────────────────

  async getPlayerData(uuid: string) {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);

    let ops: any[] = [];
    let whitelist: any[] = [];
    let bannedPlayers: any[] = [];
    let whitelistEnabled = false;

    // Read ops.json
    try {
      const opsContent = await client.getFileContents(server.uuid, 'ops.json');
      ops = JSON.parse(opsContent);
    } catch {
      ops = [];
    }

    // Read whitelist.json
    try {
      const wlContent = await client.getFileContents(server.uuid, 'whitelist.json');
      whitelist = JSON.parse(wlContent);
    } catch {
      whitelist = [];
    }

    // Read banned-players.json
    try {
      const banContent = await client.getFileContents(server.uuid, 'banned-players.json');
      bannedPlayers = JSON.parse(banContent);
    } catch {
      bannedPlayers = [];
    }

    // Read server.properties to check white-list status
    try {
      const props = await client.getFileContents(server.uuid, 'server.properties');
      whitelistEnabled = /^\s*white-list\s*=\s*true/im.test(props);
    } catch {
      whitelistEnabled = false;
    }

    return {
      ops,
      whitelist,
      bannedPlayers,
      whitelistEnabled,
    };
  }

  async opPlayer(uuid: string, name: string) {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    await client.sendCommands(server.uuid, [`op ${name.trim()}`]);
    return { success: true, message: `Granted operator status to ${name}` };
  }

  async deopPlayer(uuid: string, name: string) {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    await client.sendCommands(server.uuid, [`deop ${name.trim()}`]);
    return { success: true, message: `Revoked operator status from ${name}` };
  }

  async addWhitelist(uuid: string, name: string) {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    await client.sendCommands(server.uuid, [`whitelist add ${name.trim()}`]);
    return { success: true, message: `Added ${name} to whitelist` };
  }

  async removeWhitelist(uuid: string, name: string) {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    await client.sendCommands(server.uuid, [`whitelist remove ${name.trim()}`]);
    return { success: true, message: `Removed ${name} from whitelist` };
  }

  async toggleWhitelist(uuid: string, enabled: boolean) {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    await client.sendCommands(server.uuid, [enabled ? 'whitelist on' : 'whitelist off']);
    return { success: true, enabled, message: `Whitelist ${enabled ? 'enabled' : 'disabled'}` };
  }

  async banPlayer(uuid: string, name: string, reason?: string) {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    const cmd = reason && reason.trim() ? `ban ${name.trim()} ${reason.trim()}` : `ban ${name.trim()}`;
    await client.sendCommands(server.uuid, [cmd]);
    return { success: true, message: `Banned player ${name}` };
  }

  async pardonPlayer(uuid: string, name: string) {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    await client.sendCommands(server.uuid, [`pardon ${name.trim()}`]);
    return { success: true, message: `Pardoned player ${name}` };
  }

  async kickPlayer(uuid: string, name: string, reason?: string) {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    const cmd = reason && reason.trim() ? `kick ${name.trim()} ${reason.trim()}` : `kick ${name.trim()}`;
    await client.sendCommands(server.uuid, [cmd]);
    return { success: true, message: `Kicked player ${name}` };
  }
}

