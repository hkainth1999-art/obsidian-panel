import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listLocations() {
    return this.prisma.location.findMany({
      orderBy: { short: 'asc' },
      include: {
        _count: {
          select: { nodes: true },
        },
      },
    });
  }

  async getLocationById(id: number) {
    const loc = await this.prisma.location.findUnique({
      where: { id },
      include: {
        nodes: {
          select: {
            id: true,
            uuid: true,
            name: true,
            fqdn: true,
            behindProxy: true,
            memory: true,
            disk: true,
            createdAt: true,
          },
        },
      },
    });

    if (!loc) {
      throw new NotFoundException(`Location with ID ${id} not found`);
    }

    return loc;
  }

  async createLocation(dto: { short: string; long: string }) {
    const existing = await this.prisma.location.findUnique({
      where: { short: dto.short.trim() },
    });

    if (existing) {
      throw new ConflictException(`Location with code '${dto.short}' already exists`);
    }

    return this.prisma.location.create({
      data: {
        short: dto.short.trim().toUpperCase(),
        long: dto.long.trim(),
      },
    });
  }

  async updateLocation(id: number, dto: { short?: string; long?: string }) {
    await this.getLocationById(id);

    if (dto.short) {
      const existing = await this.prisma.location.findFirst({
        where: {
          short: dto.short.trim().toUpperCase(),
          NOT: { id },
        },
      });
      if (existing) {
        throw new ConflictException(`Location with code '${dto.short}' already exists`);
      }
    }

    return this.prisma.location.update({
      where: { id },
      data: {
        short: dto.short ? dto.short.trim().toUpperCase() : undefined,
        long: dto.long ? dto.long.trim() : undefined,
      },
    });
  }

  async deleteLocation(id: number) {
    const loc = await this.getLocationById(id);

    const nodeCount = await this.prisma.node.count({
      where: { locationId: id },
    });

    if (nodeCount > 0) {
      throw new BadRequestException(
        `Cannot delete location '${loc.short}'. It currently contains ${nodeCount} node(s). Delete or reassign the nodes first.`,
      );
    }

    await this.prisma.location.delete({ where: { id } });
    return { success: true, message: `Location ${loc.short} deleted` };
  }
}
