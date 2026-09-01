import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LoginPage } from "@/pages/LoginPage";
import { TaskListPage } from "@/pages/TaskListPage";
import { TaskDetailPage } from "@/pages/TaskDetailPage";
import { CapturePage } from "@/pages/CapturePage";
import { CompletePage } from "@/pages/CompletePage";

// spec §12.1: Giriş (25) → Görev Listesi (26) → Görev Detayı (27) →
// Fotoğraf Çekim (28) → Rapor & Tamamlama (29). Offline-first (spec §12.2)
// bu ADIM'da bilinçli olarak yok — kullanıcı onaylı ADIM 8b, bkz. CLAUDE.md.
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/giris" element={<LoginPage />} />
        <Route
          path="/gorevler"
          element={
            <ProtectedRoute>
              <TaskListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gorevler/:id"
          element={
            <ProtectedRoute>
              <TaskDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gorevler/:id/fotograf"
          element={
            <ProtectedRoute>
              <CapturePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gorevler/:id/tamamla"
          element={
            <ProtectedRoute>
              <CompletePage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/gorevler" replace />} />
      </Routes>
    </AuthProvider>
  );
}
