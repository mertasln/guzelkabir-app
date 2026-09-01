import { getDb, type ActionType, type EvidencePayload, type PendingAction } from "./db";
import { apiRequest, ApiError, getAccessToken, refreshAccessToken } from "./api";
import { sha256Base64 } from "./sha256";

let seqCounter = 0;

export async function enqueueAction(
  orderId: string,
  type: ActionType,
  payload?: EvidencePayload,
): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const action: PendingAction = {
    id,
    orderId,
    type,
    payload,
    status: "pending",
    createdAt: Date.now(),
    seq: Date.now() * 1000 + seqCounter++,
  };
  await db.put("pendingActions", action);
  void requestSync();
  return id;
}

export async function listActionsForOrder(orderId: string): Promise<PendingAction[]> {
  const db = await getDb();
  const items = await db.getAllFromIndex("pendingActions", "by-order", orderId);
  return items.sort((a, b) => a.seq - b.seq);
}

// spec §12.2 offline testinde doğrulanan gerçek gereklilik: bir kayıt
// 'syncing' iken sekme kapanırsa (ağ isteği yarıda kesilirse), hiçbir kod
// bunu asla 'pending'e geri döndürmez — sonsuza kadar 'syncing' görünür
// kalır ve bir daha asla senkronize edilmeye çalışılmaz. Uygulama her
// başladığında (bkz. main.tsx), yarıda kalmış olabilecek her kaydı 'pending'e
// geri alıyoruz — sunucunun isteği gerçekten işleyip işlemediğini bilemeyiz,
// ama her aksiyon türü Idempotency-Key ile korunduğundan (bkz. apps/api
// OrdersController yorumları) güvenle yeniden denenebilir: istek gerçekten
// başarılı olmuşsa sunucu önbellekteki sonucu döner, çift kayıt oluşmaz.
export async function resetInterruptedSyncs(): Promise<void> {
  const db = await getDb();
  const stuck = await db.getAllFromIndex("pendingActions", "by-status", "syncing");
  const tx = db.transaction("pendingActions", "readwrite");
  for (const action of stuck) {
    await tx.store.put({ ...action, status: "pending" });
  }
  await tx.done;
}

async function updateAction(id: string, patch: Partial<PendingAction>): Promise<void> {
  const db = await getDb();
  const existing = await db.get("pendingActions", id);
  if (!existing) return;
  await db.put("pendingActions", { ...existing, ...patch });
}

async function syncOne(action: PendingAction): Promise<"synced" | "failed" | "pending"> {
  await updateAction(action.id, { status: "syncing" });
  try {
    if (action.type === "start") {
      await apiRequest(`/orders/${action.orderId}/start`, {
        method: "POST",
        headers: { "Idempotency-Key": action.id },
      });
    } else if (action.type === "complete") {
      await apiRequest(`/orders/${action.orderId}/complete`, {
        method: "POST",
        headers: { "Idempotency-Key": action.id },
      });
    } else if (action.type === "evidence" && action.payload) {
      const { blob, photoType, fieldNote } = action.payload;
      const contentSha256 = await sha256Base64(await blob.arrayBuffer());
      const { fileKey, uploadUrl } = await apiRequest<{ fileKey: string; uploadUrl: string }>(
        `/orders/${action.orderId}/evidence/upload-url`,
        { method: "POST", body: JSON.stringify({ contentSha256 }) },
      );
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg", "x-amz-checksum-sha256": contentSha256 },
        body: blob,
      });
      if (!putRes.ok) throw new Error(`S3 PUT failed: ${putRes.status}`);
      await apiRequest(`/orders/${action.orderId}/evidence`, {
        method: "POST",
        headers: { "Idempotency-Key": action.id },
        body: JSON.stringify({ photoType, fileKey, ...(fieldNote ? { fieldNote } : {}) }),
      });
    }
    await updateAction(action.id, { status: "synced", error: undefined });
    return "synced";
  } catch (err) {
    // 4xx (ApiError) -> sunucu bu isteği kalıcı olarak reddetti (spec §12.2:
    // "son yazan kazanır" — sunucu otoriter, kullanıcıya neden gösterilir,
    // sessizce ezilmez/yeniden denenmez sonsuza kadar). Ağ hatası (fetch
    // reddi, ApiError DEĞİL) -> hâlâ 'pending' bırak, bir sonraki
    // senkronizasyonda (Background Sync veya 'online' event) tekrar denenir.
    if (err instanceof ApiError && err.status === 409) {
      // IdempotencyInterceptor: aynı key hâlâ "processing" — muhtemelen bir
      // önceki deneme sunucuda hâlâ sürüyor. Kalıcı red değil, tekrar dene.
      await updateAction(action.id, { status: "pending" });
      return "pending";
    }
    if (err instanceof ApiError) {
      await updateAction(action.id, { status: "failed", error: err.message });
      return "failed";
    }
    await updateAction(action.id, { status: "pending" });
    return "pending";
  }
}

