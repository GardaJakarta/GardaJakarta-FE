import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./context/useAuth";
import LoginPage from "./pages/LoginPage";
import MapPage from "./pages/MapPage";
import RegisterPage from "./pages/RegisterPage";
import type { AuthPortal } from "./types";

function ProtectedRoute({ children, portal }: { children: ReactNode; portal: AuthPortal }) {
  const { user } = useAuth();
  if (!user) return <Navigate to={portal === "polisi" ? "/polisi/login" : portal === "admin" ? "/admin/login" : "/login"} replace />;
  return user.role === portal ? children : <Navigate to={user.role === "polisi" ? "/polisi" : user.role === "admin" ? "/admin" : "/map"} replace />;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/map" replace /> : <LoginPage />} />
      <Route path="/polisi/login" element={user ? <Navigate to="/polisi" replace /> : <LoginPage portal="polisi" />} />
      <Route path="/admin/login" element={user ? <Navigate to="/admin" replace /> : <LoginPage portal="admin" />} />
      <Route path="/register" element={user ? <Navigate to="/map" replace /> : <RegisterPage />} />
      <Route path="/map" element={<ProtectedRoute portal="warga"><MapPage /></ProtectedRoute>} />
      <Route path="/polisi" element={<ProtectedRoute portal="polisi"><MapPage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute portal="admin"><MapPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={user ? "/map" : "/login"} replace />} />
    </Routes>
  );
}
