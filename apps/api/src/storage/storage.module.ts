import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { s3ClientProvider } from './s3-client.provider';

@Module({
  providers: [StorageService, s3ClientProvider],
  exports: [StorageService],
})
export class StorageModule {}
