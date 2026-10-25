import { Link } from "react-router-dom";
import AppLogo from "../components/branding/AppLogo";
import { useAuth } from "../context/useAuth";
import Icon from "../components/Icon";

export default function ReportPage() {
  const { user } = useAuth();
  return (
    <main className="report-page">
      <header className="map-header">
        <Link className="map-brand" to="/map" aria-label="Kembali ke peta Garda Jakarta"><AppLogo size={155} aria-label="Garda Jakarta" /></Link>
        <Link className="report-account" to="/map" aria-label="Kembali ke akun"><span>{user?.name?.slice(0, 1).toUpperCase()}</span><strong>{user?.name}</strong></Link>
      </header>
      <section className="report-shell">
        <Link className="back-link" to="/map"><Icon name="arrow-left" size={16} /> Kembali ke peta</Link>
        <div className="report-card">
          <div className="report-card-icon"><Icon name="pin" size={25} /></div>
          <p className="eyebrow">Laporan warga</p>
          <h1>Bantu jaga Jakarta tetap aman.</h1>
          <p>Form laporan akan segera hadir. Untuk saat ini, simpan lokasi kejadian dan siapkan kronologi singkat agar laporan Anda bisa diproses dengan cepat.</p>
          <button className="primary-button report-button" type="button" disabled><Icon name="send" size={18} /> Form laporan segera hadir</button>
          <p className="report-note">Anda masuk sebagai warga. Laporan yang dikirim akan masuk ke portal petugas dan admin untuk ditindaklanjuti.</p>
        </div>
      </section>
    </main>
  );
}
