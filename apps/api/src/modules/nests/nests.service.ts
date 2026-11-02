import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NestsService implements OnModuleInit {
  private readonly logger = new Logger(NestsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.seedDefaultMinecraftNests();
    } catch (err: any) {
      this.logger.warn(`Auto-seeding default Minecraft eggs check: ${err.message}`);
    }
  }

  async listNests() {
    return this.prisma.nest.findMany({
      orderBy: { id: 'asc' },
      include: {
        _count: {
          select: {
            eggs: true,
            servers: true,
          },
        },
      },
    });
  }

  async getNestById(id: number) {
    const nest = await this.prisma.nest.findUnique({
      where: { id },
      include: {
        eggs: {
          include: {
            _count: {
              select: { servers: true, variables: true },
            },
          },
        },
        _count: {
          select: { servers: true },
        },
      },
    });

    if (!nest) {
      throw new NotFoundException(`Nest with ID ${id} not found`);
    }

    return nest;
  }

  async createNest(dto: { name: string; description?: string }) {
    return this.prisma.nest.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim(),
      },
    });
  }

  async updateNest(id: number, dto: { name?: string; description?: string }) {
    await this.getNestById(id);

    return this.prisma.nest.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : undefined,
        description: dto.description !== undefined ? dto.description.trim() : undefined,
      },
    });
  }

  async deleteNest(id: number) {
    const nest = await this.getNestById(id);

    if (nest.eggs.length > 0) {
      throw new BadRequestException(
        `Cannot delete nest '${nest.name}'. It contains ${nest.eggs.length} egg(s). Delete or reassign eggs first.`,
      );
    }

    return this.prisma.nest.delete({
      where: { id },
    });
  }

  async seedDefaultMinecraftNests() {
    let nest = await this.prisma.nest.findFirst({
      where: { name: 'Minecraft' },
    });

    if (!nest) {
      nest = await this.prisma.nest.create({
        data: {
          name: 'Minecraft',
          description: 'Minecraft Java Edition game servers and proxies',
        },
      });
    }

    const defaultEggs = [
      {
        name: 'Paper',
        author: 'support@pterodactyl.io',
        description: 'High performance Spigot-compatible Minecraft software with extensive gameplay fixes.',
        startup: 'java -Xms128M -XX:MaxRAMPercentage=95.0 -Dterminal.jline=false -Dterminal.ansi=true -jar {{SERVER_JARFILE}}',
        dockerImages: {
          'Java 25 (Recommended)': 'ghcr.io/pterodactyl/yolks:java_25',
          'Java 21': 'ghcr.io/pterodactyl/yolks:java_21',
          'Java 17': 'ghcr.io/pterodactyl/yolks:java_17',
          'Java 11': 'ghcr.io/pterodactyl/yolks:java_11',
          'Java 8': 'ghcr.io/pterodactyl/yolks:java_8',
        },
        variables: [
          { name: 'Server Jar File', envVariable: 'SERVER_JARFILE', defaultValue: 'paper.jar', userViewable: true, userEditable: true },
          { name: 'Minecraft Version', envVariable: 'MINECRAFT_VERSION', defaultValue: 'latest', userViewable: true, userEditable: true },
          { name: 'Build Number', envVariable: 'BUILD_NUMBER', defaultValue: 'latest', userViewable: true, userEditable: true },
        ],
      },
      {
        name: 'Fabric',
        author: 'support@pterodactyl.io',
        description: 'Lightweight, modern and modular Minecraft mod loader.',
        startup: 'java -Xms128M -XX:MaxRAMPercentage=95.0 -jar {{SERVER_JARFILE}}',
        dockerImages: {
          'Java 25 (Recommended)': 'ghcr.io/pterodactyl/yolks:java_25',
          'Java 21': 'ghcr.io/pterodactyl/yolks:java_21',
          'Java 17': 'ghcr.io/pterodactyl/yolks:java_17',
        },
        variables: [
          { name: 'Server Jar File', envVariable: 'SERVER_JARFILE', defaultValue: 'fabric-server-launch.jar', userViewable: true, userEditable: true },
          { name: 'Minecraft Version', envVariable: 'MC_VERSION', defaultValue: 'latest', userViewable: true, userEditable: true },
          { name: 'Fabric Version', envVariable: 'FABRIC_VERSION', defaultValue: 'latest', userViewable: true, userEditable: true },
        ],
      },
      {
        name: 'Forge',
        author: 'support@pterodactyl.io',
        description: 'The standard and most popular mod loader for heavy Minecraft modpacks.',
        startup: 'java -Xms128M -XX:MaxRAMPercentage=95.0 -jar {{SERVER_JARFILE}}',
        dockerImages: {
          'Java 25 (Recommended)': 'ghcr.io/pterodactyl/yolks:java_25',
          'Java 21 (1.20.5+)': 'ghcr.io/pterodactyl/yolks:java_21',
          'Java 17 (1.18 - 1.20.4)': 'ghcr.io/pterodactyl/yolks:java_17',
          'Java 8 (1.12.2 and older)': 'ghcr.io/pterodactyl/yolks:java_8',
        },
        variables: [
          { name: 'Server Jar File', envVariable: 'SERVER_JARFILE', defaultValue: 'forge.jar', userViewable: true, userEditable: true },
          { name: 'Minecraft Version', envVariable: 'MC_VERSION', defaultValue: '1.20.4', userViewable: true, userEditable: true },
        ],
      },
      {
        name: 'Vanilla Minecraft',
        author: 'support@pterodactyl.io',
        description: 'Official Mojang Minecraft Java Edition server software.',
        startup: 'java -Xms128M -XX:MaxRAMPercentage=95.0 -jar {{SERVER_JARFILE}} nogui',
        dockerImages: {
          'Java 25 (Recommended)': 'ghcr.io/pterodactyl/yolks:java_25',
          'Java 21': 'ghcr.io/pterodactyl/yolks:java_21',
          'Java 17': 'ghcr.io/pterodactyl/yolks:java_17',
        },
        variables: [
          { name: 'Server Jar File', envVariable: 'SERVER_JARFILE', defaultValue: 'server.jar', userViewable: true, userEditable: true },
          { name: 'Vanilla Version', envVariable: 'VANILLA_VERSION', defaultValue: 'latest', userViewable: true, userEditable: true },
        ],
      },
      {
        name: 'Purpur',
        author: 'support@pterodactyl.io',
        description: 'Drop-in replacement for Paper servers designed for high configurability and performance.',
        startup: 'java -Xms128M -XX:MaxRAMPercentage=95.0 -jar {{SERVER_JARFILE}}',
        dockerImages: {
          'Java 25 (Recommended)': 'ghcr.io/pterodactyl/yolks:java_25',
          'Java 21': 'ghcr.io/pterodactyl/yolks:java_21',
          'Java 17': 'ghcr.io/pterodactyl/yolks:java_17',
        },
        variables: [
          { name: 'Server Jar File', envVariable: 'SERVER_JARFILE', defaultValue: 'purpur.jar', userViewable: true, userEditable: true },
          { name: 'Minecraft Version', envVariable: 'MINECRAFT_VERSION', defaultValue: 'latest', userViewable: true, userEditable: true },
        ],
      },
      {
        name: 'Velocity',
        author: 'support@pterodactyl.io',
        description: 'Next-generation Minecraft server proxy offering unparalleled performance and stability.',
        startup: 'java -Xms128M -XX:MaxRAMPercentage=95.0 -jar {{SERVER_JARFILE}}',
        dockerImages: {
          'Java 25 (Recommended)': 'ghcr.io/pterodactyl/yolks:java_25',
          'Java 21': 'ghcr.io/pterodactyl/yolks:java_21',
          'Java 17': 'ghcr.io/pterodactyl/yolks:java_17',
        },
        variables: [
          { name: 'Server Jar File', envVariable: 'SERVER_JARFILE', defaultValue: 'velocity.jar', userViewable: true, userEditable: true },
        ],
      },
    ];

    let createdCount = 0;
    for (const eggData of defaultEggs) {
      const existing = await this.prisma.egg.findFirst({
        where: { nestId: nest.id, name: eggData.name },
      });
      if (!existing) {
        const createdEgg = await this.prisma.egg.create({
          data: {
            nestId: nest.id,
            author: eggData.author,
            name: eggData.name,
            description: eggData.description,
            startup: eggData.startup,
            dockerImages: eggData.dockerImages,
            features: ['eula'],
          },
        });
        for (const [idx, v] of eggData.variables.entries()) {
          await this.prisma.eggVariable.create({
            data: {
              eggId: createdEgg.id,
              name: v.name,
              description: '',
              envVariable: v.envVariable,
              defaultValue: v.defaultValue,
              userViewable: v.userViewable,
              userEditable: v.userEditable,
              sortOrder: idx + 1,
            },
          });
        }
        createdCount++;
      } else {
        // Ensure existing egg has Java 25 as the default recommendation
        const currentImages = (existing.dockerImages as Record<string, string>) || {};
        const hasJava25 = Object.values(currentImages).some((img) => String(img).includes('java_25'));
        if (!hasJava25) {
          const mergedImages = {
            'Java 25 (Recommended)': 'ghcr.io/pterodactyl/yolks:java_25',
            ...currentImages,
          };
          await this.prisma.egg.update({
            where: { id: existing.id },
            data: { dockerImages: mergedImages },
          });
        }
      }
    }

    return {
      success: true,
      nestId: nest.id,
      message: `Seeded ${createdCount} Minecraft egg(s) into '${nest.name}' nest.`,
    };
  }
}
