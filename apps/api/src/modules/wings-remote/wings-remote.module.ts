import { Module } from '@nestjs/common';
import { WingsRemoteController } from './wings-remote.controller';
import { WingsRemoteServerController } from './wings-remote-server.controller';
import { WingsRemoteSftpController } from './wings-remote-sftp.controller';
import { WingsRemoteBackupController } from './wings-remote-backup.controller';
import { WingsRemoteService } from './wings-remote.service';
import { WingsNodeAuthGuard } from './guards/wings-node-auth.guard';
import { NodesModule } from '../nodes/nodes.module';

@Module({
  imports: [NodesModule],
  controllers: [
    WingsRemoteController,
    WingsRemoteServerController,
    WingsRemoteSftpController,
    WingsRemoteBackupController,
  ],
  providers: [
    WingsRemoteService,
    WingsNodeAuthGuard,
  ],
  exports: [WingsRemoteService],
})
export class WingsRemoteModule {}
