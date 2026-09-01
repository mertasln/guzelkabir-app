import { useNow } from "@/lib/useNow";
import { StatusBadge } from "@/components/StatusBadge";

const ASSIGNMENT_SLA_MINUTES = 30;

// spec §11.1 "Atama Ekranı: ... SLA sayaç göstergesi (30 dk hedef, renk
// kodlu uyarı)". `referenceTime`, SlaService.escalateOverdueAssignments'ın
// kullandığı AYNI proxy (order.updatedAt — spec'in "sipariş confirmed'e ne
// zaman geçti" için ayrı bir alan vermediği, orada belgelenmiş bir varsayım,
// bkz. apps/api/src/sla/sla.service.ts).
export function SlaCountdown({ referenceTime }: { referenceTime: string }) {
  const now = useNow();
  const deadline = new Date(referenceTime).getTime() + ASSIGNMENT_SLA_MINUTES * 60 * 1000;
  const remainingMs = deadline - now.getTime();

  if (remainingMs <= 0) {
    return <StatusBadge label="Süre Doldu" tone="destructive" />;
  }
  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1000);
  const label = `${minutes}:${seconds.toString().padStart(2, "0")} kaldı`;
  const tone = remainingMs < 5 * 60 * 1000 ? "destructive" : remainingMs < 15 * 60 * 1000 ? "warning" : "success";
  return <StatusBadge label={label} tone={tone} />;
}
