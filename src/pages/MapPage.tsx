import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { useState } from "react";
import { portalPaths } from "../lib/portals";
import AppLogo from "../components/branding/AppLogo";
import { linkGoogle } from "../lib/api";

export default function MapPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const role = user?.role || "warga";
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const content = { warga: ["Peta keamanan publik", "Lihat informasi laporan dan kantor polisi di Jakarta."], polisi: ["Dashboard petugas", "Kelola laporan yang masuk ke unit Anda."], admin: ["Dashboard admin", "Pantau laporan dan aktivitas operasional Garda Jakarta."] } as const;
  const handleLogout = async () => {
    setSigningOut(true);
    setError(null);
    try { await signOut(); navigate(portalPaths[role].login, { replace: true }); }
    catch { setError("Gagal keluar. Periksa koneksi dan coba lagi."); }
    finally { setSigningOut(false); }
  };
  const handleLinkGoogle = async () => {
    setError(null);
    setLinkingGoogle(true);
    try { await linkGoogle(); }
    catch { setError("Google belum berhasil ditautkan. Pastikan memakai email yang sama."); }
    finally { setLinkingGoogle(false); }
  };
  return (
    <main className="map-page">
      <header className="map-header">
        <Link className="map-brand" to="/dashboard" aria-label="Beranda Garda Jakarta"><AppLogo size={155} aria-label="Garda Jakarta" /></Link>
        <div className="map-user"><span>Halo, {user?.name}</span><button type="button" disabled={signingOut} onClick={() => void handleLogout()}>{signingOut ? "Memproses..." : "Keluar"}</button></div>
      </header>
      <section className="map-placeholder">
        <div className="map-grid" aria-hidden="true" />
        <div className="map-content">
          <p className="eyebrow">Portal {portalPaths[role].label}</p>
          <h1>{content[role][0]}</h1>
          <p>{content[role][1]}</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          {role === "warga" ? <Link className="primary-button map-button" to="/dashboard">Buat laporan</Link> : <Link className="primary-button map-button" to="/dashboard">Buka dashboard</Link>}
          <button className="google-button account-google-button" type="button" disabled={linkingGoogle} onClick={() => void handleLinkGoogle()}>{linkingGoogle ? "Memproses..." : "Tautkan akun Google"}</button>
        </div>
        <div className="map-pin map-pin-one" /><div className="map-pin map-pin-two" /><div className="map-pin map-pin-three" />
      </section>
    </main>
  );
}
