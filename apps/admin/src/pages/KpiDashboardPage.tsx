import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiRequest } from "@/lib/api";
import type { KpiDashboard } from "@/lib/types";
import { ORDER_STATUS_LABELS } from "@/lib/orderStatus";
import { Card } from "@/components/ui/card";

// spec §11.1 "KPI Dashboard: Dönüşüm hunisi, AOV, tekrarlayan müşteri oranı,
// şikayet oranı, ortalama SLA süresi — Metabase embed veya native chart
// (Recharts)." Kullanıcı kararı (ADIM 9 planlaması): native Recharts,
// Metabase DEĞİL — pilot ölçeğinde ayrı bir BI aracı hosting'i gereksiz
// karmaşıklık (bkz. CLAUDE.md "tracked spec deviation").
export function KpiDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["kpi-dashboard"],
    queryFn: () => apiRequest<KpiDashboard>("/kpi/dashboard"),
  });

  if (isLoading) {
    return <p className="text-sm text-[var(--muted-foreground)]">Yükleniyor…</p>;
  }
  if (!data) {
    return <p className="text-sm text-[var(--destructive)]">Veri yüklenemedi.</p>;
  }

  const funnelData = data.orderLifecycleFunnel.map((s) => ({
    stage: ORDER_STATUS_LABELS[s.stage],
    count: s.count,
  }));

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">KPI Dashboard</h1>

      <div className="mb-6 grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Ortalama Sipariş Değeri"
          value={data.averageOrderValue ? `${data.averageOrderValue} TRY` : "—"}
        />
        <StatCard
          label="Toplam Ciro"
          value={data.totalRevenue ? `${data.totalRevenue} TRY` : "—"}
        />
        <StatCard
          label="Şikayet Oranı"
          value={data.complaintRate !== null ? `%${(data.complaintRate * 100).toFixed(1)}` : "—"}
        />
        <StatCard
          label="Tekrarlayan Müşteri Oranı"
          value={
            data.repeatCustomerRate !== null
              ? `%${(data.repeatCustomerRate * 100).toFixed(1)}`
              : "—"
          }
        />
        <StatCard
          label="Ort. Atama Süresi (SLA hedefi: 30 dk)"
          value={
            data.averageAssignmentSlaMinutes !== null
              ? `${data.averageAssignmentSlaMinutes.toFixed(1)} dk`
              : "Henüz veri yok"
          }
        />
      </div>

      <Card className="mb-6">
        <h2 className="mb-1 text-sm font-semibold">Sipariş Yaşam Döngüsü Hunisi</h2>
        <p className="mb-4 text-xs text-[var(--muted-foreground)]">
          Her aşamaya ulaşmış (o aşamada veya sonrasında olan) sipariş sayısı, kümülatif.
          Bu, gerçek bir üst-huniyi (site ziyaretçisi → sipariş başlatan) TEMSİL ETMİYOR —
          apps/web'de pageview/oturum takibi yapan bir analytics altyapısı yok. Aşağıdaki
          grafik yalnızca mevcut sipariş verisinden hesaplanabilen sipariş içi ilerlemeyi
          gösteriyor.
        </p>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={funnelData} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="stage" width={140} />
              <Tooltip />
              <Bar dataKey="count" fill="var(--primary)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-semibold">Dönüşüm Hunisi (Üst Huni)</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Hesaplanamıyor — site ziyaretçisi/oturum takibi yapan bir analytics altyapısı
          henüz yok. Yukarıdaki sipariş yaşam döngüsü hunisi, mevcut verilerden
          hesaplanabilen en yakın gerçek karşılık.
        </p>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="mb-1 text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </Card>
  );
}
