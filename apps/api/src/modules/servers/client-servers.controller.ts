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
  Req,
  Res,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { ServersService } from './servers.service';
import { VersionsService } from './versions.service';
import { PluginsService } from './plugins.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { ServerAccessGuard, RequirePermissions } from './guards/server-access.guard';
import { Permission } from '@obsidian/permissions';

@ApiTags('Client Servers')
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller('api/client/servers')
export class ClientServersController {
  constructor(
    private readonly serversService: ServersService,
    private readonly versionsService: VersionsService,
    private readonly pluginsService: PluginsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List servers accessible to current user' })
  async listServers(@Req() req: any, @Query('all') all?: string) {
    // Regular customer or default client view: only servers owned by user or shared with user.
    // Admins can toggle viewing all servers with ?all=true.
    const showAll = Boolean(req.user?.isAdmin && all === 'true');
    return this.serversService.listClientServers(req.user.id, showAll);
  }

  @Get(':uuid')
  @UseGuards(ServerAccessGuard)
  @ApiOperation({ summary: 'Get details for a specific server' })
  async getServer(@Param('uuid') uuid: string) {
    return this.serversService.getServerByUuid(uuid);
  }

  @Patch(':uuid/variables')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.STARTUP_UPDATE)
  @ApiOperation({ summary: 'Update server environment variables and sync to Wings' })
  async updateServerVariables(
    @Param('uuid') uuid: string,
    @Body() body: { variables: Record<string, string> },
  ) {
    return this.serversService.updateServerVariables(uuid, body.variables);
  }

