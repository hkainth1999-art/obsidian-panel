import { Module } from '@nestjs/common';
import { NestsController } from './nests.controller';
import { NestsService } from './nests.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [NestsController],
  providers: [NestsService],
  exports: [NestsService],
})
export class NestsModule {}
