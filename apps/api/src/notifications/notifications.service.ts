import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationChannel, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  NOTIFICATIONS_QUEUE,
  NOTIFICATION_JOB_ATTEMPTS,
} from './notifications.constants';

// spec §9: her tetikleyici olay için Notification şemasında zaten olduğu gibi
// "bir satır = bir kanal" (channel tekil alan, dizi değil) — çok kanallı bir
// tetikleyici (örn. "Görev tamamlandı" → e-posta+SMS) birden fazla satır
// yazarak modelleniyor, tek satıra kanal dizisi eklenerek değil.
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
  ) {}

  async notify(
    userId: string,
    templateKey: string,
    payload: Prisma.InputJsonValue,
    channels: NotificationChannel[],
  ): Promise<void> {
    for (const channel of channels) {
      const notification = await this.prisma.notification.create({
        data: { userId, channel, templateKey, payload, status: 'queued' },
      });

      // Yalnızca gerçek bir göndericisi olan kanallar (sms, email) için
      // dispatch job'ı eklenir. whatsapp/push satırı 'queued' olarak yazılır
      // ama hiçbir job eklenmez — gerçek gönderici yokken sahte bir
      // "gönderildi" davranışı üretmemek için (bkz. CLAUDE.md'nin sahte-OTP
      // kararıyla aynı disiplin). Bu satırlar dürüstçe 'queued' kalır, tıpkı
      // WhatsApp entegrasyonu gelene kadar spec §9'un "Saha atandı" satırı
      // gibi.
      if (channel === 'sms' || channel === 'email') {
        // SlaModule.onModuleInit ile aynı gerekçe: Redis erişilemezse (bu
        // sandbox'ta ve e2e testlerinde her zaman — ioredis-mock yalnızca
        // PAYLAŞILAN REDIS_CLIENT'ı kapsıyor, BullMQ'nun kendi bağlantısını
        // değil) asıl iş operasyonu (sipariş onayı/atama/tamamlama/şikayet)
        // bir bildirim gönderilemediği için BAŞARISIZ OLMAMALI. Satır
        // 'queued' olarak dürüstçe kalır; gerçek Redis'e geçildiğinde
        // otomatik bir yeniden-deneme mekanizması YOK — bu bilinen bir
        // boşluk (bkz. CLAUDE.md).
        try {
          await this.queue.add(
            'dispatch',
            { notificationId: notification.id },
            {
              attempts: NOTIFICATION_JOB_ATTEMPTS,
              backoff: { type: 'exponential', delay: 5000 },
            },
          );
        } catch (err) {
          this.logger.warn(
            `Bildirim dispatch job'ı kuyruğa eklenemedi (Redis erişilebilir mi?), satır 'queued' kaldı (id: ${notification.id}): ${String(err)}`,
          );
        }
      }
    }
  }
}
