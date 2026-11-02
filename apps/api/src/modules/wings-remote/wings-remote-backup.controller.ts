import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WingsNodeAuthGuard } from './guards/wings-node-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Wings Remote Backup Controller
 *
 * Implements the Panel endpoints that Wings calls for backup management:
 * - GET  /api/remote/backups/:backup - Get backup remote upload URLs
 * - POST /api/remote/backups/:backup - Report backup completion status
 * - POST /api/remote/backups/:backup/restore - Report restore status
 */
@ApiTags('Wings Remote')
@ApiBearerAuth()
@UseGuards(WingsNodeAuthGuard)
@Controller('api/remote/backups')
export class WingsRemoteBackupController {
  private readonly logger = new Logger(WingsRemoteBackupController.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /api/remote/backups/:backup
   *
   * Returns presigned S3 upload URLs when using remote backup storage.
   * Wings calls this to get upload targets for S3-backed backups.
   */
  @Get(':backup')
  @ApiOperation({ summary: 'Get backup remote upload URLs' })
  async getRemoteUploadUrls(
    @Param('backup') backupUuid: string,
    @Query('size') size?: string,
  ) {
    const backup = await this.prisma.backup.findUnique({
      where: { uuid: backupUuid },
    });

    if (!backup) {
      throw new NotFoundException('The requested backup was not found.');
    }

    // For local backups, this endpoint isn't used.
    // For S3 backups, we would generate presigned multipart upload URLs here.
    // This is a stub that will be implemented when S3 backup support is added.
    // For now, only local backups are supported.
    return {
      parts: [],
      part_size: 0,
      upload_id: '',
      complete_multipart_upload: '',
      abort_multipart_upload: '',
    };
  }

  /**
   * POST /api/remote/backups/:backup
   *
   * Wings calls this to report that a backup has completed or failed.
   * Updates the backup status, checksum, and size in the database.
   */
  @Post(':backup')
  @HttpCode(204)
  @ApiOperation({ summary: 'Report backup completion status' })
  async setBackupStatus(
    @Param('backup') backupUuid: string,
    @Body() body: {
      successful: boolean;
      checksum?: string;
      checksum_type?: string;
      size?: number;
    },
  ) {
    const backup = await this.prisma.backup.findUnique({
      where: { uuid: backupUuid },
    });

    if (!backup) {
      throw new NotFoundException('The requested backup was not found.');
    }

    await this.prisma.backup.update({
      where: { id: backup.id },
      data: {
        isSuccessful: body.successful,
        checksum: body.checksum ?? null,
        bytes: body.size ? BigInt(body.size) : BigInt(0),
        completedAt: new Date(),
      },
    });

    // Log the backup result
    await this.prisma.activityLog.create({
      data: {
        serverId: backup.serverId,
        event: body.successful ? 'backup:completed' : 'backup:failed',
        properties: {
          backup_uuid: backupUuid,
          checksum: body.checksum,
          size: body.size,
        },
      },
    });

    this.logger.log(
      `Backup ${backupUuid} ${body.successful ? 'completed' : 'failed'} ` +
      `(size: ${body.size ?? 'unknown'} bytes)`,
    );
  }

  /**
   * POST /api/remote/backups/:backup/restore
   *
   * Wings calls this to report that a backup restore has completed or failed.
   */
  @Post(':backup/restore')
  @HttpCode(204)
  @ApiOperation({ summary: 'Report backup restore status' })
  async setRestoreStatus(
    @Param('backup') backupUuid: string,
    @Body() body: { successful: boolean },
  ) {
    const backup = await this.prisma.backup.findUnique({
      where: { uuid: backupUuid },
      include: { server: true },
    });

    if (!backup) {
      throw new NotFoundException('The requested backup was not found.');
    }

    // If the server was in 'restoring' state, reset it
    if (backup.server.status === 'restoring') {
      await this.prisma.server.update({
        where: { id: backup.server.id },
        data: { status: null },
      });
    }

    await this.prisma.activityLog.create({
      data: {
        serverId: backup.serverId,
        event: body.successful ? 'backup:restore.completed' : 'backup:restore.failed',
        properties: { backup_uuid: backupUuid },
      },
    });

    this.logger.log(
      `Backup restore for ${backupUuid} ${body.successful ? 'completed' : 'failed'}`,
    );
  }
}
