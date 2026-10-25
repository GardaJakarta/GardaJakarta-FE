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
  const content = {
    warga: ["Peta keamanan sedang disiapkan.", "Akun warga Anda sudah aktif. Peta, filter lokasi, dan pelaporan akan hadir pada tahap berikutnya."],
    polisi: ["Ruang kerja petugas sedang disiapkan.", "Akses petugas Anda sudah terverifikasi. Antrian laporan, penugasan unit, dan catatan penanganan akan hadir pada tahap berikutnya."],
    admin: ["Ruang pengelolaan sedang disiapkan.", "Akses admin Anda sudah terverifikasi. Moderasi laporan, pengelolaan unit, dan audit log akan hadir pada tahap berikutnya."],
  } as const;
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
        <Link className="map-brand" to={portalPaths[role].home} aria-label="Beranda Garda Jakarta"><AppLogo size={155} aria-label="Garda Jakarta" /></Link>
        <div className="map-user"><span>Halo, {user?.name}</span><button type="button" disabled={signingOut} onClick={() => void handleLogout()}>{signingOut ? "Memproses..." : "Keluar"}</button></div>
      </header>
      <section className="map-placeholder">
        <div className="map-grid" aria-hidden="true" />
        <div className="map-content">
          <p className="eyebrow">Portal {portalPaths[role].label}</p>
          <h1>{content[role][0]}</h1>
          <p>{content[role][1]}</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          {role === "warga" ? <Link className="primary-button map-button" to="/report">Buat laporan</Link> : <a className="primary-button map-button" href="https://gardajakarta.my.id">Tentang Garda Jakarta</a>}
          <button className="google-button account-google-button" type="button" disabled={linkingGoogle} onClick={() => void handleLinkGoogle()}>{linkingGoogle ? "Memproses..." : "Tautkan akun Google"}</button>
        </div>
        <div className="map-pin map-pin-one" /><div className="map-pin map-pin-two" /><div className="map-pin map-pin-three" />
      </section>
    </main>
  );
}
