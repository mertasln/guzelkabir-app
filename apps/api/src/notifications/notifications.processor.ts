import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from './channels/sms.service';
import { EmailService } from './channels/email.service';
import { NOTIFICATION_TEMPLATES, NotificationPayload } from './templates';
import { NOTIFICATIONS_QUEUE } from './notifications.constants';

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly email: EmailService,
  ) {
    super();
  }

  async process(job: Job<{ notificationId: string }>): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: job.data.notificationId },
      select: {
        id: true,
        channel: true,
        templateKey: true,
        payload: true,
        status: true,
        user: { select: { email: true, phone: true } },
      },
    });
    if (!notification || notification.status === 'sent') {
      return;
    }

    const template = NOTIFICATION_TEMPLATES[notification.templateKey];
    const payload = (notification.payload ?? {}) as NotificationPayload;

    try {
      if (notification.channel === 'sms') {
        if (!template?.sms) {
          throw new Error(
            `'${notification.templateKey}' için SMS şablonu tanımlı değil.`,
          );
        }
        if (!notification.user.phone) {
          throw new Error('Alıcı kullanıcının kayıtlı telefon numarası yok.');
        }
        await this.sms.send(notification.user.phone, template.sms(payload));
      } else if (notification.channel === 'email') {
        if (!template?.email) {
          throw new Error(
            `'${notification.templateKey}' için e-posta şablonu tanımlı değil.`,
          );
        }
        const { subject, text } = template.email(payload);
        await this.email.send(notification.user.email, subject, text);
      } else {
        // whatsapp/push: NotificationsService bu kanallar için hiç job
        // eklemiyor — buraya düşülmesi beklenmiyor, düşerse sessizce
        // atlanmak yerine loglanır.
        this.logger.warn(
          `Beklenmeyen kanal için dispatch job'ı: ${notification.channel} (notification: ${notification.id})`,
        );
        return;
      }

      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'sent', sentAt: new Date() },
      });
    } catch (err) {
      // Yalnızca SON denemede 'failed' olarak işaretle — ara denemelerde
      // BullMQ'nun backoff/retry'ı devam etsin, satır 'queued' kalsın (bkz.
      // NotificationsService'in attempts/backoff ayarı).
      const attempts = job.opts.attempts ?? 1;
      const isLastAttempt = job.attemptsMade + 1 >= attempts;
      if (isLastAttempt) {
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: { status: 'failed' },
        });
      }
      this.logger.warn(
        `Bildirim gönderimi başarısız (deneme ${job.attemptsMade + 1}/${attempts}, id: ${notification.id}, kanal: ${notification.channel}): ${String(err)}`,
      );
      throw err;
    }
  }
}
