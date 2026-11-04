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
  ParseIntPipe,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ApplicationApiGuard } from '../auth/guards/application-api.guard';
import { LocationsService } from '../locations/locations.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  fractalItem,
  fractalList,
  transformLocation,
} from './application-transformers';

@ApiTags('Application API - Locations')
@ApiBearerAuth()
@UseGuards(ApplicationApiGuard)
@Controller('api/application/locations')
export class ApplicationLocationsController {
  constructor(
    private readonly locationsService: LocationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all locations (Application API)' })
  async listLocations(
    @Query('page') pageStr?: string,
    @Query('per_page') perPageStr?: string,
    @Query('filter[short]') filterShort?: string,
    @Query('filter[long]') filterLong?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(perPageStr || '50', 10) || 50));
    const skip = (page - 1) * perPage;

    const where: any = {};
    if (filterShort) where.short = { contains: filterShort, mode: 'insensitive' };
    if (filterLong) where.long = { contains: filterLong, mode: 'insensitive' };

    const [total, locations] = await Promise.all([
      this.prisma.location.count({ where }),
      this.prisma.location.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { id: 'asc' },
      }),
    ]);

    return fractalList('location', locations.map(transformLocation), total, page, perPage);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details for a specific location' })
  async getLocation(@Param('id', ParseIntPipe) id: number) {
    const loc = await this.prisma.location.findUnique({ where: { id } });
    if (!loc) throw new NotFoundException('Location not found');
    return fractalItem('location', transformLocation(loc));
  }

  @Post()
  @ApiOperation({ summary: 'Create a new location' })
  async createLocation(@Body() body: any) {
    const short = body.short?.trim();
    const long = body.long?.trim() || '';

    if (!short) {
      throw new BadRequestException('short code is required');
    }

    const created = await this.locationsService.createLocation({ short, long });
    return fractalItem('location', transformLocation(created));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing location' })
  async updateLocation(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    const updated = await this.locationsService.updateLocation(id, {
      short: body.short,
      long: body.long,
    });
    return fractalItem('location', transformLocation(updated));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a location' })
  async deleteLocation(@Param('id', ParseIntPipe) id: number) {
    await this.locationsService.deleteLocation(id);
    return {};
  }
}

