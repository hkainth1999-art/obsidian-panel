import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ApiKeysService } from './api-keys.service';
import { AdminApiKeysController, AccountApiKeysController } from './api-keys.controller';
import { SessionGuard } from './guards/session.guard';
import { AdminGuard } from './guards/admin.guard';
import { ApplicationApiGuard } from './guards/application-api.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret:
          config.get<string>('JWT_SECRET') ||
          config.get<string>('SESSION_SECRET') ||
          'obsidian-dev-jwt-secret-replace-in-production-1234567890',
        signOptions: { expiresIn: '10m' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, AdminApiKeysController, AccountApiKeysController],
  providers: [AuthService, ApiKeysService, SessionGuard, AdminGuard, ApplicationApiGuard],
  exports: [AuthService, ApiKeysService, JwtModule, SessionGuard, AdminGuard, ApplicationApiGuard],
})
export class AuthModule {}
