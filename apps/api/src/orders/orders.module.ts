import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [StorageModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
