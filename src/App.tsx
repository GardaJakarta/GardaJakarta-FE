import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "./context/useAuth";
import LoginPage from "./pages/LoginPage";
import MapPage from "./pages/MapPage";
import RegisterPage from "./pages/RegisterPage";
import ConnectionErrorPage from "./pages/ConnectionErrorPage";
import NotFoundPage from "./pages/NotFoundPage";
import ReportPage from "./pages/ReportPage";
import type { AuthPortal } from "./types";
import { portalPaths } from "./lib/portals";

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
  return <main className="session-state" role="status">Membuka Garda Jakarta...</main>;
}

export default function App() {
  const { user, isReady, sessionError } = useAuth();
  const location = useLocation();
  if (location.pathname === "/") return <LandingRedirect />;
  if (!isReady) return <main className="session-state" role="status">Memeriksa sesi...</main>;
  const knownPaths = ["/login", "/polisi/login", "/admin/login", "/register", "/map", "/report", "/polisi", "/admin", "/not-found"];
  if (!knownPaths.includes(location.pathname)) return <Navigate to="/not-found" replace />;
  const home = user ? portalPaths[user.role].home : "/login";

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={home} replace /> : <LoginPage key="warga" />} />
      <Route path="/polisi/login" element={user ? <Navigate to={home} replace /> : <LoginPage key="polisi" portal="polisi" />} />
      <Route path="/admin/login" element={user ? <Navigate to={home} replace /> : <LoginPage key="admin" portal="admin" />} />
      <Route path="/register" element={user ? <Navigate to={home} replace /> : <RegisterPage />} />
      <Route path="/map" element={<ProtectedRoute portal="warga"><MapPage /></ProtectedRoute>} />
      <Route path="/report" element={<ProtectedRoute portal="warga"><ReportPage /></ProtectedRoute>} />
      <Route path="/polisi" element={<ProtectedRoute portal="polisi"><MapPage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute portal="admin"><MapPage /></ProtectedRoute>} />
      <Route path="/not-found" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/not-found" replace />} />
    </Routes>
  );
}
