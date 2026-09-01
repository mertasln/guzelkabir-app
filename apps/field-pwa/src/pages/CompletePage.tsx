import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { enqueueAction } from "@/lib/queue";
import { useOrderActions } from "@/lib/useOrderActions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SyncStatusBadge } from "@/components/SyncStatusBadge";

// spec §12.1 madde 29 "Rapor & Tamamlama" — saha notu CapturePage'in son
// adımına taşındı (bkz. o dosyanın yorumu); bu ekran spec'in aynı maddesindeki
// ikinci yarısını karşılıyor: özet + "Tamamla" butonu.
//
// ADIM 8b: "Tamamla" da enqueueAction() ile kuyruğa yazılır. Evidence
// fotoğrafları henüz senkronize olmasa bile 'complete' hemen kuyruğa
// eklenebilir — sıralı işleme (bkz. queue.ts flushOrder) 'complete'i evidence
// aksiyonları senkronize OLMADAN asla denemez, kullanıcı beklemeden devam
// edebilir.
export function CompletePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [queued, setQueued] = useState(false);

  const actions = useOrderActions(id);
  const completeAction = actions.find((a) => a.type === "complete");

  async function handleComplete() {
    if (!id) return;
    await enqueueAction(id, "complete");
    setQueued(true);
  }

  if (queued) {
    return (
      <div className="mx-auto max-w-md p-4">
        <Card className="mb-4">
          <p className="font-medium">Görev raporu kuyruğa alındı.</p>
          {completeAction && (
            <div className="mt-2">
              <SyncStatusBadge action={completeAction} />
            </div>
          )}
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Bağlantı yoksa fotoğraflar ve tamamlama isteği bağlantı gelince otomatik gönderilir. Müşteri
            onayı, sunucuya ulaştıktan sonra 48 saat içinde bekleniyor.
          </p>
        </Card>
        <Button size="lg" className="w-full" onClick={() => navigate("/gorevler", { replace: true })}>
          Görevlerime Dön
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-4">
      <h1 className="mb-3 text-lg font-semibold">Raporu Gönder</h1>
      <Card className="mb-4">
        <p className="text-sm text-[var(--muted-foreground)]">
          İki fotoğraf (geniş açı + detay) ve saha notu kaydedildi. Devam ederek görevi tamamlayabilirsiniz.
        </p>
      </Card>
      <Button size="lg" className="w-full" onClick={handleComplete}>
        Tamamla
      </Button>
    </div>
  );
}
