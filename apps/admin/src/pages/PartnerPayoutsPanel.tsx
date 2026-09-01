import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { PartnerPayout, PayoutStatus } from "@/lib/types";
import { StatusBadge, type BadgeTone } from "@/components/StatusBadge";

const PAYOUT_LABELS: Record<PayoutStatus, string> = {
  pending: "Bekliyor",
  paid: "Ödendi",
  held_dispute: "Şikayet Nedeniyle Tutuldu",
};

const PAYOUT_TONE: Record<PayoutStatus, BadgeTone> = {
  pending: "warning",
  paid: "success",
  held_dispute: "destructive",
};

// spec §11.1: "ödeme hak ediş (payout) listesi" — PartnersPage'in satır
// detayında (bkz. DataTable renderRowDetail) gösterilir.
export function PartnerPayoutsPanel({ partnerId }: { partnerId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["partner-payouts", partnerId],
    queryFn: () => apiRequest<PartnerPayout[]>(`/partners/${partnerId}/payouts`),
  });

  if (isLoading) {
    return <p className="text-xs text-[var(--muted-foreground)]">Yükleniyor…</p>;
  }
  if (!data || data.length === 0) {
    return <p className="text-xs text-[var(--muted-foreground)]">Hak ediş kaydı yok.</p>;
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-[var(--muted-foreground)]">
          <th className="pb-1 pr-4 font-medium">Sipariş</th>
          <th className="pb-1 pr-4 font-medium">Tutar</th>
          <th className="pb-1 pr-4 font-medium">Durum</th>
          <th className="pb-1 font-medium">Ödeme Tarihi</th>
        </tr>
      </thead>
      <tbody>
        {data.map((payout) => (
          <tr key={payout.id}>
            <td className="py-1 pr-4">{payout.orderId}</td>
            <td className="py-1 pr-4">{payout.amount} ₺</td>
            <td className="py-1 pr-4">
              <StatusBadge label={PAYOUT_LABELS[payout.status]} tone={PAYOUT_TONE[payout.status]} />
            </td>
            <td className="py-1">
              {payout.paidAt ? new Date(payout.paidAt).toLocaleDateString("tr-TR") : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
