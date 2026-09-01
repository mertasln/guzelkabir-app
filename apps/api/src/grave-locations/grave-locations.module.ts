import { Module } from '@nestjs/common';
import { GraveLocationsController } from './grave-locations.controller';
import { GraveLocationsService } from './grave-locations.service';

@Module({
  controllers: [GraveLocationsController],
  providers: [GraveLocationsService],
})
export class GraveLocationsModule {}
