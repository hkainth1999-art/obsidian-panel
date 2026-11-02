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
import { NestsService } from './nests.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('Nests')
@ApiCookieAuth()
@UseGuards(SessionGuard, AdminGuard)
@Controller('api/admin/nests')
export class NestsController {
  constructor(private readonly nestsService: NestsService) {}

  @Get()
  @ApiOperation({ summary: 'List all nests' })
  async listNests() {
    return this.nestsService.listNests();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get nest details and its eggs' })
  async getNest(@Param('id', ParseIntPipe) id: number) {
    return this.nestsService.getNestById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new nest' })
  async createNest(@Body() dto: { name: string; description?: string }) {
    return this.nestsService.createNest(dto);
  }

  @Post('seed-minecraft')
  @ApiOperation({ summary: 'Seed default Minecraft Java nest and eggs (Paper, Fabric, Forge, Vanilla, Purpur, Velocity)' })
  async seedMinecraft() {
    return this.nestsService.seedDefaultMinecraftNests();
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update nest' })
  async updateNest(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { name?: string; description?: string },
  ) {
    return this.nestsService.updateNest(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete nest' })
  async deleteNest(@Param('id', ParseIntPipe) id: number) {
    return this.nestsService.deleteNest(id);
  }
}
