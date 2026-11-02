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
import { AllocationsService } from './allocations.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('Allocations')
@ApiCookieAuth()
@UseGuards(SessionGuard, AdminGuard)
@Controller('api/admin')
export class AllocationsController {
  constructor(private readonly allocationsService: AllocationsService) {}

  @Get('nodes/:nodeId/allocations')
  @ApiOperation({ summary: 'List allocations for a node' })
  async listAllocations(
    @Param('nodeId', ParseIntPipe) nodeId: number,
    @Query('assigned') assigned?: string,
  ) {
    const isAssigned =
      assigned === 'true' ? true : assigned === 'false' ? false : undefined;
    return this.allocationsService.listAllocationsForNode(nodeId, isAssigned);
  }

  @Post('nodes/:nodeId/allocations')
  @ApiOperation({ summary: 'Create single or range of port allocations for a node' })
  async createAllocations(
    @Param('nodeId', ParseIntPipe) nodeId: number,
    @Body()
    dto: {
      ip: string;
      alias?: string;
      ports: string[];
    },
  ) {
    return this.allocationsService.createAllocations(nodeId, dto);
  }

  @Patch('allocations/:id')
  @ApiOperation({ summary: 'Update allocation alias or notes' })
  async updateAllocation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { alias?: string | null; notes?: string | null },
  ) {
    return this.allocationsService.updateAllocation(id, dto);
  }

  @Delete('allocations/:id')
  @ApiOperation({ summary: 'Delete unassigned allocation' })
  async deleteAllocation(@Param('id', ParseIntPipe) id: number) {
    return this.allocationsService.deleteAllocation(id);
  }

  @Post('allocations/bulk-delete')
  @ApiOperation({ summary: 'Bulk delete unassigned allocations' })
  async bulkDelete(@Body() body: { ids: number[] }) {
    return this.allocationsService.bulkDeleteAllocations(body.ids);
  }
}
