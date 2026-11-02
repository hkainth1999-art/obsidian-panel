import { Module } from '@nestjs/common';
import { ClientServersController } from './client-servers.controller';
import { AdminServersController } from './admin-servers.controller';
import { ServersService } from './servers.service';
import { VersionsService } from './versions.service';
import { PluginsService } from './plugins.service';
import { AuthModule } from '../auth/auth.module';
import { WingsRemoteModule } from '../wings-remote/wings-remote.module';

@Module({
  imports: [AuthModule, WingsRemoteModule],
  controllers: [ClientServersController, AdminServersController],
  providers: [ServersService, VersionsService, PluginsService],
  exports: [ServersService, VersionsService, PluginsService],
})
export class ServersModule {}

