import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { iyzicoProvider } from './iyzico.provider';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, iyzicoProvider],
})
export class PaymentsModule {}
