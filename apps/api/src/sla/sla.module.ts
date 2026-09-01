import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SlaService } from './sla.service';
import { SlaProcessor } from './sla.processor';
import { SLA_QUEUE } from './sla.constants';

// BullMQ Worker'lar, altta kullandığı ioredis bağlantısında
// `maxRetriesPerRequest: null` bekler (aksi halde runtime'da hata verir) —
// bu yüzden src/redis/redis.module.ts'teki PAYLAŞILAN REDIS_CLIENT'ı (auth/
// idempotency'nin kullandığı, bu ayarı taşımayan) burada YENİDEN KULLANMIYORUZ.
// BullMQ kendi bağlantı seçeneklerini alıp kendi (ayrı) ioredis bağlantılarını
// kendi içinde yönetsin diye bağlantı seçenekleri (host/port), hazır bir client
// nesnesi değil, veriliyor.
//
// connectTimeout kısa + retryStrategy tek denemeden sonra vazgeçiyor: Redis
// erişilemezse (örn. testlerde — bkz. test/test-app.helper.ts, ioredis-mock
// yalnızca PAYLAŞILAN REDIS_CLIENT'ı kapsıyor, BullMQ'nun kendi bağlantısını
// değil) uygulama açılışı saniyelerce beklemeden/sonsuza kadar tekrar
// denemeden hızlıca vazgeçsin diye.
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

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({ connection: parseRedisConnection() }),
    }),
    BullModule.registerQueue({ name: SLA_QUEUE }),
  ],
  providers: [SlaService, SlaProcessor],
  exports: [SlaService],
})
export class SlaModule implements OnModuleInit {
  private readonly logger = new Logger(SlaModule.name);

  constructor(@InjectQueue(SLA_QUEUE) private readonly queue: Queue) {}

  async onModuleInit() {
    try {
      // spec §17: 30 dk atama SLA'sı için "cron job her 5 dk kontrol" açıkça belirtiliyor.
      await this.queue.upsertJobScheduler(
        'escalate-overdue-assignments',
        { pattern: '*/5 * * * *' },
        { name: 'escalate-overdue-assignments' },
      );
      // spec §7.1/§2.3: 24s ödeme iptali ve 48s onay penceresi için kontrol
      // sıklığı belirtilmiyor — 15 dk makul bir varsayım.
      await this.queue.upsertJobScheduler(
        'cancel-unpaid-orders',
        { pattern: '*/15 * * * *' },
        { name: 'cancel-unpaid-orders' },
      );
      await this.queue.upsertJobScheduler(
        'auto-close-approved-orders',
        { pattern: '*/15 * * * *' },
        { name: 'auto-close-approved-orders' },
      );
    } catch (err) {
      // Redis erişilemezse uygulamanın tamamı açılamamamalı — SLA otomasyonu
      // olmadan da API'nin geri kalanı (auth, orders, vb.) çalışabilmeli.
      this.logger.warn(
        `SLA job scheduler kurulamadı (Redis erişilebilir mi?): ${String(err)}`,
      );
    }
  }
}
