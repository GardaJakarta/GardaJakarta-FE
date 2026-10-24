import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./context/useAuth";
import LoginPage from "./pages/LoginPage";
import MapPage from "./pages/MapPage";
import RegisterPage from "./pages/RegisterPage";
import type { AuthPortal } from "./types";
import { portalPaths } from "./lib/portals";

function ProtectedRoute({ children, portal }: { children: ReactNode; portal: AuthPortal }) {
  const { user } = useAuth();
  if (!user) return <Navigate to={portalPaths[portal].login} replace />;
  return user.role === portal ? children : <Navigate to={portalPaths[user.role].home} replace />;
}

export default function App() {
  const { user, isReady, sessionError } = useAuth();
  if (!isReady) return <main className="session-state" role="status">Memeriksa sesi...</main>;
  if (sessionError) return <main className="session-state"><h1>Koneksi belum tersedia</h1><p role="alert">{sessionError}</p><button className="primary-button" onClick={() => window.location.reload()}>Coba lagi</button></main>;
  const home = user ? portalPaths[user.role].home : "/login";

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={home} replace /> : <LoginPage key="warga" />} />
      <Route path="/polisi/login" element={user ? <Navigate to={home} replace /> : <LoginPage key="polisi" portal="polisi" />} />
      <Route path="/admin/login" element={user ? <Navigate to={home} replace /> : <LoginPage key="admin" portal="admin" />} />
      <Route path="/register" element={user ? <Navigate to={home} replace /> : <RegisterPage />} />
      <Route path="/map" element={<ProtectedRoute portal="warga"><MapPage /></ProtectedRoute>} />
      <Route path="/polisi" element={<ProtectedRoute portal="polisi"><MapPage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute portal="admin"><MapPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  );
}
