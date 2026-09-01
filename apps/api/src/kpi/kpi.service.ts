import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class KpiService {
  constructor(private readonly prisma: PrismaService) {}

  // spec §11.1: "Dönüşüm hunisi, AOV, tekrarlayan müşteri oranı, şikayet oranı,
  // ortalama SLA süresi — Metabase embed veya native chart." Metabase/analitik
  // olay izleme altyapısı henüz yok (Admin Panel'in kapsamı, ADIM 8) — dönüşüm
  // hunisi gibi olay-tabanlı metrikler icat edilmedi. Bu yalnızca mevcut
  // şemadan gerçekten hesaplanabilen dürüst bir alt küme: AOV, toplam ciro,
  // duruma göre sipariş sayıları, şikayet oranı.
  async getDashboard() {
    const [statusCounts, closedAgg, complaintCount, closedCount] =
      await Promise.all([
        this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.order.aggregate({
          where: { status: 'closed' },
          _avg: { priceAmount: true },
          _sum: { priceAmount: true },
        }),
        this.prisma.complaint.count(),
        this.prisma.order.count({ where: { status: 'closed' } }),
      ]);

    return {
      ordersByStatus: Object.fromEntries(
        statusCounts.map((s) => [s.status, s._count._all]),
      ),
      averageOrderValue: closedAgg._avg.priceAmount,
      totalRevenue: closedAgg._sum.priceAmount,
      complaintRate: closedCount > 0 ? complaintCount / closedCount : null,
      // Henüz hesaplanamayan metrikler (olay izleme gerektirir, ADIM 8):
      conversionFunnel: null,
      repeatCustomerRate: null,
      averageSlaHours: null,
    };
  }
}
