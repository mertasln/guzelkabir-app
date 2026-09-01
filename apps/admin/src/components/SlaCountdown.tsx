import { useNow } from "@/lib/useNow";
import { StatusBadge } from "@/components/StatusBadge";

const ASSIGNMENT_SLA_MINUTES = 30;

// Genel amaçlı: verilen mutlak `deadline`e göre geri sayım + renk kodu.
// spec §11.1'in hem "Atama Ekranı: SLA sayaç göstergesi (30 dk)" hem
// "Şikayet Yönetimi: SLA sayaç"ı için tek bileşen.
export function SlaCountdown({ deadline }: { deadline: string }) {
  const now = useNow();
  const deadlineMs = new Date(deadline).getTime();
  const remainingMs = deadlineMs - now.getTime();

  if (remainingMs <= 0) {
    return <StatusBadge label="Süre Doldu" tone="destructive" />;
  }
  const totalMinutes = Math.floor(remainingMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const label =
    hours > 0
      ? `${hours}sa ${minutes}dk kaldı`
      : `${minutes}:${Math.floor((remainingMs % 60_000) / 1000)
          .toString()
          .padStart(2, "0")} kaldı`;
  const tone =
    remainingMs < 5 * 60 * 1000 ? "destructive" : remainingMs < 15 * 60 * 1000 ? "warning" : "success";
  return <StatusBadge label={label} tone={tone} />;
}

// spec §11.1 "Atama Ekranı: ... SLA sayaç göstergesi (30 dk hedef)".
// `referenceTime`, SlaService.escalateOverdueAssignments'ın kullandığı AYNI
// proxy (order.updatedAt — spec'in "sipariş confirmed'e ne zaman geçti" için
// ayrı bir alan vermediği, orada belgelenmiş bir varsayım, bkz.
// apps/api/src/sla/sla.service.ts).
export function AssignmentSlaCountdown({ referenceTime }: { referenceTime: string }) {
  const deadline = new Date(
    new Date(referenceTime).getTime() + ASSIGNMENT_SLA_MINUTES * 60 * 1000,
  ).toISOString();
  return <SlaCountdown deadline={deadline} />;
}
