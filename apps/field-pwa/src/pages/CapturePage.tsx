import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { enqueueAction } from "@/lib/queue";
import { useOrderActions } from "@/lib/useOrderActions";
import type { PhotoType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { SyncStatusBadge } from "@/components/SyncStatusBadge";

const FIELD_NOTE_MAX = 200;

const STEPS: { type: PhotoType; label: string; hint: string }[] = [
  { type: "wide_shot", label: "Geniş Açı", hint: "Mezar ve çevresini kapsayan geniş bir çekim." },
  { type: "detail_shot", label: "Detay Çekimi", hint: "Yapılan bakımı yakından gösteren bir çekim." },
];

// spec §12.1 madde 28 + §8.1 madde 13 ("yalnızca canlı çekim, galeri yüklemesi
// kapatılır"): dosya <input> DEĞİL, getUserMedia tabanlı özel bir çekim
// arayüzü — galeri seçme yolu hiç yok, "yalnızca canlı çekim" kuralı
// mimari olarak zaten sağlanıyor.
//
// ADIM 8b (offline-first, spec §12.2): fotoğraf ONAYLANDIĞI anda gerçek ağ
// isteği YAPILMAZ — enqueueAction() ile yerel kuyruğa (IndexedDB) yazılır ve
// UI hemen bir sonraki adıma geçer. Gerçek yükleme (upload-url → S3 PUT →
// evidence POST) arka planda src/lib/queue.ts tarafından, online olunca
// (hemen) veya Background Sync/`online` event'i tetikleyince yürütülür.
export function CapturePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [fieldNote, setFieldNote] = useState("");

  const actions = useOrderActions(id);
  const evidenceActions = actions.filter((a) => a.type === "evidence");

  const step = STEPS[stepIndex];
  const done = queuedCount >= STEPS.length;
  // Spec §12.1 madde 28/29 iki ayrı ekran tanımlıyor (fotoğraf çekimi / saha
  // notu + tamamla), ama backend'de saha notu evidence_photos.field_note'ta
  // yaşıyor (bkz. CreateEvidenceDto yorumu) — yalnızca bir fotoğraf yükleme
  // isteğiyle birlikte gönderilebilir, sonradan eklenecek bir PATCH ucu yok.
  // Bilinçli, dokümante edilmiş bir birleştirme: saha notu SON fotoğrafın
  // (detail_shot) onay adımına eklendi; "Rapor & Tamamlama" ekranı (bkz.
  // CompletePage) yalnızca özet + "Tamamla" butonuna indirgendi.
  const isLastStep = stepIndex === STEPS.length - 1;

  useEffect(() => {
    if (previewBlob || done) return;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setCameraError("Kameraya erişilemedi. Tarayıcı izinlerini kontrol edin."));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [previewBlob, done]);

  function handleShoot() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setPreviewBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      },
      "image/jpeg",
      0.92,
    );
  }

  function handleRetake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewBlob(null);
    setPreviewUrl(null);
  }

  async function handleConfirm() {
    if (!id || !previewBlob) return;
    await enqueueAction(id, "evidence", {
      photoType: step.type,
      blob: previewBlob,
      ...(isLastStep && fieldNote.trim() ? { fieldNote: fieldNote.trim() } : {}),
    });
    handleRetake();
    setQueuedCount((c) => c + 1);
    setStepIndex((i) => i + 1);
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md p-4">
        <h1 className="mb-3 text-lg font-semibold">Fotoğraflar Kuyruğa Alındı</h1>
        <div className="mb-4 flex flex-col gap-2">
          {evidenceActions.map((a) => (
            <Card key={a.id} className="flex items-center justify-between">
              <span className="text-sm">{STEPS.find((s) => s.type === a.payload?.photoType)?.label}</span>
              <SyncStatusBadge action={a} />
            </Card>
          ))}
        </div>
        <p className="mb-4 text-sm text-[var(--muted-foreground)]">
          Bağlantı yoksa fotoğraflar cihazda bekler, bağlantı gelince otomatik gönderilir. Beklemeden devam
          edebilirsiniz.
        </p>
        <Button size="lg" className="w-full" onClick={() => navigate(`/gorevler/${id}/tamamla`)}>
          Devam Et
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col p-4">
      <h1 className="mb-1 text-lg font-semibold">
        {step.label} ({stepIndex + 1}/{STEPS.length})
      </h1>
      <p className="mb-3 text-sm text-[var(--muted-foreground)]">{step.hint}</p>

      {cameraError && <p className="mb-3 text-sm text-[var(--destructive)]">{cameraError}</p>}

      <div className="mb-4 aspect-[3/4] w-full overflow-hidden rounded-lg bg-black">
        {previewUrl ? (
          <img src={previewUrl} alt="Önizleme" className="h-full w-full object-cover" />
        ) : (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        )}
      </div>

      {previewBlob ? (
        <div className="flex flex-col gap-3">
          {isLastStep && (
            <div>
              <Textarea
                placeholder="Saha notu (zorunlu, en fazla 200 karakter)"
                value={fieldNote}
                maxLength={FIELD_NOTE_MAX}
                onChange={(e) => setFieldNote(e.target.value)}
              />
              <p className="mt-1 text-right text-xs text-[var(--muted-foreground)]">
                {fieldNote.length}/{FIELD_NOTE_MAX}
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleRetake}>
              Yeniden Çek
            </Button>
            <Button className="flex-1" onClick={handleConfirm} disabled={isLastStep && !fieldNote.trim()}>
              Onayla
            </Button>
          </div>
        </div>
      ) : (
        <Button size="lg" className="w-full" onClick={handleShoot} disabled={!!cameraError}>
          Çek
        </Button>
      )}
    </div>
  );
}
