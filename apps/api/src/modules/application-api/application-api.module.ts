import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ServersModule } from '../servers/servers.module';
import { LocationsModule } from '../locations/locations.module';
import { ApplicationUsersController } from './application-users.controller';
import { ApplicationServersController } from './application-servers.controller';
import { ApplicationLocationsController } from './application-locations.controller';
import { ApplicationNestsController } from './application-nests.controller';

@Module({
  imports: [AuthModule, ServersModule, LocationsModule],
  controllers: [
    ApplicationUsersController,
    ApplicationServersController,
    ApplicationLocationsController,
    ApplicationNestsController,
  ],
})
export class ApplicationApiModule {}

