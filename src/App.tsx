import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "./context/useAuth";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ConnectionErrorPage from "./pages/ConnectionErrorPage";
import NotFoundPage from "./pages/NotFoundPage";
import DashboardPage from "./pages/DashboardPage";
import PublicMapPage from "./pages/PublicMapPage";
import type { AuthPortal } from "./types";
import { portalPaths } from "./lib/portals";
import AppLogo from "./components/branding/AppLogo";

function GardaLoading({ label = "Memeriksa keamanan Jakarta..." }: { label?: string }) {
  return <main className="garda-loading" role="status" aria-live="polite"><AppLogo size={150} aria-label="Garda Jakarta" /><span className="garda-loading-mark" aria-hidden="true" /><p>{label}</p></main>;
}

function ProtectedRoute({ children, portal }: { children: ReactNode; portal: AuthPortal }) {
  const { user, sessionError } = useAuth();
  if (sessionError) return <ConnectionErrorPage message={sessionError} />;
  if (!user) return <Navigate to={portalPaths[portal].login} replace />;
  return user.role === portal ? children : <Navigate to={portalPaths[user.role].home} replace />;
}

function LandingRedirect() {
  useEffect(() => {
    window.location.replace("https://gardajakarta.my.id");
  }, []);
  return <GardaLoading label="Membuka Garda Jakarta..." />;
}

export default function App() {
  const { user, isReady } = useAuth();
  const location = useLocation();
  if (location.pathname === "/") return <LandingRedirect />;
  if (!isReady && location.pathname !== "/map") return <GardaLoading label="Memeriksa sesi..." />;
  const knownPaths = ["/login", "/polisi/login", "/admin/login", "/register", "/dashboard", "/map", "/polisi", "/admin", "/not-found"];
  if (!knownPaths.includes(location.pathname)) return <Navigate to="/not-found" replace />;
  const home = user ? portalPaths[user.role].home : "/login";

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={home} replace /> : <LoginPage key="warga" />} />
      <Route path="/polisi/login" element={user ? <Navigate to={home} replace /> : <LoginPage key="polisi" portal="polisi" />} />
      <Route path="/admin/login" element={user ? <Navigate to={home} replace /> : <LoginPage key="admin" portal="admin" />} />
      <Route path="/register" element={user ? <Navigate to={home} replace /> : <RegisterPage />} />
      <Route path="/dashboard" element={<ProtectedRoute portal={user?.role || "warga"}><DashboardPage /></ProtectedRoute>} />
      <Route path="/map" element={<PublicMapPage />} />
      <Route path="/polisi" element={<Navigate to="/dashboard" replace />} />
      <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
      <Route path="/not-found" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/not-found" replace />} />
    </Routes>
  );
}
