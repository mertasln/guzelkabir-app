import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { Order, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  extractExifData,
  resolveGeotagStatus,
  type GeotagStatusResult,
} from './evidence-geo.util';
import { CreateOrderDto } from './dto/create-order.dto';
import { AssignOrderDto } from './dto/assign-order.dto';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import {
  CursorPage,
  DEFAULT_PAGE_SIZE,
} from '../common/pagination/cursor-pagination.type';
import { AccessTokenPayload } from '../auth/types/jwt-payload.type';
import { AuditLogService } from '../common/audit-log/audit-log.service';

const APPROVAL_WINDOW_HOURS = 48;
// spec §8.2: "Minimum 2 fotoğraf: 1 geniş açı (mezar ve çevresi), 1 detay çekimi"
const MIN_EVIDENCE_PHOTOS = 2;
// spec §8.1: "varsayılan tolerans: 150 metre" — cemeteries.geotag_tolerance_m
// NULL olduğunda buraya (env, sonra sabit) düşülür.
const FALLBACK_GEOTAG_TOLERANCE_M = 150;
function getDefaultGeotagToleranceM(): number {
  const fromEnv = Number(process.env.GEOTAG_DEFAULT_TOLERANCE_M);
  return Number.isFinite(fromEnv) && fromEnv > 0
    ? fromEnv
    : FALLBACK_GEOTAG_TOLERANCE_M;
}

