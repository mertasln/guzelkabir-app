import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import type { CursorPage, Task } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const SERVICE_TYPE_LABELS: Record<Task["serviceType"], string> = {
  cleaning: "Temizlik",
  watering: "Sulama",
  flowers: "Çiçek Ekleme",
  full_package: "Tam Paket",
  subscription: "Abonelik",
};

const STATUS_LABELS: Partial<Record<Task["status"], string>> = {
  assigned: "Atandı",
  in_progress: "Devam Ediyor",
};

// spec §12.1 madde 26: "harita üzerinde günlük rota görünümü" — bilinçli
// sadeleştirme, kullanıcı onaylı: GOOGLE_MAPS_API_KEY henüz yok (bkz.
// CLAUDE.md), gömülü harita yerine SLA aciliyetine göre sıralı bir liste
// kullanılıyor. Harita view'ı flagged bir follow-up, kullanıcı gerektiğinde
// kendi açacak — bu ADIM'da ayrıca hatırlatma istenmedi.
export function TaskListPage() {
  const { user, logout } = useAuth();
  const [page, setPage] = useState<CursorPage<Task> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.fieldPartnerId) return;
    apiRequest<CursorPage<Task>>(`/partners/${user.fieldPartnerId}/tasks`)
      .then(setPage)
      .catch(() => setError("Görevler yüklenemedi."));
  }, [user?.fieldPartnerId]);

  if (user && !user.fieldPartnerId) {
    return (
      <div className="p-4">
        <p className="text-sm text-[var(--muted-foreground)]">
          Bu hesap için saha partneri kaydı bulunamadı. Lütfen operasyon ekibiyle iletişime geçin.
        </p>
      </div>
    );
  }

  const activeTasks = (page?.items ?? []).filter(
    (t) => t.status === "assigned" || t.status === "in_progress",
  );

  return (
    <div className="mx-auto max-w-md p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Görevlerim</h1>
        <Button variant="ghost" size="sm" onClick={logout}>
          Çıkış
        </Button>
      </div>

      {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
      {!page && !error && <p className="text-sm text-[var(--muted-foreground)]">Yükleniyor…</p>}
      {page && activeTasks.length === 0 && (
        <p className="text-sm text-[var(--muted-foreground)]">Atanmış aktif görev yok.</p>
      )}

      <div className="flex flex-col gap-3">
        {activeTasks.map((task) => (
          <Link key={task.id} to={`/gorevler/${task.id}`}>
            <Card className="hover:border-[var(--primary)]">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium">{task.orderNumber}</span>
                <span className="rounded bg-[var(--muted)] px-2 py-0.5 text-xs">
                  {STATUS_LABELS[task.status] ?? task.status}
                </span>
              </div>
              <p className="text-sm text-[var(--muted-foreground)]">
                {task.graveLocation.cemetery.name} — {task.graveLocation.cemetery.district},{" "}
                {task.graveLocation.cemetery.city}
              </p>
              <p className="mt-1 text-sm">{SERVICE_TYPE_LABELS[task.serviceType]}</p>
              {task.specialNotes && (
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">"{task.specialNotes}"</p>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
