import type { PendingAction } from "@/lib/db";
import { cn } from "@/lib/utils";

const LABELS: Record<PendingAction["status"], string> = {
  pending: "Bağlantı bekleniyor",
  syncing: "Gönderiliyor…",
  synced: "Gönderildi",
  failed: "Reddedildi",
};

const STYLES: Record<PendingAction["status"], string> = {
  pending: "bg-amber-100 text-amber-800",
  syncing: "bg-blue-100 text-blue-800",
  synced: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

// spec §12.2 offline-first — saha partneri kuyruğun durumunu (Background
// Sync sekme kapalıyken de çalıştığından) görebilmeli, aksi halde "gönderdim
// mi, göndermedim mi" belirsizliği yaratır.
export function SyncStatusBadge({ action }: { action: PendingAction }) {
  return (
    <span
      className={cn("inline-block rounded px-2 py-0.5 text-xs font-medium", STYLES[action.status])}
      title={action.error}
    >
      {LABELS[action.status]}
      {action.status === "failed" && action.error ? `: ${action.error}` : ""}
    </span>
  );
}
