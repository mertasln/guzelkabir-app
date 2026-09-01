import { Card } from "@/components/ui/card";

// Phase 3 yalnızca kabuğu kuruyor — bu modülün gerçek ekranı kendi fazında
// (bkz. CLAUDE.md "Admin Panel" bölümü, faz planı) bu bileşenin yerini alacak.
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">{title}</h1>
      <Card>
        <p className="text-sm text-[var(--muted-foreground)]">
          Bu modül henüz inşa edilmedi — yakında.
        </p>
      </Card>
    </div>
  );
}
