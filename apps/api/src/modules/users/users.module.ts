import { Module } from '@nestjs/common';
import { UsersController, UserProfileController, AccountController } from './users.controller';
import { UsersService } from './users.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UsersController, UserProfileController, AccountController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
