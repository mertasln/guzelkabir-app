import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/audit-log/audit-log.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ListComplaintsQueryDto } from './dto/list-complaints-query.dto';
import { ResolveComplaintDto } from './dto/resolve-complaint.dto';
import { AccessTokenPayload } from '../auth/types/jwt-payload.type';
import {
  CursorPage,
  DEFAULT_PAGE_SIZE,
} from '../common/pagination/cursor-pagination.type';

// spec §11.1 "Şikayet Yönetimi: Kanban board" — kart üstünde göstermek için
// sipariş numarası/tutarı ve şikayeti açanın adı join'leniyor.
const COMPLAINT_LIST_SELECT = {
  id: true,
  orderId: true,
  raisedBy: true,
  category: true,
  description: true,
  status: true,
  resolutionNotes: true,
  resolvedAt: true,
  slaDeadline: true,
  createdAt: true,
  updatedAt: true,
  order: { select: { orderNumber: true, priceAmount: true, currency: true } },
  raiser: { select: { fullName: true, email: true } },
} satisfies Prisma.ComplaintSelect;

export type ComplaintListItem = Prisma.ComplaintGetPayload<{
  select: typeof COMPLAINT_LIST_SELECT;
}>;

@Injectable()
export class ComplaintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
  ) {}

  async findMany(
    query: ListComplaintsQueryDto,
  ): Promise<CursorPage<ComplaintListItem>> {
    const where: Prisma.ComplaintWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const items = await this.prisma.complaint.findMany({
      where,
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: COMPLAINT_LIST_SELECT,
    });
    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  // spec §6.1: Ops Manager + Support Agent'ın "şikayet yönetimi" yetkisi.
  async investigate(complaintId: string, actor: AccessTokenPayload) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id: complaintId },
    });
    if (!complaint) {
      throw new NotFoundException('Şikayet bulunamadı.');
    }
    if (complaint.status !== 'open') {
      throw new BadRequestException(
        `Yalnızca 'open' durumundaki bir şikayet incelemeye alınabilir (mevcut durum: '${complaint.status}').`,
      );
    }
    const updated = await this.prisma.complaint.update({
      where: { id: complaintId },
      data: { status: 'investigating' },
      select: COMPLAINT_LIST_SELECT,
    });
    await this.auditLog.record({
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'complaint.investigate',
      entityType: 'complaint',
      entityId: complaintId,
      oldValue: { status: complaint.status },
      newValue: { status: 'investigating' },
    });
    return updated;
  }

  async resolve(
    complaintId: string,
    actor: AccessTokenPayload,
    dto: ResolveComplaintDto,
  ) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id: complaintId },
    });
    if (!complaint) {
      throw new NotFoundException('Şikayet bulunamadı.');
    }
    if (complaint.status !== 'investigating') {
      throw new BadRequestException(
        `Yalnızca 'investigating' durumundaki bir şikayet çözülebilir (mevcut durum: '${complaint.status}').`,
      );
    }

    const updated = await this.prisma.complaint.update({
      where: { id: complaintId },
      data: {
        status: dto.outcome,
        resolutionNotes: dto.resolutionNotes,
        resolvedAt: new Date(),
      },
      select: COMPLAINT_LIST_SELECT,
    });
    await this.auditLog.record({
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'complaint.resolve',
      entityType: 'complaint',
      entityId: complaintId,
      oldValue: { status: complaint.status },
      newValue: { status: dto.outcome, resolutionNotes: dto.resolutionNotes },
    });

    // spec §21.2: "disputed → refunded | reservice → closed".
    //
    // rejected: platform lehine çözülmüş — sipariş tartışmalı durumdan
    // çıkar, 'closed'a döner (zaten 'disputed' ise).
    //
    // resolved_reservice: spec'in bu kenarı BİLİNÇLİ olarak burada
    // UYGULANMADI — gerçek yeniden hizmet (saha partnerinin işi tekrar
    // yapması) ayrı, henüz inşa edilmemiş bir operasyonel akış; sahte bir
    // "tamamlandı" durumu yazmak, iş gerçekten yapılmadan siparişi
    // kapatmak anlamına gelirdi — tam olarak reddedilen sahte-OTP
    // mantığının aynısı. order 'disputed' kalır, gerçek bir çözüm
    // (Admin Panel'in sonraki bir ADIM'ı) inşa edilene kadar.
    //
    // resolved_refund: order durumu processRefund()'da değişir, BURADA
    // DEĞİL — gerçek iade henüz gerçekleşmedi.
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: complaint.orderId },
      select: { id: true, orderNumber: true, customerId: true, status: true },
    });
    const customer = await this.prisma.user.findUniqueOrThrow({
      where: { id: order.customerId },
      select: { fullName: true },
    });
    // spec §9 satır 6 "Şikayet açıldı/çözüldü" — çözüm yarısı. Açılış yarısı
    // OrdersService.addComplaint'te.
    await this.notifications.notify(
      order.customerId,
      'complaint_resolved',
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: customer.fullName,
      },
      ['email', 'sms'],
    );

    if (dto.outcome === 'rejected') {
      if (order.status === 'disputed') {
        await this.prisma.order.update({
          where: { id: order.id },
          data: { status: 'closed' },
        });
        await this.auditLog.record({
          actorId: actor.sub,
          actorRole: actor.role,
          action: 'order.dispute_rejected',
          entityType: 'order',
          entityId: order.id,
          oldValue: { status: 'disputed' },
          newValue: { status: 'closed' },
        });
      }
    }

    return updated;
  }

  // spec §11.1/§19: Support Agent'ın "sınırlı iade yetkisi" spec'te sayısal
  // olarak tanımlanmamış — kullanıcı kararı (ADIM 9 Phase 1): MVP1'de
  // gerçek para hareketi yalnızca ops_manager/admin onayıyla tetiklenir,
  // bu yüzden bu uç yalnızca o iki role açık (bkz. controller). resolve()
  // (yukarıda) her rolle 'resolved_refund' olarak İŞARETLEYEBİLİR ama
  // gerçek iyzico çağrısı yalnızca burada, ayrı bir onayla olur.
  async processRefund(complaintId: string, actor: AccessTokenPayload) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id: complaintId },
    });
    if (!complaint) {
      throw new NotFoundException('Şikayet bulunamadı.');
    }
    if (complaint.status !== 'resolved_refund') {
      throw new BadRequestException(
        `Yalnızca 'resolved_refund' olarak çözülmüş bir şikayet için iade gerçekleştirilebilir (mevcut durum: '${complaint.status}').`,
      );
    }

    await this.payments.refund(
      complaint.orderId,
      complaint.resolutionNotes ?? `Şikayet çözümü: iade (${complaint.id})`,
    );

    const order = await this.prisma.order.findUnique({
      where: { id: complaint.orderId },
    });
    if (order && order.status !== 'refunded') {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'refunded' },
      });
      await this.auditLog.record({
        actorId: actor.sub,
        actorRole: actor.role,
        action: 'order.refund',
        entityType: 'order',
        entityId: order.id,
        oldValue: { status: order.status },
        newValue: { status: 'refunded' },
      });
    }

    await this.auditLog.record({
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'complaint.process_refund',
      entityType: 'complaint',
      entityId: complaintId,
      newValue: { refunded: true },
    });

    return { success: true };
  }
}
