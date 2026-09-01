import { Module } from '@nestjs/common';
import { CemeteriesController } from './cemeteries.controller';
import { CemeteriesService } from './cemeteries.service';

@Module({
  controllers: [CemeteriesController],
  providers: [CemeteriesService],
})
export class CemeteriesModule {}
