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
      <header className="dashboard-header dashboard-workspace-header"><Link className="map-brand" to="https://gardajakarta.my.id" aria-label="Beranda Garda Jakarta"><AppLogo size={155} aria-label="Garda Jakarta" /></Link><div className="public-map-actions"><Link className="primary-button" to="/login">Masuk untuk melapor</Link></div></header>
      <div className="dashboard-workspace public-map-workspace">
        <section className="dashboard-map-stage" aria-label="Peta publik keamanan Jakarta">{error && <p className="dashboard-error dashboard-error-floating" role="alert">{error}</p>}<GardaMap className="dashboard-full-map" units={units} reports={visibleReports} onSelectReport={setSelected} /><div className="dashboard-map-key" aria-label="Keterangan peta"><span><i className="legend-dot legend-report" />Laporan</span><span><i className="legend-dot legend-police" />Kantor polisi</span><span><i className="legend-dot legend-safety" />Area perhatian</span></div></section>
        <aside className="dashboard-side-panel dashboard-side-panel-public"><div className="dashboard-side-scroll">
          <section className="dashboard-panel-section"><div className="dashboard-panel-title"><div><span className="dashboard-kicker">{isLoading ? "Memuat" : `${visibleReports.length} laporan`}</span><h2>Laporan sekitar</h2></div></div>{visibleReports.length === 0 ? <p className="dashboard-empty">Belum ada laporan.</p> : <div className="dashboard-queue-list">{visibleReports.slice(0, 12).map((report) => <button className="public-report-item" type="button" key={report.id} onClick={() => setSelected(report)}><span><strong>{report.category}</strong><small>{report.ticketNumber} · {report.policeUnit?.district || "Jakarta"}</small></span><PublicStatus status={report.status} /></button>)}</div>}</section>
          {selected && <section className="dashboard-panel-section public-selected-report" aria-live="polite"><div className="dashboard-panel-title"><div><span className="dashboard-kicker">Detail terpilih</span><h2>{selected.category}</h2></div><button type="button" className="public-close-button" onClick={() => setSelected(null)} aria-label="Tutup detail">×</button></div><p>{selected.ticketNumber} · {selected.policeUnit?.district || "Jakarta"}</p><PublicStatus status={selected.status} />{selected.description && <p className="public-report-description">{selected.description}</p>}</section>}
          <section className="dashboard-panel-section public-police-list"><div className="dashboard-panel-title"><div><span className="dashboard-kicker">Lokasi layanan</span><h2>Kantor polisi</h2></div></div>{units.length === 0 ? <p className="dashboard-empty">Data kantor belum tersedia.</p> : <div className="dashboard-report-list">{units.slice(0, 10).map((unit) => <article key={unit.id}><div><strong>{unit.name}</strong><span>{unit.district}</span></div><small>{unit.phone || "Layanan publik"}</small></article>)}</div>}</section>
          <section className="dashboard-panel-section public-login-cta"><p>Ingin melaporkan kejadian?</p><Link className="primary-button" to="/login">Masuk untuk melapor</Link></section>
        </div></aside>
      </div>
    </main>
  );
}
