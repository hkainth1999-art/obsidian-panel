import { Module } from '@nestjs/common';
import { NodesController } from './nodes.controller';
import { ApplicationNodesController } from './application-nodes.controller';
import { NodesService } from './nodes.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [NodesController, ApplicationNodesController],
  providers: [NodesService],
  exports: [NodesService],
})
export class NodesModule {}
