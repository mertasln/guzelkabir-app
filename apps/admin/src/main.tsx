import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App.tsx";
import { ConfirmDialogProvider } from "./components/ConfirmDialogProvider";

// spec §11.2: "Gerçek zamanlı güncellemeler için WebSocket (Socket.io) veya
// polling (30 sn)" — kullanıcı kararı: 30sn polling ile başla (pilot
// ölçeğinde yeterli, WebSocket'in bağlantı/reconnect/auth karmaşıklığı
// gerekmiyor). TEK bir yerde: ileride Socket.io'ya geçiş gerekirse her
// ekranı değil, yalnızca burayı değiştirmek yeterli.
const ADMIN_REFETCH_INTERVAL_MS = 30_000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: ADMIN_REFETCH_INTERVAL_MS,
      refetchOnWindowFocus: true,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfirmDialogProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ConfirmDialogProvider>
    </QueryClientProvider>
  </StrictMode>,
);
