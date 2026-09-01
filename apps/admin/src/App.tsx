import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";

// spec §11.1'in 7 modülü. Sıra (bkz. CLAUDE.md "Admin Panel" bölümü, faz
// planı): Phase 4 Partner Yönetimi, Phase 5 Sipariş/Atama, Phase 6 Şikayet,
// Phase 7 Kullanıcı/Rol, Phase 8 Mezarlık/İzin, Phase 9 KPI Dashboard.
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/giris" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="partnerler" element={<PlaceholderPage title="Partner Yönetimi" />} />
          <Route path="siparisler" element={<PlaceholderPage title="Sipariş Yönetimi" />} />
          <Route path="sikayetler" element={<PlaceholderPage title="Şikayet Yönetimi" />} />
          <Route
            path="kullanicilar"
            element={<PlaceholderPage title="Kullanıcı & Rol Yönetimi" />}
          />
          <Route
            path="mezarliklar"
            element={<PlaceholderPage title="Mezarlık & İzin Yönetimi" />}
          />
          <Route path="kpi" element={<PlaceholderPage title="KPI Dashboard" />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
