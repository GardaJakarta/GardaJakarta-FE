import { Link } from "react-router-dom";
import AppLogoWhite from "../components/branding/AppLogoWhite";
import Icon from "../components/Icon";

export default function NotFoundPage() {
  return (
    <main className="status-page status-page-not-found">
      <section className="status-layout status-layout-dark">
        <Link className="status-logo" to="/login" aria-label="Garda Jakarta">
          <AppLogoWhite size={174} aria-label="Garda Jakarta" />
        </Link>
        <div className="not-found-number" aria-hidden="true">404</div>
        <div className="status-rule" aria-hidden="true" />
        <p className="eyebrow">Halaman tidak ditemukan</p>
        <h1>Rute ini belum ada di <span>peta.</span></h1>
        <p className="status-copy">Alamat yang Anda buka mungkin sudah dipindahkan atau tidak pernah tersedia.</p>
        <div className="status-actions">
          <Link className="primary-button status-button" to="/login"><Icon name="compass" size={18} /> Buka portal</Link>
          <Link className="status-link status-link-light" to="/"><Icon name="arrow-left" size={17} /> Kembali ke landing</Link>
        </div>
      </section>
    </main>
  );
}