// Bir order'ın kuyruğu seq sırasına göre, SIRALI işlenir — evidence, start
// senkronize olmadan; complete, iki evidence de senkronize olmadan asla
// denenmez (backend zaten bunu reddeder, ama gereksiz isteği hiç atmıyoruz).
async function flushOrder(orderId: string): Promise<void> {
  const items = await listActionsForOrder(orderId);
  for (const action of items) {
    if (action.status === "synced") continue;
    if (action.status === "failed") break; // önceki adım kalıcı reddedildi, sonrasını deneme
    if (action.status === "syncing") continue; // zaten devam eden bir deneme var
    const result = await syncOne(action);
    if (result !== "synced") break;
  }
}

let flushing = false;

export async function flushQueue(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const db = await getDb();
    const pending = await db.getAllFromIndex("pendingActions", "by-status", "pending");
    if (pending.length === 0) return;

    // Bu fonksiyon sayfa bağlamında VEYA service worker'ın kendi bağlamında
    // (Background Sync `sync` event'i, bkz. sw.ts) çalışabilir — ikisi de
    // api.ts'in AYRI bir modül kopyasına sahip (ayrı bundle), yani bellekteki
    // accessToken sıfırdan başlıyor. httpOnly refresh cookie'si her iki
    // bağlamda da tarayıcı tarafından otomatik gönderildiğinden (aynı origin),
    // burada proaktif bir refresh denemesi güvenle çalışır — sayfanın kendi
    // token'ına bağımlı değil.
    if (!getAccessToken()) {
      const token = await refreshAccessToken();
      if (!token) return; // gerçekten offline veya oturum geçersiz — bir sonraki tetiklemede tekrar denenir
    }
    const orderIds = [...new Set(pending.map((a) => a.orderId))];
    await Promise.all(orderIds.map((id) => flushOrder(id)));
  } finally {
    flushing = false;
  }
}

// ⚠️ Gerçek, canlı Playwright testinde bulunan gerçek boşluk: context.setOffline(true)
// bir sayfa henüz hiç yüklenmeden ÖNCE (taze bir context'te) uygulanıp sayfa
// service worker'ın offline fallback'inden yüklendiğinde, navigator.onLine
// bazen hâlâ `true` raporluyor — gerçek ağ istekleri GERÇEKTEN offline'ken
// bile (ERR_INTERNET_DISCONNECTED doğrulandı). Bu durumda tekrar bağlanınca
// (setOffline(false)) false→true geçişi hiç yaşanmadığından 'online' event'i
// HİÇ ateşlenmiyor — main.tsx'teki fallback dinleyici tetiklenmiyor ve kuyruk
// süresiz 'pending' kalıyor (Background Sync da devreye girmezse). Sahada
// (gerçek cihaz, kesik/dalgalı sinyal) aynı sınıf bir senaryo teorik olarak
// mümkün — bu yüzden 'online' event'i TEK güvenlik ağı olarak bırakılmadı:
// periyodik bir yoklama (poll) ikinci, event'ten bağımsız bir tetikleyici.
const PERIODIC_SYNC_INTERVAL_MS = 20_000;

export function startPeriodicSync(): void {
  setInterval(() => void flushQueue(), PERIODIC_SYNC_INTERVAL_MS);
}

const SYNC_TAG = "flush-pending-actions";

export async function requestSync(): Promise<void> {
  // Önce dene: gerçekten online isek anında senkronize olsun, kullanıcı
  // bağlantı geri gelene kadar beklemesin.
  void flushQueue();

  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const reg = registration as ServiceWorkerRegistration & {
        sync?: { register(tag: string): Promise<void> };
      };
      if (reg.sync) {
        await reg.sync.register(SYNC_TAG);
        return;
      }
    } catch {
      // Background Sync desteklenmiyor (örn. Safari) — 'online' fallback'e düş.
    }
  }
  // Fallback: Background Sync API her yerde yok. 'online' event'i zaten
  // main.tsx'te bir kez global olarak bağlanıyor.
}

export { SYNC_TAG };
