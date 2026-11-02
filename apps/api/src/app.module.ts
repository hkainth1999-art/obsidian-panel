import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { LocationsModule } from './modules/locations/locations.module';
import { NodesModule } from './modules/nodes/nodes.module';
import { AllocationsModule } from './modules/allocations/allocations.module';
import { NestsModule } from './modules/nests/nests.module';
import { EggsModule } from './modules/eggs/eggs.module';
import { ServersModule } from './modules/servers/servers.module';
import { WingsRemoteModule } from './modules/wings-remote/wings-remote.module';
import { HealthModule } from './modules/health/health.module';
import { MailModule } from './modules/mail/mail.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SecurityModule } from './modules/security/security.module';

@Module({
  imports: [
    MailModule,
    SecurityModule,
    SettingsModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 60,
      },
      {
        name: 'auth',
        ttl: 60000,
        limit: 5,
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    LocationsModule,
    NodesModule,
    AllocationsModule,
    NestsModule,
    EggsModule,
    ServersModule,
    WingsRemoteModule,
    HealthModule,
  ],
})
export class AppModule {}
