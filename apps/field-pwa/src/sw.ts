/// <reference lib="webworker" />
import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { NetworkFirst } from "workbox-strategies";
import { flushQueue, SYNC_TAG } from "./lib/queue";

declare let self: ServiceWorkerGlobalScope;

// vite-plugin-pwa (injectManifest) bu değişkeni build zamanında doldurur —
// app shell'i (JS/CSS/HTML) önbelleğe alır, spec §12.2'nin "görev listesi ve
// form durumu IndexedDB'de/Cache API'de cache'lenir" kısmının statik-asset
// kısmı.
precacheAndRoute(self.__WB_MANIFEST);

// ⚠️ Gerçek, canlı Playwright testinde bulunan gerçek boşluk: precacheAndRoute
// TEK BAŞINA yalnızca birebir önbelleğe alınmış URL'leri (örn. tam olarak
// "/index.html") eşler — React Router'ın istemci-taraflı ürettiği derin
// linkler (örn. "/gorevler/:id/fotograf") birebir önbellekte YOK. Bu route
// olmadan, offline'ken doğrudan derin bir linke navigasyon (örn. sekmeyi
// kapatıp yeniden açmak, F5) tarayıcının kendi "İnternet yok" hata sayfasını
// gösterir — uygulama hiç yüklenmez, IndexedDB'deki kuyruk erişilemez
// görünür (kaybolmamıştır, sadece UI'ye ulaşılamaz). NavigationRoute, TÜM
// navigasyon isteklerini önbellekteki index.html'e yönlendirir — SPA'lar
// için standart offline-fallback deseni.
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html")));

// spec §12.2: görev listesi/detayı offline görüntülenebilmeli. NetworkFirst —
// online iken her zaman taze veri, offline'a düşünce son bilinen cevap.
registerRoute(
  ({ url }) => /\/api\/v1\/(partners\/.+\/tasks|orders\/[^/]+)$/.test(url.pathname),
  new NetworkFirst({ cacheName: "gk-task-data", networkTimeoutSeconds: 5 }),
);

// spec §12.2: "Fotoğraflar önce cihazda saklanır, ağ bağlantısı geldiğinde
// arka planda yüklenir (Background Sync API)". Sekme kapalıyken de tetiklenir
// — bu yüzden kuyruk (idb tabanlı) ve senkronizasyon mantığı sayfa React
// state'inden tamamen bağımsız, src/lib/queue.ts'te yaşıyor.
self.addEventListener("sync", (event) => {
  const syncEvent = event as SyncEvent;
  if (syncEvent.tag === SYNC_TAG) {
    syncEvent.waitUntil(flushQueue());
  }
});

self.addEventListener("activate", () => {
  void self.clients.claim();
});
