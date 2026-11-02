import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('Locations')
@ApiCookieAuth()
@UseGuards(SessionGuard, AdminGuard)
@Controller('api/admin/locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  @ApiOperation({ summary: 'List all locations' })
  async listLocations() {
    return this.locationsService.listLocations();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get location details' })
  async getLocation(@Param('id', ParseIntPipe) id: number) {
    return this.locationsService.getLocationById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new location' })
  async createLocation(
    @Body() dto: { short: string; long: string },
  ) {
    return this.locationsService.createLocation(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update location' })
  async updateLocation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { short?: string; long?: string },
  ) {
    return this.locationsService.updateLocation(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete location' })
  async deleteLocation(@Param('id', ParseIntPipe) id: number) {
    return this.locationsService.deleteLocation(id);
  }
}
