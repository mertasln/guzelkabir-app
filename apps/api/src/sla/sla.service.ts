import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/audit-log/audit-log.service';

// spec §11.1 "Sipariş Yönetimi: ... zaman çizelgesi/audit trail görünümü" —
// SLA otomasyonu bir insan aksiyonu değil, actorId=null/actorRole='system'
// ile işaretlenir. audit_log.actorId nullable, tam bunun için.
const SYSTEM_ACTOR_ROLE = 'system';

// spec §7.1 madde 12: "...24 saat sonra otomatik iptal"
const PAYMENT_TIMEOUT_HOURS = 24;
// spec §17: "30 dk içinde saha partnerine atama"
const ASSIGNMENT_SLA_MINUTES = 30;

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * spec §7.1 madde 12: "Ödeme reddi/başarısızlığında sipariş 'pending_payment'
   * durumunda kalır... 24 saat sonra otomatik iptal."
   *
   * NOT: spec bu 24 saatin hangi zaman damgasından sayılacağını açıkça
   * belirtmiyor — orders tablosunda ayrı bir "pending_payment_started_at"
   * alanı yok (spec §4.4). `updated_at` kullanıldı: pending_payment'a geçiş
   * anında (ve o satırı başka hiçbir işlem güncellemediği sürece) bu alan
   * pratikte doğru referans noktasını verir — ama bu bir varsayım, spec'in
   * verdiği kesin bir alan adı değil.
   */
  async cancelUnpaidOrders(): Promise<number> {
    const cutoff = new Date(
      Date.now() - PAYMENT_TIMEOUT_HOURS * 60 * 60 * 1000,
    );
    // Admin Panel'in zaman çizelgesi görünümü (spec §11.1) her siparişin kendi
    // audit_log kaydını istediği için tek bir updateMany yerine satır satır
    // güncelleniyor — spec bu sweep için bir performans hedefi vermiyor,
    // MVP1 hacminde (pilot ölçeği) bu fark yaratmaz.
    const overdue = await this.prisma.order.findMany({
      where: { status: 'pending_payment', updatedAt: { lt: cutoff } },
    });
    for (const order of overdue) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'cancelled' },
      });
      await this.auditLog.record({
        actorId: undefined,
        actorRole: SYSTEM_ACTOR_ROLE,
        action: 'order.auto_cancel',
        entityType: 'order',
        entityId: order.id,
        oldValue: { status: order.status },
        newValue: { status: 'cancelled' },
      });
    }
    if (overdue.length > 0) {
      this.logger.log(
        `${overdue.length} ödenmemiş sipariş 24 saat sonra otomatik iptal edildi.`,
      );
    }
    return overdue.length;
  }

  /**
   * spec §2.3 madde 7 / §17: "48 saat içinde şikayet gelmezse sipariş otomatik
   * 'Kapatıldı' statüsüne geçer ve saha partnerine ödeme hak edişi (payout)
   * kaydı oluşturulur." `approval_deadline` alanı zaten spec §4.4'te var,
   * doğrudan kullanılıyor — burada bir varsayım yok.
   */
  async autoCloseApprovedOrders(): Promise<number> {
    const overdue = await this.prisma.order.findMany({
      where: {
        status: 'completed_pending_approval',
        approvalDeadline: { lt: new Date() },
      },
    });

    for (const order of overdue) {
      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'closed' },
        });
        if (order.assignedPartnerId) {
          const existingPayout = await tx.partnerPayout.findFirst({
            where: { orderId: order.id },
          });
          if (!existingPayout) {
            await tx.partnerPayout.create({
              data: {
                fieldPartnerId: order.assignedPartnerId,
                orderId: order.id,
                amount: order.priceAmount,
                status: 'pending',
              },
            });
          }
        }
      });
      await this.auditLog.record({
        actorId: undefined,
        actorRole: SYSTEM_ACTOR_ROLE,
        action: 'order.auto_close',
        entityType: 'order',
        entityId: order.id,
        oldValue: { status: order.status },
        newValue: { status: 'closed' },
      });
    }

    if (overdue.length > 0) {
      this.logger.log(
        `${overdue.length} sipariş 48 saatlik onay penceresi dolduğu için otomatik kapatıldı.`,
      );
    }
    return overdue.length;
  }

  /**
   * spec §17: "30 dk içinde saha partnerine atama... assigned_at alanı + cron
   * job her 5 dk kontrol, aşımda Ops'a eskalasyon bildirimi."
   *
   * NOT: burada ölçülmesi gereken şey "confirmed olduktan sonra HENÜZ atama
   * yapılmamış" siparişlerin bekleme süresi — ama bu siparişlerde assigned_at
   * zaten NULL (atama hiç yapılmadı), spec'in adlandırdığı alan bu amaca
   * doğrudan uymuyor. `updated_at` (confirmed'e geçiş anı için) kullanıldı,
   * yukarıdaki `cancelUnpaidOrders` ile aynı varsayımla.
   *
   * Gerçek SMS/e-posta/WhatsApp gönderimi (spec §9) ADIM 8'in kapsamı — burada
   * yalnızca tespit + Notification kaydı (status='queued') oluşturuluyor.
   */
  async escalateOverdueAssignments(): Promise<number> {
    const cutoff = new Date(Date.now() - ASSIGNMENT_SLA_MINUTES * 60 * 1000);
    const overdue = await this.prisma.order.findMany({
      where: {
        status: 'confirmed',
        assignedPartnerId: null,
        updatedAt: { lt: cutoff },
      },
    });
    if (overdue.length === 0) {
      return 0;
    }

    const opsUsers = await this.prisma.user.findMany({
      where: { role: 'ops_manager' },
    });

    for (const order of overdue) {
      for (const ops of opsUsers) {
        const alreadyNotified = await this.prisma.notification.findFirst({
          where: {
            userId: ops.id,
            templateKey: 'assignment_sla_escalation',
            payload: { path: ['orderId'], equals: order.id },
          },
        });
        if (!alreadyNotified) {
          await this.prisma.notification.create({
            data: {
              userId: ops.id,
              channel: 'push',
              templateKey: 'assignment_sla_escalation',
              payload: { orderId: order.id, orderNumber: order.orderNumber },
              status: 'queued',
            },
          });
        }
      }
    }

    this.logger.log(
      `${overdue.length} sipariş 30 dk atama SLA'sını aştı, Ops'a eskalasyon bildirimi kuyruğa alındı.`,
    );
    return overdue.length;
  }
}
