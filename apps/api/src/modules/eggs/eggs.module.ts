import { Module } from '@nestjs/common';
import { EggsController } from './eggs.controller';
import { EggsService } from './eggs.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [EggsController],
  providers: [EggsService],
  exports: [EggsService],
})
export class EggsModule {}
