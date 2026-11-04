import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ApplicationApiGuard } from '../auth/guards/application-api.guard';
import { PrismaService } from '../../prisma/prisma.service';
import {
  fractalItem,
  fractalList,
  transformNest,
  transformEgg,
} from './application-transformers';

@ApiTags('Application API - Nests')
@ApiBearerAuth()
@UseGuards(ApplicationApiGuard)
@Controller('api/application/nests')
export class ApplicationNestsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List all nests (Application API)' })
  async listNests(
    @Query('page') pageStr?: string,
    @Query('per_page') perPageStr?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(perPageStr || '50', 10) || 50));
    const skip = (page - 1) * perPage;

    const [total, nests] = await Promise.all([
      this.prisma.nest.count(),
      this.prisma.nest.findMany({
        skip,
        take: perPage,
        orderBy: { id: 'asc' },
      }),
    ]);

    return fractalList('nest', nests.map(transformNest), total, page, perPage);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details for a specific nest' })
  async getNest(@Param('id', ParseIntPipe) id: number) {
    const nest = await this.prisma.nest.findUnique({
      where: { id },
      include: { eggs: true },
    });
    if (!nest) throw new NotFoundException('Nest not found');
    return fractalItem('nest', transformNest(nest));
  }

  @Get(':id/eggs')
  @ApiOperation({ summary: 'List all eggs for a specific nest' })
  async listEggs(
    @Param('id', ParseIntPipe) nestId: number,
    @Query('page') pageStr?: string,
    @Query('per_page') perPageStr?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(perPageStr || '50', 10) || 50));
    const skip = (page - 1) * perPage;

    const nest = await this.prisma.nest.findUnique({ where: { id: nestId } });
    if (!nest) throw new NotFoundException('Nest not found');

    const [total, eggs] = await Promise.all([
      this.prisma.egg.count({ where: { nestId } }),
      this.prisma.egg.findMany({
        where: { nestId },
        skip,
        take: perPage,
        orderBy: { id: 'asc' },
      }),
    ]);

    return fractalList('egg', eggs.map(transformEgg), total, page, perPage);
  }

  @Get(':nestId/eggs/:eggId')
  @ApiOperation({ summary: 'Get details for a specific egg in a nest' })
  async getEgg(
    @Param('nestId', ParseIntPipe) nestId: number,
    @Param('eggId', ParseIntPipe) eggId: number,
  ) {
    const egg = await this.prisma.egg.findFirst({
      where: { id: eggId, nestId },
      include: { variables: true },
    });
    if (!egg) throw new NotFoundException('Egg not found in specified nest');
    return fractalItem('egg', transformEgg(egg));
  }
}

