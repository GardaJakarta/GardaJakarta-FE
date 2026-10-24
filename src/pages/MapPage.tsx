import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

export default function MapPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const portalLabel = user?.role === "polisi" ? "Portal petugas polisi" : user?.role === "admin" ? "Portal admin" : "Portal warga";
  return (
    <main className="map-page">
      <header className="map-header">
        <Link className="map-brand" to="/map"><span>G</span> Garda Jakarta</Link>
        <div className="map-user"><span>Halo, {user?.name}</span><button type="button" onClick={() => { signOut(); navigate("/login"); }}>Keluar</button></div>
      </header>
      <section className="map-placeholder">
        <div className="map-grid" aria-hidden="true" />
        <div className="map-content">
          <p className="eyebrow">{portalLabel}</p>
          <h1>Ruang peta Garda Jakarta sedang disiapkan.</h1>
          <p>Fondasi autentikasi sudah siap. Layer kejadian, filter lokasi, dan pelaporan akan masuk di tahap berikutnya.</p>
          <button className="primary-button map-button" type="button">Jelajahi area Jakarta</button>
        </div>
        <div className="map-pin map-pin-one" /><div className="map-pin map-pin-two" /><div className="map-pin map-pin-three" />
      </section>
    </main>
  );
}