// ADIM 8 (saha PWA, spec §12.1 madde 27): Görev Detayı ekranı adres/mezarlık
// bilgisini gösterebilmek için grave_location+cemetery join'i gerektiriyor.
type OrderWithLocation = Prisma.OrderGetPayload<{
  include: { graveLocation: { include: { cemetery: true } } };
}>;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly auditLog: AuditLogService,
  ) {}

  // spec §11.1 "Sipariş Yönetimi: sipariş detay sayfası (zaman
  // çizelgesi/audit trail görünümü)" — Admin Panel, ADIM 9. Sipariş durum
  // geçişlerinin hepsi (bu dosyada ve SlaService'te) artık audit_log'a
  // yazıyor, bu ekran gerçek veriye sahip olsun diye.
  async findAuditTrail(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Sipariş bulunamadı.');
    }
    return this.prisma.auditLog.findMany({
      where: { entityType: 'order', entityId: orderId },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  async create(customerId: string, dto: CreateOrderDto): Promise<Order> {
    const graveLocation = await this.prisma.graveLocation.findUnique({
      where: { id: dto.graveLocationId },
    });
    if (!graveLocation) {
      throw new BadRequestException('Belirtilen mezar konumu bulunamadı.');
    }

    return this.prisma.order.create({
      data: {
        orderNumber: await this.generateOrderNumber(),
        customerId,
        graveLocationId: dto.graveLocationId,
        serviceType: dto.serviceType,
        status: 'draft',
        preferredDate: dto.preferredDate
          ? new Date(dto.preferredDate)
          : undefined,
        specialNotes: dto.specialNotes,
        priceAmount: dto.priceAmount,
        currency: dto.currency,
        subscriptionId: dto.subscriptionId,
      },
    });
  }

  async findOneForUser(
    orderId: string,
    user: AccessTokenPayload,
  ): Promise<OrderWithLocation> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { graveLocation: { include: { cemetery: true } } },
    });
    if (!order) {
      throw new NotFoundException('Sipariş bulunamadı.');
    }
    // spec §5: GET /orders/:id rolü "Owner/Ops/Admin". ADIM 8 (saha PWA)
    // eklentisi: field_partner de "Owner" kavramının doğal bir uzantısı olarak
    // — kendisine atanmış siparişin "Görev Detayı" ekranını (spec §12.1 madde
    // 27) görebilmesi gerekiyor, GET /partners/:id/tasks'ın liste görünümü
    // yeterli değil (adres/mezar detayı, tam sipariş alanları gerekiyor).
    if (user.role === 'customer') {
      if (order.customerId !== user.sub) {
        throw new ForbiddenException('Bu siparişe erişim yetkiniz yok.');
      }
      return order;
    }
    if (user.role === 'ops_manager' || user.role === 'admin') {
      return order;
    }
    if (user.role === 'field_partner') {
      const partner = await this.prisma.fieldPartner.findUnique({
        where: { userId: user.sub },
      });
      if (!partner || order.assignedPartnerId !== partner.id) {
        throw new ForbiddenException('Bu siparişe erişim yetkiniz yok.');
      }
      return order;
    }
    throw new ForbiddenException('Bu siparişe erişim yetkiniz yok.');
  }

  // spec §5 rol tablosu GET /orders için yalnızca "Ops/Admin" diyor. Burada
  // bilinçli bir yorum genişletmesi yapıldı: Customer de bu uca erişebilir,
  // ama sonuçlar HER ZAMAN kendi customerId'siyle sınırlanır (customerId
  // filtresini değiştiremez) — aksi halde apps/web panelinin "siparişlerim"
  // listesini besleyecek hiçbir endpoint olmuyor. Bu bir spec boşluğu/yorumu;
  // kullanıcıya ADIM 4 özetinde açıkça bildirildi.
  async findMany(
    user: AccessTokenPayload,
    query: ListOrdersQueryDto,
  ): Promise<CursorPage<Order>> {
    if (
      user.role !== 'customer' &&
      user.role !== 'ops_manager' &&
      user.role !== 'admin'
    ) {
      throw new ForbiddenException('Bu listeye erişim yetkiniz yok.');
    }

    const where: Prisma.OrderWhereInput = {};
    if (user.role === 'customer') {
      where.customerId = user.sub;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.date) {
      const day = new Date(query.date);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      where.preferredDate = { gte: day, lt: nextDay };
    }
    if (query.city) {
      where.graveLocation = {
        cemetery: { city: { equals: query.city, mode: 'insensitive' } },
      };
    }
    if (query.partnerId) {
      where.assignedPartnerId = query.partnerId;
    }

    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const items = await this.prisma.order.findMany({
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

  // spec §6.2/§17: field partner KYC tamamlanmadan (kimlik+sabıka+sözleşme)
  // görev ataması engellenir — status='active' zorunlu kontrolü. Kullanıcı
  // talebi gereği DB trigger DEĞİL, servis katmanında açık kontrol.
  async assign(
    orderId: string,
    dto: AssignOrderDto,
    actor: AccessTokenPayload,
  ): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Sipariş bulunamadı.');
    }
    if (order.status !== 'confirmed') {
      throw new BadRequestException(
        `Sipariş 'confirmed' durumunda değilken atama yapılamaz (mevcut durum: ${order.status}).`,
      );
    }

    const partner = await this.prisma.fieldPartner.findUnique({
      where: { id: dto.fieldPartnerId },
    });
    if (!partner) {
      throw new NotFoundException('Saha partneri bulunamadı.');
    }
    if (partner.status !== 'active') {
      throw new ForbiddenException(
        `Bu saha partneri aktif değil (durum: ${partner.status}) — kimlik doğrulama, sabıka kaydı ve sözleşme imzası tamamlanmadan görev ataması yapılamaz.`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        assignedPartnerId: partner.id,
        assignedAt: new Date(),
        status: 'assigned',
      },
    });
    await this.auditLog.record({
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'order.assign',
      entityType: 'order',
      entityId: orderId,
      oldValue: { status: order.status, assignedPartnerId: null },
      newValue: { status: updated.status, assignedPartnerId: partner.id },
    });
    return updated;
  }

  // spec §2.3 madde 5 / §12.1 madde 27: saha partneri görevi "Başladı" olarak
  // işaretler (assigned → in_progress). Spec §5'in endpoint tablosunda bu geçiş
  // için ayrı bir uç YOK — ama §21.2'nin durum makinesi bu ara durumu açıkça
  // içeriyor ve ADIM 5'in görevi "durum makinesini birebir uygulamak" olduğu
  // için icat edilmedi, tespit edilen bir spec boşluğu olarak dolduruldu.
  async start(orderId: string, user: AccessTokenPayload): Promise<Order> {
    const order = await this.getOrderForAssignedPartner(orderId, user);
    if (order.status !== 'assigned') {
      throw new BadRequestException(
        `Sipariş 'assigned' durumunda değilken başlatılamaz (mevcut durum: ${order.status}).`,
      );
    }
    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: { status: 'in_progress' },
    });
    await this.auditLog.record({
      actorId: user.sub,
      actorRole: user.role,
      action: 'order.start',
      entityType: 'order',
      entityId: order.id,
      oldValue: { status: order.status },
      newValue: { status: updated.status },
    });
    return updated;
  }

  // spec §8.1 madde 14: istemci fotoğrafı doğrudan S3 pre-signed URL'e yükler,
  // backend hiç proxy etmez. Bu uç yalnızca kısa ömürlü yükleme URL'ini üretir.
  //
  // contentSha256 dto'dan gelir (bkz. CreateEvidenceUploadUrlDto ve
  // StorageService.createPresignedUploadUrl yorumu) — Object Lock'lu bucket'a
  // karşı canlı testte bulunan gereklilik, istemcinin dosyayı ÖNCEDEN
  // hashleyip buraya iletmesini zorunlu kılıyor.
  async createEvidenceUploadUrl(
    orderId: string,
    user: AccessTokenPayload,
    contentSha256: string,
  ): Promise<{ fileKey: string; uploadUrl: string }> {
    const order = await this.getOrderForAssignedPartner(orderId, user);
    if (order.status !== 'in_progress') {
      throw new BadRequestException(
        `Sipariş 'in_progress' durumunda değilken kanıt yükleme URL'i alınamaz (mevcut durum: ${order.status}). Önce POST /orders/:id/start çağrılmalı.`,
      );
    }
    const fileKey = `evidence/${order.id}/${randomUUID()}.jpg`;
    const uploadUrl = await this.storage.createPresignedUploadUrl(
      fileKey,
      'image/jpeg',
      contentSha256,
    );
    return { fileKey, uploadUrl };
  }

  // spec §8.1 madde 15-18: backend S3'ten yüklenen dosyayı indirir, EXIF'i
  // (GPS + timestamp) kendisi çıkarır — istemcinin gönderdiği "EXIF"
  // değerlerine güvenmek doğrulamanın tüm amacını geçersiz kılardı (bkz.
  // CreateEvidenceDto yorumu). Haversine mesafesi mezarlığın toleransıyla
  // karşılaştırılır, geotag_validation_status gerçek sonuca göre yazılır.
  async addEvidence(
    orderId: string,
    user: AccessTokenPayload,
    dto: CreateEvidenceDto,
  ) {
    const order = await this.getOrderForAssignedPartner(orderId, user);
    // spec §2.3 madde 5: kanıt yükleme, görev "Başladı" olarak işaretlendikten
    // (in_progress) sonra yapılır.
    if (order.status !== 'in_progress') {
      throw new BadRequestException(
        `Sipariş 'in_progress' durumunda değilken kanıt yüklenemez (mevcut durum: ${order.status}). Önce POST /orders/:id/start çağrılmalı.`,
      );
    }

    const graveLocation = await this.prisma.graveLocation.findUniqueOrThrow({
      where: { id: order.graveLocationId },
      include: { cemetery: true },
    });

    const fileBuffer = await this.storage.getObjectBuffer(dto.fileKey);
    const exif = await extractExifData(fileBuffer);
    const serverReceivedAt = new Date();

    const toleranceMeters =
      graveLocation.cemetery.geotagToleranceM ?? getDefaultGeotagToleranceM();
    const geo = resolveGeotagStatus({
      exif,
      referenceLat: graveLocation.lat ? Number(graveLocation.lat) : null,
      referenceLng: graveLocation.lng ? Number(graveLocation.lng) : null,
      toleranceMeters,
      serverReceivedAt,
    });

    // spec §8.2: "CDN üzerinden sıkıştırılmış türetilmiş versiyon sunulur" —
    // orijinal (WORM kilitli) dosyaya dokunulmuyor, ayrı bir key'e yazılıyor.
    // Doğrulama sonucundan bağımsız her zaman üretilir (spec bunu şarta bağlamıyor).
    const derivativeKey = dto.fileKey.replace(/\.[^/.]+$/, '-derived.jpg');
    const derivativeBuffer = await sharp(fileBuffer)
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toBuffer();
    await this.storage.putObject(derivativeKey, derivativeBuffer, 'image/jpeg');

    const evidencePhoto = await this.prisma.evidencePhoto.create({
      data: {
        orderId: order.id,
        uploadedBy: user.sub,
        photoType: dto.photoType,
        fileUrl: this.storage.getPublicUrl(dto.fileKey),
        exifGpsLat: exif.lat,
        exifGpsLng: exif.lng,
        exifTimestamp: exif.timestamp,
        serverReceivedAt,
        geotagValidationStatus: geo.status,
        distanceFromGraveM: geo.distanceFromGraveM ?? undefined,
        fieldNote: dto.fieldNote,
      },
    });

    // spec §8.1 madde 17: EXIF eksik veya tolerans aşımında Ops'a bildirim
    // gider. Tutarlılık için timestamp_mismatch ve (ADIM 5'in "yardım isteyin"
    // akışından kalma) referans-konum-yok durumunu da dahil ediyoruz — spec
    // yalnızca ilk ikisini açıkça söylüyor, bu küçük bir genişletme (bkz.
    // CLAUDE.md "Evidence verification").
    if (geo.status !== 'valid') {
      await this.notifyOpsForManualReview(order, evidencePhoto.id, geo);
    }

    return evidencePhoto;
  }

  private async notifyOpsForManualReview(
    order: Order,
    evidencePhotoId: string,
    geo: GeotagStatusResult,
  ): Promise<void> {
    const opsUsers = await this.prisma.user.findMany({
      where: { role: 'ops_manager' },
    });
    await Promise.all(
      opsUsers.map((ops) =>
        this.prisma.notification.create({
          data: {
            userId: ops.id,
            channel: 'push',
            templateKey: 'evidence_manual_review',
            payload: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              evidencePhotoId,
              status: geo.status,
              reason: geo.reason,
            },
            status: 'queued',
          },
        }),
      ),
    );
  }

  async complete(orderId: string, user: AccessTokenPayload): Promise<Order> {
    const order = await this.getOrderForAssignedPartner(orderId, user);
    if (order.status !== 'in_progress') {
      throw new BadRequestException(
        `Sipariş 'in_progress' durumunda değilken tamamlanamaz (mevcut durum: ${order.status}).`,
      );
    }

    const photos = await this.prisma.evidencePhoto.findMany({
      where: { orderId: order.id },
      select: { photoType: true },
    });
    // spec §8.2: "Minimum 2 fotoğraf: 1 geniş açı (mezar ve çevresi), 1 detay
    // çekimi" — yalnızca SAYI değil, TÜR kombinasyonu da zorunlu (ADIM 7'de
    // düzeltilen bir boşluk: önceden yalnızca sayı kontrol ediliyordu).
    const hasWideShot = photos.some((p) => p.photoType === 'wide_shot');
    const hasDetailShot = photos.some((p) => p.photoType === 'detail_shot');
    if (photos.length < MIN_EVIDENCE_PHOTOS || !hasWideShot || !hasDetailShot) {
      // spec §17: "eksikse 'complete' endpoint 422 döner"
      throw new UnprocessableEntityException(
        `Görev tamamlanamaz: en az 1 geniş açı (wide_shot) ve 1 detay çekimi (detail_shot) kanıt fotoğrafı gerekli (mevcut: ${photos.length} fotoğraf).`,
      );
    }

    const completedAt = new Date();
    const approvalDeadline = new Date(
      completedAt.getTime() + APPROVAL_WINDOW_HOURS * 60 * 60 * 1000,
    );
    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'completed_pending_approval',
        completedAt,
        approvalDeadline,
      },
    });
    await this.auditLog.record({
      actorId: user.sub,
      actorRole: user.role,
      action: 'order.complete',
      entityType: 'order',
      entityId: order.id,
      oldValue: { status: order.status },
      newValue: { status: updated.status, approvalDeadline },
    });
    return updated;
  }

  async approve(orderId: string, user: AccessTokenPayload): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Sipariş bulunamadı.');
    }
    if (order.customerId !== user.sub) {
      throw new ForbiddenException(
        'Bu siparişi yalnızca sahibi onaylayabilir.',
      );
    }
    if (order.status !== 'completed_pending_approval') {
      throw new BadRequestException(
        `Sipariş onay bekleyen durumda değil (mevcut durum: ${order.status}).`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: { status: 'closed' },
      });
      if (order.assignedPartnerId) {
        // Saha partnerine gerçek fon transferi (iyzico refund-to-balance veya
        // banka transferi — henüz kararlaştırılmadı, Admin Panel'in işi,
        // ADIM 8) burada yapılmıyor; yalnızca "önce onay, sonra ödeme" iş
        // kuralına uygun hakediş kaydı açılır.
        await tx.partnerPayout.create({
          data: {
            fieldPartnerId: order.assignedPartnerId,
            orderId: order.id,
            amount: order.priceAmount,
            status: 'pending',
          },
        });
      }
      return updatedOrder;
    });
    await this.auditLog.record({
      actorId: user.sub,
      actorRole: user.role,
      action: 'order.approve',
      entityType: 'order',
      entityId: order.id,
      oldValue: { status: order.status },
      newValue: { status: updated.status },
    });
    return updated;
  }

  async addComplaint(
    orderId: string,
    user: AccessTokenPayload,
    dto: CreateComplaintDto,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Sipariş bulunamadı.');
    }
    if (order.customerId !== user.sub) {
      throw new ForbiddenException(
        'Bu sipariş için yalnızca sahibi şikayet açabilir.',
      );
    }

    const slaDeadline = order.completedAt
      ? new Date(
          order.completedAt.getTime() + APPROVAL_WINDOW_HOURS * 60 * 60 * 1000,
        )
      : undefined;

    // spec §21.2: "completed_pending_approval → disputed → refunded | reservice
    // → closed." Yalnızca bu kenar spec'te açıkça tanımlı; başka durumdaki bir
    // siparişe şikayet açılabilir (kayıt oluşur) ama order.status değişmez.
    const [complaint] = await this.prisma.$transaction([
      this.prisma.complaint.create({
        data: {
          orderId: order.id,
          raisedBy: user.sub,
          category: dto.category,
          description: dto.description,
          slaDeadline,
        },
      }),
      ...(order.status === 'completed_pending_approval'
        ? [
            this.prisma.order.update({
              where: { id: order.id },
              data: { status: 'disputed' },
            }),
          ]
        : []),
    ]);
    if (order.status === 'completed_pending_approval') {
      await this.auditLog.record({
        actorId: user.sub,
        actorRole: user.role,
        action: 'order.dispute',
        entityType: 'order',
        entityId: order.id,
        oldValue: { status: order.status },
        newValue: { status: 'disputed', complaintId: complaint.id },
      });
    }
    return complaint;
  }

  private async getOrderForAssignedPartner(
    orderId: string,
    user: AccessTokenPayload,
  ): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Sipariş bulunamadı.');
    }
    const partner = await this.prisma.fieldPartner.findUnique({
      where: { userId: user.sub },
    });
    if (!partner || order.assignedPartnerId !== partner.id) {
      throw new ForbiddenException('Bu sipariş size atanmamış.');
    }
    return order;
  }

  // Not: bu sıra üretimi atomik değil (eşzamanlı iki create çağrısı aynı sırayı
  // üretebilir) — spec §4.4 kesin bir algoritma vermiyor, MVP için kabul
  // edilebilir; production ölçeğinde bir DB sequence/advisory lock'a taşınmalı.
  private async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.order.count({
      where: { orderNumber: { startsWith: `#MB-${year}-` } },
    });
    const sequence = String(count + 1).padStart(5, '0');
    return `#MB-${year}-${sequence}`;
  }
}
