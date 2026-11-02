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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { EggsService } from './eggs.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('Eggs')
@ApiCookieAuth()
@UseGuards(SessionGuard, AdminGuard)
@Controller('api/admin/eggs')
export class EggsController {
  constructor(private readonly eggsService: EggsService) {}

  @Get()
  @ApiOperation({ summary: 'List all eggs (optionally filtered by nest)' })
  async listEggs(@Query('nestId') nestId?: string) {
    const parsedNestId = nestId ? parseInt(nestId, 10) : undefined;
    return this.eggsService.listEggs(parsedNestId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get egg details with variables' })
  async getEgg(@Param('id', ParseIntPipe) id: number) {
    return this.eggsService.getEggById(id);
  }

  @Post('import/:nestId')
  @ApiOperation({ summary: 'Import an official Pterodactyl egg JSON file' })
  async importEgg(
    @Param('nestId', ParseIntPipe) nestId: number,
    @Body() eggJson: any,
  ) {
    return this.eggsService.importEgg(nestId, eggJson);
  }

  @Get(':id/export')
  @ApiOperation({ summary: 'Export egg to standard Pterodactyl JSON format' })
  async exportEgg(@Param('id', ParseIntPipe) id: number) {
    return this.eggsService.exportEgg(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update egg configuration' })
  async updateEgg(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    dto: {
      name?: string;
      description?: string;
      startup?: string;
      customDockerImage?: string;
      dockerImages?: Record<string, string>;
      configStop?: string;
      scriptInstall?: string;
      scriptContainer?: string;
      scriptEntry?: string;
    },
  ) {
    return this.eggsService.updateEgg(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete egg' })
  async deleteEgg(@Param('id', ParseIntPipe) id: number) {
    return this.eggsService.deleteEgg(id);
  }
}
