import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OnboardingDto } from './dto/onboarding.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { ListPartnersQueryDto } from './dto/list-partners-query.dto';
import { RejectPartnerDto } from './dto/reject-partner.dto';
import { encryptNationalId } from '../common/crypto/national-id.crypto';
import { AccessTokenPayload } from '../auth/types/jwt-payload.type';
import {
  CursorPage,
  DEFAULT_PAGE_SIZE,
} from '../common/pagination/cursor-pagination.type';
import { AuditLogService } from '../common/audit-log/audit-log.service';
import { Prisma } from '@prisma/client';

// ADIM 8 (saha PWA, spec §12.1 madde 26): görev listesi kartlarının "adres,
// mezar konumu" göstermesi gerekiyor — ham Order satırında yalnızca
// grave_location_id (bir UUID) var, cemetery/grave_location join'i yoktu.
export type TaskListItem = Prisma.OrderGetPayload<{
  include: { graveLocation: { include: { cemetery: true } } };
}>;

// spec §11.1 "Partner Yönetimi" listesi ve kartları için — sipariş
// ataması/görev ekranlarındaki TaskListItem'ın aksine burada partnerin kendi
// User kaydı (fullName/email, ekranda göstermek için) join'lenir.
export type PartnerListItem = Prisma.FieldPartnerGetPayload<{
  include: { user: { select: { fullName: true; email: true; phone: true } } };
}>;

@Injectable()
export class PartnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // spec §11.1 "Partner Yönetimi" — spec §5'in tablosunda yok, Admin Panel
  // (ADIM 9) kararı: GET /orders'ın status filtresiyle aynı desen.
  async findMany(
    query: ListPartnersQueryDto,
  ): Promise<CursorPage<PartnerListItem>> {
    const where: Prisma.FieldPartnerWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const items = await this.prisma.fieldPartner.findMany({
      where,
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        user: { select: { fullName: true, email: true, phone: true } },
      },
    });
    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  // spec §11.1: "ödeme hak ediş (payout) listesi" — partner_payouts tablosu
  // ADIM 6/7'den beri yazılıyordu (SlaService.autoCloseApprovedOrders), ama
  // hiçbir okuma ucu yoktu.
  async findPayouts(partnerId: string) {
    const partner = await this.prisma.fieldPartner.findUnique({
      where: { id: partnerId },
    });
    if (!partner) {
      throw new NotFoundException('Saha partneri bulunamadı.');
    }
    return this.prisma.partnerPayout.findMany({
      where: { fieldPartnerId: partnerId },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  // spec §11.1 "Onboarding onay akışı" + §6.1 "Ops Manager: ... partner
  // onboarding onayı". Yalnızca 'onboarding'den geçiş — zaten aktif/reddedilmiş
  // bir partneri tekrar onaylamak anlamsız, açık bir hata olarak reddedilir.
  async approve(partnerId: string, actor: AccessTokenPayload) {
    const partner = await this.prisma.fieldPartner.findUnique({
      where: { id: partnerId },
    });
    if (!partner) {
      throw new NotFoundException('Saha partneri bulunamadı.');
    }
    if (partner.status !== 'onboarding') {
      throw new BadRequestException(
        `Yalnızca 'onboarding' durumundaki bir partner onaylanabilir (mevcut durum: '${partner.status}').`,
      );
    }
    const updated = await this.prisma.fieldPartner.update({
      where: { id: partnerId },
      data: { status: 'active' },
    });
    await this.auditLog.record({
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'partner.approve',
      entityType: 'field_partner',
      entityId: partnerId,
      oldValue: { status: partner.status },
      newValue: { status: updated.status },
    });
    return updated;
  }

  async reject(
    partnerId: string,
    actor: AccessTokenPayload,
    dto: RejectPartnerDto,
  ) {
    const partner = await this.prisma.fieldPartner.findUnique({
      where: { id: partnerId },
    });
    if (!partner) {
      throw new NotFoundException('Saha partneri bulunamadı.');
    }
    if (partner.status !== 'onboarding') {
      throw new BadRequestException(
        `Yalnızca 'onboarding' durumundaki bir partner reddedilebilir (mevcut durum: '${partner.status}').`,
      );
    }
    const updated = await this.prisma.fieldPartner.update({
      where: { id: partnerId },
      data: { status: 'rejected' },
    });
    await this.auditLog.record({
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'partner.reject',
      entityType: 'field_partner',
      entityId: partnerId,
      oldValue: { status: partner.status },
      newValue: { status: updated.status, reason: dto.reason },
    });
    return updated;
  }

  async findTasks(
    partnerId: string,
    user: AccessTokenPayload,
    query: ListTasksQueryDto,
  ): Promise<CursorPage<TaskListItem>> {
    const partner = await this.prisma.fieldPartner.findUnique({
      where: { id: partnerId },
    });
    if (!partner) {
      throw new NotFoundException('Saha partneri bulunamadı.');
    }
    if (partner.userId !== user.sub) {
      throw new ForbiddenException(
        'Bu partnerin görevlerini görüntüleme yetkiniz yok.',
      );
    }

    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const items = await this.prisma.order.findMany({
      where: { assignedPartnerId: partnerId },
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ assignedAt: 'desc' }, { id: 'desc' }],
      include: { graveLocation: { include: { cemetery: true } } },
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  // Onboarding onayı (status: onboarding → active|rejected) artık yukarıdaki
  // approve()/reject() ile yapılıyor (Admin Panel, ADIM 9) — bu bilinen
  // engelleyici çözüldü, bkz. CLAUDE.md "API Layer" bölümü.
  async submitOnboarding(userId: string, dto: OnboardingDto) {
    return this.prisma.fieldPartner.upsert({
      where: { userId },
      update: {
        nationalIdEncrypted: encryptNationalId(dto.nationalId),
        criminalRecordCheck: dto.criminalRecordCheck ?? false,
        documentUrl: dto.documentUrl,
        insurancePolicyNo: dto.insurancePolicyNo,
        serviceCities: dto.serviceCities,
      },
      create: {
        userId,
        nationalIdEncrypted: encryptNationalId(dto.nationalId),
        criminalRecordCheck: dto.criminalRecordCheck ?? false,
        documentUrl: dto.documentUrl,
        insurancePolicyNo: dto.insurancePolicyNo,
        serviceCities: dto.serviceCities,
      },
    });
  }
}
