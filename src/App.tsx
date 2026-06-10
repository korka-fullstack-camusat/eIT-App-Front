import { Routes, Route, Navigate } from "react-router-dom";
import LandingPage    from "@/pages/LandingPage";
import LoginPage      from "@/pages/LoginPage";
import DashboardPage  from "@/pages/DashboardPage";
import ParcInformatiquePage from "@/pages/parc/ParcInformatiquePage";
import SimsPage       from "@/pages/telephonie/SimsPage";
import SitesPage      from "@/pages/telephonie/SitesPage";
import VehiculesPage  from "@/pages/telephonie/VehiculesPage";
import FacturesPage   from "@/pages/telephonie/FacturesPage";
import FactureDetailPage from "@/pages/telephonie/FactureDetailPage";
import UsersPage      from "@/pages/UsersPage";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      {/* Pages publiques */}
      <Route path="/"      element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Pages protégées */}
      <Route path="/dashboard"   element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/parc"         element={<ProtectedRoute><ParcInformatiquePage /></ProtectedRoute>} />
      <Route path="/materiels"   element={<Navigate to="/parc" replace />} />
      <Route path="/attributions" element={<Navigate to="/parc" replace />} />
      <Route path="/sims"        element={<ProtectedRoute><SimsPage /></ProtectedRoute>} />
      <Route path="/sites"       element={<ProtectedRoute><SitesPage /></ProtectedRoute>} />
      <Route path="/vehicules"   element={<ProtectedRoute><VehiculesPage /></ProtectedRoute>} />
      <Route path="/factures"    element={<ProtectedRoute><FacturesPage /></ProtectedRoute>} />
      <Route path="/factures/:id" element={<ProtectedRoute><FactureDetailPage /></ProtectedRoute>} />
      <Route path="/users"       element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />

      {/* Redirection fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
