import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OnboardingDto } from './dto/onboarding.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { encryptNationalId } from '../common/crypto/national-id.crypto';
import { AccessTokenPayload } from '../auth/types/jwt-payload.type';
import {
  CursorPage,
  DEFAULT_PAGE_SIZE,
} from '../common/pagination/cursor-pagination.type';
import { Prisma } from '@prisma/client';

// ADIM 8 (saha PWA, spec §12.1 madde 26): görev listesi kartlarının "adres,
// mezar konumu" göstermesi gerekiyor — ham Order satırında yalnızca
// grave_location_id (bir UUID) var, cemetery/grave_location join'i yoktu.
export type TaskListItem = Prisma.OrderGetPayload<{
  include: { graveLocation: { include: { cemetery: true } } };
}>;

@Injectable()
export class PartnersService {
  constructor(private readonly prisma: PrismaService) {}

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

  // Onboarding onayı (status: onboarding → active) için spec §5'in endpoint
  // tablosunda bir uç YOK (§11.1 Admin Panel'de "onboarding onay akışı" olarak
  // bahsediliyor ama API sözleşmesi verilmemiş) — bu bilinen bir spec boşluğu,
  // Admin Panel endpoint'leri kurulurken (ADIM 8) netleştirilmeli.
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
