import { Link } from "react-router-dom";
import AppLogo from "../components/branding/AppLogo";
import Icon from "../components/Icon";

export default function ConnectionErrorPage({ message }: { message: string }) {
  return (
    <main className="status-page status-page-error">
      <section className="status-layout" role="alert">
        <Link className="status-logo" to="/login" aria-label="Kembali ke Garda Jakarta">
          <AppLogo size={174} aria-label="Garda Jakarta" />
        </Link>
        <div className="status-rule" aria-hidden="true" />
        <div className="status-heading-row">
          <p className="status-code">OFFLINE</p>
          <div>
            <p className="eyebrow">Sinyal terputus</p>
            <h1>Koneksi belum <span>tersedia.</span></h1>
          </div>
        </div>
        <p className="status-copy">{message} Pastikan internet Anda aktif, lalu coba sambungkan kembali.</p>
        <div className="status-actions">
          <button className="primary-button status-button" type="button" onClick={() => window.location.reload()}>
            <Icon name="refresh" size={18} /> Coba lagi
          </button>
          <Link className="status-link" to="/login"><Icon name="arrow-left" size={17} /> Kembali ke login</Link>
        </div>
      </section>
    </main>
  );
}
