import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "@/lib/api";
import { enqueueAction } from "@/lib/queue";
import { useOrderActions } from "@/lib/useOrderActions";
import type { Task } from "@/lib/types";
import { getCurrentPositionSafe, haversineDistanceMeters } from "@/lib/geo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SyncStatusBadge } from "@/components/SyncStatusBadge";

const SERVICE_TYPE_LABELS: Record<Task["serviceType"], string> = {
  cleaning: "Temizlik",
  watering: "Sulama",
  flowers: "Çiçek Ekleme",
  full_package: "Tam Paket",
  subscription: "Abonelik",
};

// spec §12.1 madde 27: "'Başla' butonu → konum GPS ile doğrulanır (mezarlığa
// X metre yakınlık kontrolü, OPSİYONEL sert kural)". Kullanıcı onaylı karar:
// yumuşak/uyarı, hard-block YOK — asıl bağlayıcı doğrulama zaten kanıt
// yüklemesinde sunucu tarafında EXIF+Haversine ile yapılıyor.
//
// ADIM 8b: "Başla" artık enqueueAction() ile yerel kuyruğa yazılır, gerçek
// POST /orders/:id/start çağrısı arka planda olur (bkz. queue.ts). Bu yüzden
// ekran, sunucudan gelen task.status'a değil, task.status + yerel kuyruk
// durumunun BİRLEŞİMİNE (effective status) göre karar veriyor — aksi halde
// offline'ken "Başla"ya basan partner hâlâ "Başla" butonunu görmeye devam
// ederdi, oysa aksiyon zaten kuyrukta ve senkronize olacak.
export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gpsWarning, setGpsWarning] = useState<string | null>(null);

  const actions = useOrderActions(id);
  const startAction = actions.find((a) => a.type === "start");

  useEffect(() => {
    if (!id) return;
    apiRequest<Task>(`/orders/${id}`)
      .then(setTask)
      .catch(() => setError("Görev yüklenemedi (ve önbellekte de yok)."));
  }, [id]);

  const effectiveStarted =
    task?.status !== "assigned" || (startAction && startAction.status !== "failed");

  async function handleStart() {
    if (!task) return;
    setGpsWarning(null);
    const referenceLat = task.graveLocation.lat ?? task.graveLocation.cemetery.lat;
    const referenceLng = task.graveLocation.lng ?? task.graveLocation.cemetery.lng;
    if (referenceLat && referenceLng) {
      const position = await getCurrentPositionSafe();
      if (position) {
        const toleranceM = task.graveLocation.cemetery.geotagToleranceM ?? 150;
        const distance = haversineDistanceMeters(
          { lat: position.coords.latitude, lng: position.coords.longitude },
          { lat: Number(referenceLat), lng: Number(referenceLng) },
        );
        if (distance > toleranceM) {
          setGpsWarning(
            `Mevcut konumunuz mezarlıktan yaklaşık ${Math.round(distance)}m uzakta görünüyor. Yine de devam edebilirsiniz — asıl doğrulama fotoğraf yüklerken yapılacak.`,
          );
        }
      }
    }
    await enqueueAction(task.id, "start");
  }

  if (error) return <p className="p-4 text-sm text-[var(--destructive)]">{error}</p>;
  if (!task) return <p className="p-4 text-sm text-[var(--muted-foreground)]">Yükleniyor…</p>;

  const g = task.graveLocation;

  return (
    <div className="mx-auto max-w-md p-4">
      <Link to="/gorevler" className="mb-3 inline-block text-sm text-[var(--muted-foreground)]">
        ← Görevlerim
      </Link>
      <h1 className="mb-3 text-lg font-semibold">{task.orderNumber}</h1>

      <Card className="mb-4">
        <p className="font-medium">{g.cemetery.name}</p>
        <p className="text-sm text-[var(--muted-foreground)]">
          {g.cemetery.district}, {g.cemetery.city}
        </p>
        {(g.section || g.plot) && (
          <p className="mt-1 text-sm">
            Ada: {g.section ?? "—"} · Parsel: {g.plot ?? "—"}
            {g.graveNo ? ` · Mezar No: ${g.graveNo}` : ""}
          </p>
        )}
        {!g.section && !g.plot && (
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Ada/parsel bilgisi yok — konumu sahada tespit edin.
          </p>
        )}
        {g.locationNote && <p className="mt-1 text-sm">Tarif: {g.locationNote}</p>}
        <p className="mt-2 text-sm">Hizmet: {SERVICE_TYPE_LABELS[task.serviceType]}</p>
        {task.specialNotes && <p className="mt-1 text-sm">Müşteri notu: "{task.specialNotes}"</p>}
      </Card>

      {gpsWarning && (
        <Card className="mb-4 border-amber-400 bg-amber-50">
          <p className="text-sm text-amber-800">{gpsWarning}</p>
        </Card>
      )}

      {startAction && (
        <div className="mb-4">
          <SyncStatusBadge action={startAction} />
        </div>
      )}

      {!effectiveStarted && (
        <Button size="lg" className="w-full" onClick={handleStart}>
          Başla
        </Button>
      )}

      {effectiveStarted && task.status !== "completed_pending_approval" && (
        <Button size="lg" className="w-full" onClick={() => navigate(`/gorevler/${task.id}/fotograf`)}>
          Fotoğraf Çek
        </Button>
      )}

      {task.status === "completed_pending_approval" && (
        <p className="text-sm text-[var(--muted-foreground)]">
          Görev tamamlandı, müşteri onayı bekleniyor.
        </p>
      )}
    </div>
  );
}
