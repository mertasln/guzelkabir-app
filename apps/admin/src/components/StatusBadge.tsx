import { cn } from "@/lib/utils";

export type BadgeTone = "default" | "success" | "warning" | "destructive" | "muted";

const TONE_CLASSES: Record<BadgeTone, string> = {
  default: "bg-[var(--primary)]/10 text-[var(--primary)]",
  success: "bg-[var(--success)]/10 text-[var(--success)]",
  warning: "bg-[var(--warning)]/10 text-[var(--warning)]",
  destructive: "bg-[var(--destructive)]/10 text-[var(--destructive)]",
  muted: "bg-[var(--muted-foreground)]/10 text-[var(--muted-foreground)]",
};

// Ekranlar arası paylaşılan pil bileşeni — her ekran kendi status→tone
// eşlemesini tanımlar (bkz. PartnersPage'in PARTNER_STATUS_TONE'u).
export function StatusBadge({ label, tone = "default" }: { label: string; tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
      )}
    >
      {label}
    </span>
  );
}
