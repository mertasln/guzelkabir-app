import type { BadgeTone } from "@/components/StatusBadge";
import type { OrderStatus } from "@/lib/types";

// spec §21.2 durum makinesi — OrdersPage/OrderDetailPage/AssignmentPage
// arasında paylaşılan tek kaynak.
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Taslak",
  pending_payment: "Ödeme Bekliyor",
  confirmed: "Onaylandı",
  assigned: "Atandı",
  in_progress: "Devam Ediyor",
  completed_pending_approval: "Onay Bekliyor",
  closed: "Kapatıldı",
  disputed: "Şikayet Edildi",
  refunded: "İade Edildi",
  cancelled: "İptal Edildi",
};

export const ORDER_STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  draft: "muted",
  pending_payment: "warning",
  confirmed: "default",
  assigned: "default",
  in_progress: "default",
  completed_pending_approval: "warning",
  closed: "success",
  disputed: "destructive",
  refunded: "destructive",
  cancelled: "muted",
};
