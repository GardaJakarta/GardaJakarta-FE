import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppLogo from "../components/branding/AppLogo";
import GardaMap from "../components/GardaMap";
import { getPublicMap } from "../lib/api";
import type { IncidentReport, PoliceUnit } from "../types";

function PublicStatus({ status }: { status: IncidentReport["status"] }) {
  const labels: Record<IncidentReport["status"], string> = { PENDING: "Menunggu", VERIFIED: "Terverifikasi", IN_PROGRESS: "Diproses", RESOLVED: "Selesai", REJECTED: "Ditolak" };
  return <span className={`status-badge status-${status.toLowerCase()}`}>{labels[status]}</span>;
}

export default function PublicMapPage() {
  const [units, setUnits] = useState<PoliceUnit[]>([]);
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [selected, setSelected] = useState<IncidentReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setIsLoading(true);
    try { const data = await getPublicMap(); setUnits(data.units); setReports(data.reports); setError(null); }
    catch { setError("Peta belum dapat dimuat. Periksa koneksi lalu coba lagi."); }
    finally { setIsLoading(false); }
  }, []);
  // Public data is synchronized with the public API.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  const visibleReports = useMemo(() => reports.filter((report) => report.status !== "REJECTED"), [reports]);
  return (
    <main className="dashboard-page dashboard-workspace-page">
      <header className="dashboard-header dashboard-workspace-header"><Link className="map-brand" to="https://gardajakarta.my.id" aria-label="Beranda Garda Jakarta"><AppLogo size={155} aria-label="Garda Jakarta" /></Link><div className="public-map-actions"><span>Mode lihat saja</span><Link className="primary-button" to="/login">Masuk untuk melapor</Link></div></header>
      <div className="dashboard-workspace public-map-workspace">
        <section className="dashboard-map-stage" aria-label="Peta publik keamanan Jakarta"><div className="dashboard-map-toolbar"><div><span className="dashboard-kicker">Peta publik</span><h1>Pantau situasi Jakarta.</h1><p>Lihat laporan yang sudah dipublikasikan dan lokasi kantor polisi di sekitar Jakarta.</p></div><Link className="dashboard-public-link" to="/login">Buat laporan</Link></div>{error && <p className="dashboard-error dashboard-error-floating" role="alert">{error}</p>}<GardaMap className="dashboard-full-map" units={units} reports={visibleReports} onSelectReport={setSelected} /><div className="dashboard-map-key" aria-label="Keterangan peta"><span><i className="legend-dot legend-report" />Laporan</span><span><i className="legend-dot legend-police" />Kantor polisi</span></div></section>
        <aside className="dashboard-side-panel dashboard-side-panel-public"><div className="dashboard-side-scroll">
          <section className="dashboard-summary-block"><div className="dashboard-panel-title"><div><span className="dashboard-kicker">Informasi publik</span><h2>Jakarta hari ini</h2></div><span className="dashboard-live-dot">Live</span></div><div className="dashboard-stats dashboard-stats-compact" aria-label="Ringkasan peta publik"><div className="dashboard-stat"><span>Laporan</span><strong>{isLoading ? "—" : visibleReports.length}</strong></div><div className="dashboard-stat"><span>Kantor polisi</span><strong>{isLoading ? "—" : units.length}</strong></div></div></section>
          <section className="dashboard-panel-section"><div className="dashboard-panel-title"><div><span className="dashboard-kicker">Laporan terbaru</span><h2>Situasi sekitar</h2></div><span className="dashboard-queue-count">{visibleReports.length}</span></div>{visibleReports.length === 0 ? <p className="dashboard-empty">Belum ada laporan publik.</p> : <div className="dashboard-queue-list">{visibleReports.slice(0, 12).map((report) => <button className="public-report-item" type="button" key={report.id} onClick={() => setSelected(report)}><span><strong>{report.category}</strong><small>{report.ticketNumber} · {report.policeUnit?.district || "Jakarta"}</small></span><PublicStatus status={report.status} /></button>)}</div>}</section>
          {selected && <section className="dashboard-panel-section public-selected-report" aria-live="polite"><div className="dashboard-panel-title"><div><span className="dashboard-kicker">Detail terpilih</span><h2>{selected.category}</h2></div><button type="button" className="public-close-button" onClick={() => setSelected(null)} aria-label="Tutup detail">×</button></div><p>{selected.ticketNumber} · {selected.policeUnit?.district || "Jakarta"}</p><PublicStatus status={selected.status} /></section>}
          <section className="dashboard-panel-section public-police-list"><div className="dashboard-panel-title"><div><span className="dashboard-kicker">Lokasi layanan</span><h2>Kantor polisi</h2></div></div>{units.length === 0 ? <p className="dashboard-empty">Data kantor belum tersedia.</p> : <div className="dashboard-report-list">{units.slice(0, 10).map((unit) => <article key={unit.id}><div><strong>{unit.name}</strong><span>{unit.district}</span></div><small>{unit.phone || "Layanan publik"}</small></article>)}</div>}</section>
          <section className="dashboard-panel-section public-login-cta"><p>Temukan kejadian di sekitar Anda?</p><Link className="primary-button" to="/login">Masuk untuk membuat laporan</Link></section>
        </div></aside>
      </div>
    </main>
  );
}