  @Patch(':uuid/startup')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.STARTUP_UPDATE)
  @ApiOperation({ summary: 'Update server docker image and startup configuration' })
  async updateServerStartup(
    @Param('uuid') uuid: string,
    @Body() body: { dockerImage?: string; startup?: string },
  ) {
    return this.serversService.updateServerStartup(uuid, body);
  }

  @Get(':uuid/ws')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.CONTROL_CONSOLE)
  @ApiOperation({ summary: 'Get WebSocket credentials for live console and metrics' })
  async getWebSocketCredentials(@Param('uuid') uuid: string, @Req() req: any) {
    return this.serversService.getWebSocketCredentials(uuid, req.user);
  }

  @Post(':uuid/power')
  @UseGuards(ServerAccessGuard)
  @ApiOperation({ summary: 'Send power action (start, stop, restart, kill)' })
  async sendPowerAction(
    @Param('uuid') uuid: string,
    @Body() body: { action: 'start' | 'stop' | 'restart' | 'kill' },
  ) {
    const server = await this.serversService.getServerByUuid(uuid);
    if (server.status === 'suspended' && (body.action === 'start' || body.action === 'restart')) {
      throw new BadRequestException('This server is currently suspended by an administrator and cannot be started.');
    }
    return this.serversService.sendPowerAction(uuid, body.action);
  }

  @Post(':uuid/state')
  @UseGuards(ServerAccessGuard)
  @ApiOperation({ summary: 'Update live server state from client/console stream' })
  async updateLiveState(
    @Param('uuid') uuid: string,
    @Body() body: { state: string },
  ) {
    if (body.state) {
      ServersService.setServerState(uuid, body.state);
    }
    return { success: true };
  }

  @Post(':uuid/command')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.CONTROL_CONSOLE)
  @ApiOperation({ summary: 'Send command to game console' })
  async sendCommand(
    @Param('uuid') uuid: string,
    @Body() body: { command: string },
  ) {
    return this.serversService.sendConsoleCommand(uuid, body.command);
  }

  // ─── Files ─────────────────────────────────────────────────────────

  @Get(':uuid/files/list')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.FILE_READ)
  @ApiOperation({ summary: 'List files in directory' })
  async listFiles(
    @Param('uuid') uuid: string,
    @Query('directory') directory?: string,
  ) {
    return this.serversService.listFiles(uuid, directory || '/');
  }

  @Get(':uuid/files/contents')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.FILE_READ)
  @ApiOperation({ summary: 'Get file content' })
  async getFileContents(
    @Param('uuid') uuid: string,
    @Query('file') file: string,
  ) {
    return this.serversService.getFileContents(uuid, file);
  }

  @Post(':uuid/files/write')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.FILE_UPDATE)
  @ApiOperation({ summary: 'Write file content' })
  async writeFile(
    @Param('uuid') uuid: string,
    @Query('file') file: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    let content: string | Buffer;
    if (Buffer.isBuffer(req.body)) {
      content = req.body;
    } else if (body && typeof body === 'object' && body.isBase64 && typeof body.content === 'string') {
      content = Buffer.from(body.content, 'base64');
    } else if (body && typeof body === 'object' && typeof body.content === 'string') {
      content = body.content;
    } else if (typeof body === 'string') {
      content = body;
    } else {
      content = '';
    }
    return this.serversService.writeFile(uuid, file, content);
  }

  @Post(':uuid/files/rename')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.FILE_UPDATE)
  @ApiOperation({ summary: 'Rename or move files' })
  async renameFiles(
    @Param('uuid') uuid: string,
    @Body() body: { root: string; files: Array<{ from: string; to: string }> },
  ) {
    return this.serversService.renameFiles(uuid, body.root, body.files);
  }

  @Post(':uuid/files/delete')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.FILE_DELETE)
  @ApiOperation({ summary: 'Delete files or folders' })
  async deleteFiles(
    @Param('uuid') uuid: string,
    @Body() body: { root: string; files: string[] },
  ) {
    return this.serversService.deleteFiles(uuid, body.root, body.files);
  }

  @Post(':uuid/files/decompress')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.FILE_CREATE)
  @ApiOperation({ summary: 'Decompress an archive file (.zip, .tar, .tar.gz, etc.)' })
  async decompressFile(
    @Param('uuid') uuid: string,
    @Body() body: { root: string; file: string },
  ) {
    return this.serversService.decompressFile(uuid, body.root, body.file);
  }

  @Post(':uuid/files/folder')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.FILE_CREATE)
  @ApiOperation({ summary: 'Create a new directory / folder' })
  async createFolder(
    @Param('uuid') uuid: string,
    @Body() body: { root: string; name: string },
  ) {
    return this.serversService.createFolder(uuid, body.root, body.name);
  }

  @Post(':uuid/files/compress')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.FILE_CREATE)
  @ApiOperation({ summary: 'Compress files or folders into a zip archive' })
  async compressFiles(
    @Param('uuid') uuid: string,
    @Body() body: { root: string; files: string[] },
  ) {
    return this.serversService.compressFiles(uuid, body.root, body.files);
  }

  // ─── Network Allocations ──────────────────────────────────────────

  @Get(':uuid/network/allocations')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.ALLOCATION_READ)
  @ApiOperation({ summary: 'Get server network allocations' })
  async getNetworkAllocations(@Param('uuid') uuid: string) {
    return this.serversService.getServerAllocations(uuid);
  }

  @Post(':uuid/network/allocations')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.ALLOCATION_CREATE)
  @ApiOperation({ summary: 'Assign additional allocation to server within allocation limit' })
  async assignNetworkAllocation(
    @Param('uuid') uuid: string,
    @Body() body: { allocationId?: number },
  ) {
    return this.serversService.assignClientAllocation(uuid, body?.allocationId ? Number(body.allocationId) : undefined);
  }

  @Delete(':uuid/network/allocations/:allocationId')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.ALLOCATION_DELETE)
  @ApiOperation({ summary: 'Delete secondary network allocation' })
  async unassignNetworkAllocation(
    @Param('uuid') uuid: string,
    @Param('allocationId', ParseIntPipe) allocationId: number,
  ) {
    return this.serversService.unassignAllocationFromServer(uuid, allocationId);
  }

  @Post(':uuid/network/allocations/:allocationId/primary')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.ALLOCATION_UPDATE)
  @ApiOperation({ summary: 'Set secondary allocation as primary' })
  async setPrimaryNetworkAllocation(
    @Param('uuid') uuid: string,
    @Param('allocationId', ParseIntPipe) allocationId: number,
  ) {
    return this.serversService.setPrimaryAllocationForServer(uuid, allocationId);
  }

  // ─── Backups ───────────────────────────────────────────────────────

  @Get(':uuid/backups')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.BACKUP_READ)
  @ApiOperation({ summary: 'List server backups' })
  async listBackups(@Param('uuid') uuid: string) {
    return this.serversService.listBackups(uuid);
  }

  @Post(':uuid/backups')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.BACKUP_CREATE)
  @ApiOperation({ summary: 'Create a backup' })
  async createBackup(
    @Param('uuid') uuid: string,
    @Body() body: { name?: string; ignored?: string },
  ) {
    return this.serversService.createBackup(uuid, body.name, body.ignored);
  }

  @Delete(':uuid/backups/:backupUuid')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.BACKUP_DELETE)
  @ApiOperation({ summary: 'Delete backup' })
  async deleteBackup(
    @Param('uuid') uuid: string,
    @Param('backupUuid') backupUuid: string,
  ) {
    return this.serversService.deleteBackup(uuid, backupUuid);
  }

  @Post(':uuid/backups/:backupUuid/restore')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.BACKUP_RESTORE)
  @ApiOperation({ summary: 'Restore server from backup' })
  async restoreBackup(
    @Param('uuid') uuid: string,
    @Param('backupUuid') backupUuid: string,
    @Body() body: { truncateDirectory?: boolean },
  ) {
    return this.serversService.restoreBackup(uuid, backupUuid, body.truncateDirectory);
  }

  @Get(':uuid/backups/:backupUuid/download')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.BACKUP_DOWNLOAD)
  @ApiOperation({ summary: 'Get backup download signed URL' })
  async getBackupDownload(
    @Param('uuid') uuid: string,
    @Param('backupUuid') backupUuid: string,
    @Req() req: any,
  ) {
    return this.serversService.getBackupDownload(uuid, backupUuid, req.user);
  }

  @Get(':uuid/backups/:backupUuid/stream')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.BACKUP_DOWNLOAD)
  @ApiOperation({ summary: 'Stream backup archive directly' })
  async streamBackup(
    @Param('uuid') uuid: string,
    @Param('backupUuid') backupUuid: string,
    @Res() reply: any,
    @Req() req: any,
  ) {
    return this.serversService.streamBackup(uuid, backupUuid, reply, req.user);
  }

  // ─── Subusers ──────────────────────────────────────────────────────

  @Get(':uuid/subusers')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.USER_READ)
  @ApiOperation({ summary: 'List server subusers' })
  async listSubusers(@Param('uuid') uuid: string) {
    return this.serversService.listSubusers(uuid);
  }

  @Post(':uuid/subusers')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.USER_CREATE)
  @ApiOperation({ summary: 'Add a subuser' })
  async addSubuser(
    @Param('uuid') uuid: string,
    @Body() body: { email: string; permissions: string[] },
  ) {
    return this.serversService.addSubuser(uuid, body.email, body.permissions);
  }

  @Patch(':uuid/subusers/:subuserId')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.USER_UPDATE)
  @ApiOperation({ summary: 'Update subuser permissions' })
  async updateSubuser(
    @Param('uuid') uuid: string,
    @Param('subuserId', ParseIntPipe) subuserId: number,
    @Body() body: { permissions: string[] },
  ) {
    return this.serversService.updateSubuser(uuid, subuserId, body.permissions);
  }

  @Delete(':uuid/subusers/:subuserId')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.USER_DELETE)
  @ApiOperation({ summary: 'Remove a subuser' })
  async deleteSubuser(
    @Param('uuid') uuid: string,
    @Param('subuserId', ParseIntPipe) subuserId: number,
  ) {
    return this.serversService.deleteSubuser(uuid, subuserId);
  }

  // ─── Reinstall ─────────────────────────────────────────────────────

  @Post(':uuid/reinstall')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.SETTINGS_REINSTALL)
  @ApiOperation({ summary: 'Reinstall server software and files' })
  async reinstallServer(@Param('uuid') uuid: string) {
    return this.serversService.reinstallServer(uuid);
  }

  // ─── Databases ─────────────────────────────────────────────────────

  @Get(':uuid/databases')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.DATABASE_READ)
  @ApiOperation({ summary: 'List server databases' })
  async listDatabases(@Param('uuid') uuid: string) {
    return this.serversService.listDatabases(uuid);
  }

  @Post(':uuid/databases')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.DATABASE_CREATE)
  @ApiOperation({ summary: 'Create a new database' })
  async createDatabase(
    @Param('uuid') uuid: string,
    @Body() body: { database: string; remote?: string },
  ) {
    return this.serversService.createDatabase(uuid, body.database, body.remote);
  }

  @Delete(':uuid/databases/:databaseId')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.DATABASE_DELETE)
  @ApiOperation({ summary: 'Delete a database' })
  async deleteDatabase(
    @Param('uuid') uuid: string,
    @Param('databaseId', ParseIntPipe) databaseId: number,
  ) {
    return this.serversService.deleteDatabase(uuid, databaseId);
  }

  @Post(':uuid/databases/:databaseId/rotate-password')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.DATABASE_UPDATE)
  @ApiOperation({ summary: 'Rotate database password' })
  async rotateDatabasePassword(
    @Param('uuid') uuid: string,
    @Param('databaseId', ParseIntPipe) databaseId: number,
  ) {
    return this.serversService.rotateDatabasePassword(uuid, databaseId);
  }

  // ─── Schedules ─────────────────────────────────────────────────────

  @Get(':uuid/schedules')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.SCHEDULE_READ)
  @ApiOperation({ summary: 'List server schedules' })
  async listSchedules(@Param('uuid') uuid: string) {
    return this.serversService.listSchedules(uuid);
  }

  @Post(':uuid/schedules')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.SCHEDULE_CREATE)
  @ApiOperation({ summary: 'Create a schedule' })
  async createSchedule(
    @Param('uuid') uuid: string,
    @Body()
    body: {
      name: string;
      cronMinute: string;
      cronHour: string;
      cronDayOfMonth: string;
      cronMonth: string;
      cronDayOfWeek: string;
      isActive?: boolean;
      onlyWhenOnline?: boolean;
    },
  ) {
    return this.serversService.createSchedule(uuid, body);
  }

  @Delete(':uuid/schedules/:scheduleId')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.SCHEDULE_DELETE)
  @ApiOperation({ summary: 'Delete a schedule' })
  async deleteSchedule(
    @Param('uuid') uuid: string,
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
  ) {
    return this.serversService.deleteSchedule(uuid, scheduleId);
  }

  // ─── Version Manager ────────────────────────────────────────────────
  @Get(':uuid/versions')
  @UseGuards(ServerAccessGuard)
  @ApiOperation({ summary: 'List supported Minecraft server/proxy software and versions' })
  async listVersions() {
    return this.versionsService.getSoftwareCatalog();
  }

  @Post(':uuid/versions/install')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.STARTUP_UPDATE)
  @ApiOperation({ summary: 'Download and install a specific software version on the server' })
  async installVersion(
    @Param('uuid') uuid: string,
    @Body()
    body: {
      software: string;
      version: string;
      customJarName?: string;
    },
  ) {
    return this.versionsService.installVersion(uuid, body);
  }

  // ─── Plugin Manager ─────────────────────────────────────────────────

  @Get(':uuid/plugins')
  @UseGuards(ServerAccessGuard)
  @ApiOperation({ summary: 'Search and browse plugins from SpigotMC and Modrinth' })
  async searchPlugins(
    @Query('query') query?: string,
    @Query('source') source?: 'all' | 'spigot' | 'modrinth',
    @Query('page') page?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    return this.pluginsService.searchPlugins(query || '', source || 'all', pageNum);
  }

  @Get(':uuid/plugins/installed')
  @UseGuards(ServerAccessGuard)
  @ApiOperation({ summary: 'List installed plugins from server /plugins directory' })
  async getInstalledPlugins(@Param('uuid') uuid: string) {
    return this.pluginsService.getInstalledPlugins(uuid);
  }

  @Get(':uuid/plugins/versions')
  @UseGuards(ServerAccessGuard)
  @ApiOperation({ summary: 'List release versions and supported Minecraft versions for a plugin' })
  async getPluginVersions(
    @Param('uuid') uuid: string,
    @Query('source') source: 'spigot' | 'modrinth',
    @Query('pluginId') pluginId: string,
  ) {
    return this.pluginsService.getPluginVersions(uuid, source || 'modrinth', pluginId);
  }

  @Post(':uuid/plugins/install')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.FILE_UPDATE)
  @ApiOperation({ summary: 'Install a plugin from SpigotMC or Modrinth into /plugins' })
  async installPlugin(
    @Param('uuid') uuid: string,
    @Body()
    body: {
      source: 'spigot' | 'modrinth';
      pluginId: string;
      versionId?: string;
      mcVersion?: string;
      fileName?: string;
    },
  ) {
    return this.pluginsService.installPlugin(uuid, body);
  }

  @Delete(':uuid/plugins/uninstall')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.FILE_DELETE)
  @ApiOperation({ summary: 'Uninstall (delete) a plugin from /plugins' })
  async uninstallPlugin(
    @Param('uuid') uuid: string,
    @Body() body: { fileName: string },
  ) {
    return this.pluginsService.uninstallPlugin(uuid, body.fileName);
  }

  @Post(':uuid/plugins/toggle')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.FILE_UPDATE)
  @ApiOperation({ summary: 'Enable or disable a plugin' })
  async togglePlugin(
    @Param('uuid') uuid: string,
    @Body() body: { fileName: string },
  ) {
    return this.pluginsService.togglePlugin(uuid, body.fileName);
  }

  // ─── Player Management ──────────────────────────────────────────────

  @Get(':uuid/players')
  @UseGuards(ServerAccessGuard)
  @ApiOperation({ summary: 'Get operators, whitelist, banned players, and whitelist status' })
  async getPlayers(@Param('uuid') uuid: string) {
    return this.serversService.getPlayerData(uuid);
  }

  @Post(':uuid/players/op')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.CONTROL_CONSOLE)
  @ApiOperation({ summary: 'Grant server operator (OP) status' })
  async opPlayer(@Param('uuid') uuid: string, @Body() body: { name: string }) {
    return this.serversService.opPlayer(uuid, body.name);
  }

  @Delete(':uuid/players/op/:name')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.CONTROL_CONSOLE)
  @ApiOperation({ summary: 'Revoke server operator (OP) status' })
  async deopPlayer(@Param('uuid') uuid: string, @Param('name') name: string) {
    return this.serversService.deopPlayer(uuid, name);
  }

  @Post(':uuid/players/whitelist')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.CONTROL_CONSOLE)
  @ApiOperation({ summary: 'Add player to whitelist' })
  async addWhitelist(@Param('uuid') uuid: string, @Body() body: { name: string }) {
    return this.serversService.addWhitelist(uuid, body.name);
  }

  @Delete(':uuid/players/whitelist/:name')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.CONTROL_CONSOLE)
  @ApiOperation({ summary: 'Remove player from whitelist' })
  async removeWhitelist(@Param('uuid') uuid: string, @Param('name') name: string) {
    return this.serversService.removeWhitelist(uuid, name);
  }

  @Post(':uuid/players/whitelist/toggle')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.CONTROL_CONSOLE)
  @ApiOperation({ summary: 'Toggle server whitelist ON or OFF' })
  async toggleWhitelist(@Param('uuid') uuid: string, @Body() body: { enabled: boolean }) {
    return this.serversService.toggleWhitelist(uuid, body.enabled);
  }

  @Post(':uuid/players/ban')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.CONTROL_CONSOLE)
  @ApiOperation({ summary: 'Ban a player' })
  async banPlayer(@Param('uuid') uuid: string, @Body() body: { name: string; reason?: string }) {
    return this.serversService.banPlayer(uuid, body.name, body.reason);
  }

  @Post(':uuid/players/pardon')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.CONTROL_CONSOLE)
  @ApiOperation({ summary: 'Pardon (unban) a player' })
  async pardonPlayer(@Param('uuid') uuid: string, @Body() body: { name: string }) {
    return this.serversService.pardonPlayer(uuid, body.name);
  }

  @Post(':uuid/players/kick')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(Permission.CONTROL_CONSOLE)
  @ApiOperation({ summary: 'Kick an online player' })
  async kickPlayer(@Param('uuid') uuid: string, @Body() body: { name: string; reason?: string }) {
    return this.serversService.kickPlayer(uuid, body.name, body.reason);
  }
}


