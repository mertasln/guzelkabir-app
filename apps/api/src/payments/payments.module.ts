import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { iyzicoProvider } from './iyzico.provider';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, iyzicoProvider],
  // Admin Panel Phase 6 (Şikayet Yönetimi) — ComplaintsService,
  // PaymentsService.refund()'u çağırmak için import ediyor.
  exports: [PaymentsService],
})
export class PaymentsModule {}
