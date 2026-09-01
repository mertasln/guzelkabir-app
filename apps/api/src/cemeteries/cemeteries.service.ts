import { Injectable, NotFoundException } from '@nestjs/common';
import { Cemetery, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/audit-log/audit-log.service';
import { AccessTokenPayload } from '../auth/types/jwt-payload.type';
import { SearchCemeteriesQueryDto } from './dto/search-cemeteries-query.dto';
import { ListCemeteriesQueryDto } from './dto/list-cemeteries-query.dto';
import { CreateCemeteryDto } from './dto/create-cemetery.dto';
import { UpdateCemeteryDto } from './dto/update-cemetery.dto';
import {
  CursorPage,
  DEFAULT_PAGE_SIZE,
} from '../common/pagination/cursor-pagination.type';

// Admin Panel Phase 8'de bulunan gerçek boşluk: search() `select` olmadan
// `findMany` çağırıyordu, yani PermitStatus/permitDocumentUrl DAHİL tüm
// alanları bu KİMLİKSİZ, PUBLIC uçtan dönüyordu. Phase 8'den önce zararsızdı
// (permitDocumentUrl her zaman null'du, hiçbir kod onu yazmıyordu) — artık
// gerçek belediye izin belgesi URL'leri yazılabildiğinden bu gerçek bir
// sızıntı olurdu. partners.service.ts'teki nationalIdEncrypted sızıntısıyla
// (Phase 4) aynı sınıf hata, aynı düzeltme: açık `select`.
const PUBLIC_SEARCH_SELECT = {
  id: true,
  name: true,
  city: true,
  district: true,
  lat: true,
  lng: true,
} satisfies Prisma.CemeterySelect;

type PublicCemetery = Prisma.CemeteryGetPayload<{
  select: typeof PUBLIC_SEARCH_SELECT;
}>;

@Injectable()
export class CemeteriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // spec §5: "Mezarlık adı/şehir bazlı arama (autocomplete)" — PUBLIC.
  // Admin Panel Phase 8: izin durumu/belge URL'i gibi iç bilgiler kasıtlı
  // olarak BURAYA eklenmedi (bkz. findManyAdmin) — kimliksiz bir uçtan
  // belediye izin belgesi URL'i sızdırmak için bir sebep yok.
  async search(
    query: SearchCemeteriesQueryDto,
  ): Promise<CursorPage<PublicCemetery>> {
    const where: Prisma.CemeteryWhereInput = query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { city: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {};

    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const items = await this.prisma.cemetery.findMany({
      where,
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: PUBLIC_SEARCH_SELECT,
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  // spec §11.1 "Mezarlık & İzin Yönetimi" — admin-only tam liste, izin
  // durumuna göre filtrelenebilir. search()'ten ayrı, bkz. o metodun yorumu.
  async findManyAdmin(
    query: ListCemeteriesQueryDto,
  ): Promise<CursorPage<Cemetery>> {
    const where: Prisma.CemeteryWhereInput = {};
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { city: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.permitStatus) {
      where.permitStatus = query.permitStatus;
    }

    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const items = await this.prisma.cemetery.findMany({
      where,
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  // spec §11.1 "Mezarlık kayıtları" — spec §5'in tablosunda yok, önceden hiç
  // oluşturma ucu yoktu (yalnızca seed script'i doğrudan DB'ye yazıyordu).
  async create(
    dto: CreateCemeteryDto,
    actor: AccessTokenPayload,
  ): Promise<Cemetery> {
    const cemetery = await this.prisma.cemetery.create({
      data: {
        name: dto.name,
        city: dto.city,
        district: dto.district,
        municipalityAuthority: dto.municipalityAuthority,
        lat: dto.lat,
        lng: dto.lng,
        geotagToleranceM: dto.geotagToleranceM,
      },
    });
    await this.auditLog.record({
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'cemetery.create',
      entityType: 'cemetery',
      entityId: cemetery.id,
      newValue: { name: cemetery.name, city: cemetery.city },
    });
    return cemetery;
  }

  // spec §5'in tablosunda yok — ADIM 7 kararı (bkz. UpdateCemeteryDto
  // yorumu). Admin Panel Phase 8: permitStatus/permitDocumentUrl için
  // GENİŞLETİLDİ (kullanıcı talimatı — yeni bir endpoint açılmadı).
  // İzin durumu değişikliği spec §11.2'nin "statü değişikliği" audit_log
  // gereksiniminin literal bir örneği.
  async update(
    id: string,
    dto: UpdateCemeteryDto,
    actor: AccessTokenPayload,
  ): Promise<Cemetery> {
    const cemetery = await this.prisma.cemetery.findUnique({ where: { id } });
    if (!cemetery) {
      throw new NotFoundException('Mezarlık bulunamadı.');
    }
    const updated = await this.prisma.cemetery.update({
      where: { id },
      data: {
        geotagToleranceM: dto.geotagToleranceM ?? cemetery.geotagToleranceM,
        permitStatus: dto.permitStatus ?? cemetery.permitStatus,
        permitDocumentUrl: dto.permitDocumentUrl ?? cemetery.permitDocumentUrl,
        name: dto.name ?? cemetery.name,
        city: dto.city ?? cemetery.city,
        district: dto.district ?? cemetery.district,
        municipalityAuthority:
          dto.municipalityAuthority ?? cemetery.municipalityAuthority,
      },
    });

    if (dto.permitStatus && dto.permitStatus !== cemetery.permitStatus) {
      await this.auditLog.record({
        actorId: actor.sub,
        actorRole: actor.role,
        action: 'cemetery.permit_status_change',
        entityType: 'cemetery',
        entityId: id,
        oldValue: { permitStatus: cemetery.permitStatus },
        newValue: { permitStatus: updated.permitStatus },
      });
    }
    return updated;
  }
}
