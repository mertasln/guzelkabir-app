import type { ReactNode } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { AuditLogItem, OrderDetail } from "@/lib/types";
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from "@/lib/orderStatus";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";

const AUDIT_ACTION_LABELS: Record<string, string> = {
  "order.assign": "Saha partnerine atandı",
  "order.start": "Saha partneri göreve başladı",
  "order.complete": "Kanıt fotoğrafları yüklendi, onay bekleniyor",
  "order.approve": "Müşteri onayladı, sipariş kapatıldı",
  "order.dispute": "Müşteri şikayet açtı",
  "order.auto_cancel": "Ödeme yapılmadığı için otomatik iptal edildi (24s)",
  "order.auto_close": "Onay penceresi dolduğu için otomatik kapatıldı (48s)",
};

// spec §11.1 "Sipariş Yönetimi: sipariş detay sayfası (zaman çizelgesi/audit
// trail görünümü)." Admin Panel Phase 2'nin audit_log altyapısının ilk
// gerçek frontend tüketicisi.
export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();

  const orderQuery = useQuery({
    queryKey: ["order", id],
    queryFn: () => apiRequest<OrderDetail>(`/orders/${id}`),
    enabled: !!id,
  });

  const auditQuery = useQuery({
    queryKey: ["order-audit", id],
    queryFn: () => apiRequest<AuditLogItem[]>(`/orders/${id}/audit`),
    enabled: !!id,
  });

  if (orderQuery.isLoading) {
    return <p className="text-sm text-[var(--muted-foreground)]">Yükleniyor…</p>;
  }
  if (!orderQuery.data) {
    return <p className="text-sm text-[var(--destructive)]">Sipariş bulunamadı.</p>;
  }
  const order = orderQuery.data;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{order.orderNumber}</h1>
        <Link to="/siparisler">
          <Button variant="outline" size="sm">
            ← Listeye Dön
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Sipariş Bilgileri</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Durum">
              <StatusBadge label={ORDER_STATUS_LABELS[order.status]} tone={ORDER_STATUS_TONE[order.status]} />
            </Row>
            <Row label="Müşteri">{order.customer.fullName} ({order.customer.email})</Row>
            <Row label="Mezarlık">
              {order.graveLocation.cemetery.name} — {order.graveLocation.cemetery.city}/
              {order.graveLocation.cemetery.district}
            </Row>
            <Row label="Ada/Parsel">
              {order.graveLocation.section && order.graveLocation.plot
                ? `${order.graveLocation.section} / ${order.graveLocation.plot}`
                : "Belirtilmedi (saha ekibi tespit edecek)"}
            </Row>
            <Row label="Saha Partneri">{order.assignedPartner?.user.fullName ?? "Henüz atanmadı"}</Row>
            <Row label="Tutar">
              {order.priceAmount} {order.currency}
            </Row>
            <Row label="Özel Not">{order.specialNotes ?? "—"}</Row>
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold">Zaman Çizelgesi</h2>
          {auditQuery.isLoading && (
            <p className="text-sm text-[var(--muted-foreground)]">Yükleniyor…</p>
          )}
          {auditQuery.data && auditQuery.data.length === 0 && (
            <p className="text-sm text-[var(--muted-foreground)]">
              Henüz kayıtlı bir durum geçişi yok.
            </p>
          )}
          <ol className="space-y-3">
            {auditQuery.data?.map((entry) => (
              <li key={entry.id} className="border-l-2 border-[var(--border)] pl-3 text-sm">
                <p className="font-medium">{AUDIT_ACTION_LABELS[entry.action] ?? entry.action}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {new Date(entry.createdAt).toLocaleString("tr-TR")} —{" "}
                  {entry.actorRole === "system" ? "Sistem (SLA otomasyonu)" : entry.actorRole}
                </p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--muted-foreground)]">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
