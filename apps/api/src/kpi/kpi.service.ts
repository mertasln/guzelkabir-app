import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Admin Panel ADIM 9 Phase 9 (KPI Dashboard) — spec §11.1'in "dönüşüm hunisi"
// gereksinimi. GERÇEK bir üst-huni (site ziyaretçisi → sipariş başlattı) bu
// projede hiçbir yerde YOK — apps/web'de pageview/session takibi yapan
// hiçbir analytics entegrasyonu yok, icat edilmedi. Bunun yerine mevcut
// Order.status verisinden dürüstçe hesaplanabilen bir SİPARİŞ YAŞAM
// DÖNGÜSÜ hunisi: her aşamaya "ulaşmış" (o aşamada veya sonrasında olan)
// sipariş sayısı, kümülatif. Bir siparişin GÜNCEL durumu, pipeline'da ne
// kadar ilerlediğini kesin olarak gösterir (durumlar geriye gitmez —
// 'disputed'/'refunded' bile 'completed_pending_approval'dan SONRA dallanır,
// 'cancelled' yalnızca 'pending_payment'tan dallanır — spec §21.2/SlaService).
const FUNNEL_STAGES: {
  stage: OrderStatus;
  reachedIfStatusIn: OrderStatus[];
}[] = [
  {
    stage: 'draft',
    reachedIfStatusIn: [
      'draft',
      'pending_payment',
      'confirmed',
      'assigned',
      'in_progress',
      'completed_pending_approval',
      'closed',
      'disputed',
      'refunded',
      'cancelled',
    ],
  },
  {
    stage: 'pending_payment',
    reachedIfStatusIn: [
      'pending_payment',
      'confirmed',
      'assigned',
      'in_progress',
      'completed_pending_approval',
      'closed',
      'disputed',
      'refunded',
      'cancelled',
    ],
  },
  {
    stage: 'confirmed',
    reachedIfStatusIn: [
      'confirmed',
      'assigned',
      'in_progress',
      'completed_pending_approval',
      'closed',
      'disputed',
      'refunded',
    ],
  },
  {
    stage: 'assigned',
    reachedIfStatusIn: [
      'assigned',
      'in_progress',
      'completed_pending_approval',
      'closed',
      'disputed',
      'refunded',
    ],
  },
  {
    stage: 'in_progress',
    reachedIfStatusIn: [
      'in_progress',
      'completed_pending_approval',
      'closed',
      'disputed',
      'refunded',
    ],
  },
  {
    stage: 'completed_pending_approval',
    reachedIfStatusIn: [
      'completed_pending_approval',
      'closed',
      'disputed',
      'refunded',
    ],
  },
  // 'closed' yalnızca gerçekten sorunsuz kapanmış siparişleri sayar —
  // disputed/refunded olanlar farklı bir terminal duruma dallandı, "başarı"
  // aşamasına dahil edilmedi.
  { stage: 'closed', reachedIfStatusIn: ['closed'] },
];

@Injectable()
export class KpiService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const [
      statusCounts,
      closedAgg,
      complaintCount,
      closedCount,
      customerOrderCounts,
      confirmEvents,
      assignEvents,
    ] = await Promise.all([
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.order.aggregate({
        where: { status: 'closed' },
        _avg: { priceAmount: true },
        _sum: { priceAmount: true },
      }),
      this.prisma.complaint.count(),
      this.prisma.order.count({ where: { status: 'closed' } }),
      this.prisma.order.groupBy({ by: ['customerId'], _count: { _all: true } }),
      this.prisma.auditLog.findMany({
        where: { entityType: 'order', action: 'order.confirm' },
        select: { entityId: true, createdAt: true },
      }),
      this.prisma.auditLog.findMany({
        where: { entityType: 'order', action: 'order.assign' },
        select: { entityId: true, createdAt: true },
      }),
    ]);

    const countsByStatus = Object.fromEntries(
      statusCounts.map((s) => [s.status, s._count._all]),
    ) as Partial<Record<OrderStatus, number>>;

    // spec §11.1 "tekrarlayan müşteri oranı" — GERÇEKTEN, herhangi bir yeni
    // altyapı gerekmeden hesaplanabilirdi (Order tablosu üzerinde düz bir
    // groupBy). Önceden yanlışlıkla "olay izleme gerektirir" diyen
    // conversionFunnel/averageSlaHours ile aynı null grubuna konmuştu —
    // burada düzeltildi.
    const totalCustomers = customerOrderCounts.length;
    const repeatCustomers = customerOrderCounts.filter(
      (c) => c._count._all >= 2,
    ).length;

    // spec §17'nin 30 dk atama SLA'sı — audit_log'daki (Admin Panel Phase 2)
    // gerçek 'order.assign' zaman damgaları ile confirmed'e geçiş anı
    // arasındaki fark. 'order.confirm' audit kaydı bu fazda (Phase 9)
    // eklendi (bkz. PaymentsService.finalizePayment) — bu düzeltmeden ÖNCE
    // confirmed'e geçen siparişler için eşleşme bulunamaz, ortalamaya
    // dahil edilmez (icat edilmiş bir değer yerine dürüstçe eksik veri).
    const confirmedAtByOrder = new Map(
      confirmEvents.map((e) => [e.entityId, e.createdAt.getTime()]),
    );
    const assignmentDurationsMinutes = assignEvents
      .map((e) => {
        const confirmedAt = confirmedAtByOrder.get(e.entityId);
        return confirmedAt
          ? (e.createdAt.getTime() - confirmedAt) / 60_000
          : null;
      })
      .filter((d): d is number => d !== null);
    const averageAssignmentSlaMinutes =
      assignmentDurationsMinutes.length > 0
        ? assignmentDurationsMinutes.reduce((a, b) => a + b, 0) /
          assignmentDurationsMinutes.length
        : null;

    const orderLifecycleFunnel = FUNNEL_STAGES.map(
      ({ stage, reachedIfStatusIn }) => ({
        stage,
        count: reachedIfStatusIn.reduce(
          (sum, status) => sum + (countsByStatus[status] ?? 0),
          0,
        ),
      }),
    );

    return {
      ordersByStatus: countsByStatus,
      averageOrderValue: closedAgg._avg.priceAmount,
      totalRevenue: closedAgg._sum.priceAmount,
      complaintRate: closedCount > 0 ? complaintCount / closedCount : null,
      repeatCustomerRate:
        totalCustomers > 0 ? repeatCustomers / totalCustomers : null,
      averageAssignmentSlaMinutes,
      // Sipariş yaşam döngüsü hunisi — gerçek, mevcut Order.status'ten
      // hesaplandı. Spec'in "dönüşüm hunisi" ifadesinin muhtemel kastettiği
      // ÜST huniyi (site ziyaretçisi → sipariş) DEĞİL — o hiçbir yerde
      // izlenmiyor, icat edilmedi, null bırakıldı (bkz. conversionFunnel).
      orderLifecycleFunnel,
      conversionFunnel: null,
    };
  }
}
