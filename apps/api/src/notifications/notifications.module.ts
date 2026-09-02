import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsService } from './notifications.service';
import { NotificationsProcessor } from './notifications.processor';
import { SmsService } from './channels/sms.service';
import { EmailService } from './channels/email.service';
import { NOTIFICATIONS_QUEUE } from './notifications.constants';

// SlaModule ile aynı gerekçe (bkz. sla.module.ts): BullMQ Worker'lar
// `maxRetriesPerRequest: null` bekler, PAYLAŞILAN REDIS_CLIENT'ta (auth/
// idempotency) bu ayar yok — bu yüzden ayrı bir ioredis bağlantısı kuruluyor.
//
// SlaModule zaten kendi (anahtarsız/varsayılan) BullModule.forRootAsync
// paylaşılan yapılandırmasını kaydetmiş durumda. `forRootAsync`'i burada
// TEKRAR anahtarsız çağırmak aynı global sağlayıcı token'ını (bkz.
// @nestjs/bullmq kaynağı, getSharedConfigToken(undefined)) iki modülden
// register etmek anlamına gelirdi — riskli/tanımsız bir çakışma. Bunun
// yerine ADLANDIRILMIŞ bir configKey ('notifications') kullanılıyor:
// forRootAsync'in kendi desteklediği çoklu-bağlantı mekanizması, SlaModule'e
// hiç dokunmadan.
function parseRedisConnection() {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    maxRetriesPerRequest: null,
    connectTimeout: 1000,
    retryStrategy: () => null,
  };
}

@Global()
@Module({
  imports: [
    BullModule.forRootAsync('notifications', {
      useFactory: () => ({ connection: parseRedisConnection() }),
    }),
    BullModule.registerQueue({
      configKey: 'notifications',
      name: NOTIFICATIONS_QUEUE,
    }),
  ],
  providers: [
    NotificationsService,
    NotificationsProcessor,
    SmsService,
    EmailService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
