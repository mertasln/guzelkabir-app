import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";
import { PartnersPage } from "@/pages/PartnersPage";
import { OrdersPage } from "@/pages/OrdersPage";
import { OrderDetailPage } from "@/pages/OrderDetailPage";
import { AssignmentPage } from "@/pages/AssignmentPage";
import { ComplaintsPage } from "@/pages/ComplaintsPage";
import { UsersPage } from "@/pages/UsersPage";

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
          <Route path="partnerler" element={<PartnersPage />} />
          <Route path="siparisler" element={<OrdersPage />} />
          <Route path="siparisler/:id" element={<OrderDetailPage />} />
          <Route path="atama" element={<AssignmentPage />} />
          <Route path="sikayetler" element={<ComplaintsPage />} />
          <Route path="kullanicilar" element={<UsersPage />} />
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
