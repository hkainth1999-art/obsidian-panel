import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AllocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAllocationsForNode(nodeId: number, isAssigned?: boolean) {
    const where: any = { nodeId };
    if (typeof isAssigned === 'boolean') {
      where.serverId = isAssigned ? { not: null } : null;
    }

    return this.prisma.allocation.findMany({
      where,
      orderBy: [{ ip: 'asc' }, { port: 'asc' }],
      include: {
        server: {
          select: {
            id: true,
            uuid: true,
            name: true,
          },
        },
      },
    });
  }

  async createAllocations(
    nodeId: number,
    dto: {
      ip: string;
      alias?: string;
      ports: string[];
    },
  ) {
    const node = await this.prisma.node.findUnique({
      where: { id: nodeId },
    });
    if (!node) {
      throw new NotFoundException(`Node with ID ${nodeId} not found`);
    }

    const portsToCreate = new Set<number>();
    for (const portEntry of dto.ports) {
      if (portEntry.includes('-')) {
        const [startStr = '', endStr = ''] = portEntry.split('-');
        const start = parseInt(startStr.trim(), 10);
        const end = parseInt(endStr.trim(), 10);
        if (isNaN(start) || isNaN(end) || start < 1024 || end > 65535 || start > end) {
          throw new BadRequestException(
            `Invalid port range '${portEntry}'. Ports must be between 1024 and 65535.`,
          );
        }
        if (end - start > 1000) {
          throw new BadRequestException('Cannot create more than 1000 ports in a single range');
        }
        for (let p = start; p <= end; p++) {
          portsToCreate.add(p);
        }
      } else {
        const port = parseInt(portEntry.trim(), 10);
        if (isNaN(port) || port < 1024 || port > 65535) {
          throw new BadRequestException(
            `Invalid port '${portEntry}'. Port must be between 1024 and 65535.`,
          );
        }
        portsToCreate.add(port);
      }
    }

    if (portsToCreate.size === 0) {
      throw new BadRequestException('No valid ports provided');
    }

    const existing = await this.prisma.allocation.findMany({
      where: {
        nodeId,
        ip: dto.ip.trim(),
        port: { in: Array.from(portsToCreate) },
      },
      select: { port: true },
    });

    const existingPorts = new Set(existing.map((e) => e.port));
    const newPorts = Array.from(portsToCreate).filter((p) => !existingPorts.has(p));

    if (newPorts.length === 0) {
      throw new ConflictException('All requested ports already exist for this IP on this node');
    }

    const created = await this.prisma.$transaction(
      newPorts.map((port) =>
        this.prisma.allocation.create({
          data: {
            nodeId,
            ip: dto.ip.trim(),
            port,
            alias: dto.alias?.trim() || null,
          },
        }),
      ),
    );

    return {
      created: created.length,
      skipped: existingPorts.size,
      allocations: created,
    };
  }

  async updateAllocation(
    id: number,
    dto: { alias?: string | null; notes?: string | null },
  ) {
    const alloc = await this.prisma.allocation.findUnique({ where: { id } });
    if (!alloc) {
      throw new NotFoundException(`Allocation with ID ${id} not found`);
    }

    return this.prisma.allocation.update({
      where: { id },
      data: {
        alias: dto.alias !== undefined ? dto.alias : undefined,
        notes: dto.notes !== undefined ? dto.notes : undefined,
      },
    });
  }

  async deleteAllocation(id: number) {
    const alloc = await this.prisma.allocation.findUnique({
      where: { id },
      include: {
        server: { select: { id: true, name: true } },
      },
    });

    if (!alloc) {
      throw new NotFoundException(`Allocation with ID ${id} not found`);
    }

    if (alloc.serverId !== null) {
      throw new BadRequestException(
        `Cannot delete allocation ${alloc.ip}:${alloc.port}. It is currently assigned to a server.`,
      );
    }

    await this.prisma.allocation.delete({ where: { id } });
    return { success: true, message: `Allocation ${alloc.ip}:${alloc.port} deleted` };
  }

  async bulkDeleteAllocations(ids: number[]) {
    const result = await this.prisma.allocation.deleteMany({
      where: {
        id: { in: ids },
        serverId: null,
      },
    });

    return {
      deletedCount: result.count,
    };
  }
}
