import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App.tsx";
import { resetInterruptedSyncs, flushQueue, startPeriodicSync } from "./lib/queue";

// spec §12.2. Sıra önemli: önce yarıda kalmış 'syncing' kayıtları 'pending'e
// geri al (bkz. queue.ts yorumu — sekme kapanmış olabilir), SONRA kuyruğu
// akıtmaya çalış — aksi halde taze bir flushQueue() 'syncing' kayıtları
// (henüz resetlenmemiş) atlayıp bir daha asla denemez.
void (async () => {
  await resetInterruptedSyncs();
  void flushQueue();
})();

if ("serviceWorker" in navigator) {
  registerSW({ immediate: true });
}

// Background Sync API'nin desteklenmediği tarayıcılarda (örn. Safari) bir
// güvenlik ağı — bağlantı geri geldiğinde kuyruğu manuel akıt. TEK başına
// yeterli değil (bkz. queue.ts'teki startPeriodicSync yorumu — canlı testte
// 'online' event'inin hiç ateşlenmediği gerçek bir senaryo bulundu), bu
// yüzden periyodik yoklama ikinci, event'ten bağımsız bir güvenlik ağı.
window.addEventListener("online", () => void flushQueue());
startPeriodicSync();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
