import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import GardaMap from "../components/GardaMap";
import AppLogo from "../components/branding/AppLogo";
import { useAuth } from "../context/useAuth";
import { createReport, getDashboard, updatePoliceReportStatus } from "../lib/api";
import type { DashboardData, ReportSeverity, ReportStatus } from "../types";

const statusLabels: Record<ReportStatus, string> = { PENDING: "Menunggu", VERIFIED: "Terverifikasi", IN_PROGRESS: "Diproses", RESOLVED: "Selesai", REJECTED: "Ditolak" };
const severityLabels: Record<ReportSeverity, string> = { P0: "Kritis", P1: "Tinggi", P2: "Sedang", P3: "Rendah" };
const EMPTY_REPORTS: DashboardData["reports"] = [];

function Avatar({ name, image }: { name: string; image?: string | null }) {
  return image ? <img className="dashboard-avatar" src={image} alt={`Foto profil ${name}`} referrerPolicy="no-referrer" /> : <span className="dashboard-avatar dashboard-avatar-fallback">{name.slice(0, 1).toUpperCase()}</span>;
}

function StatusBadge({ status }: { status: ReportStatus }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}>{statusLabels[status]}</span>;
}

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [form, setForm] = useState({ category: "", description: "", severity: "P2" as ReportSeverity, latitude: -6.1754, longitude: 106.8272 });

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    try { setData(await getDashboard()); setError(null); }
    catch { setError("Dashboard belum dapat dimuat. Periksa koneksi lalu coba lagi."); }
    finally { setIsLoading(false); }
  }, []);

  // Dashboard data is synchronized with the authenticated API session.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const submitReport = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const position = await new Promise<GeolocationPosition | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 3000 });
      });
      const location = position ? { latitude: position.coords.latitude, longitude: position.coords.longitude } : { latitude: form.latitude, longitude: form.longitude };
      await createReport({ ...form, ...location });
      setForm((current) => ({ ...current, category: "", description: "" }));
      await loadDashboard();
    } catch { setError("Laporan belum dapat dikirim. Coba lagi beberapa saat."); }
    finally { setIsSubmitting(false); }
  };

  const updateStatus = async (id: string, status: Exclude<ReportStatus, "PENDING">) => {
    setActiveReportId(id);
    setError(null);
    try { await updatePoliceReportStatus(id, status); await loadDashboard(); }
    catch { setError("Status laporan belum dapat diperbarui."); }
    finally { setActiveReportId(null); }
  };

  const reports = data?.reports ?? EMPTY_REPORTS;
  const stats = data?.stats || { total: 0, pending: 0, inProgress: 0, resolved: 0 };
  const mapReports = useMemo(() => reports.filter((report) => report.status !== "REJECTED"), [reports]);
  const handleMapClick = useCallback((coordinates: { latitude: number; longitude: number }) => setForm((current) => ({ ...current, ...coordinates })), []);
  const roleLabel = user?.role === "warga" ? "Warga" : user?.role === "polisi" ? "Petugas polisi" : "Admin operasional";
  const title = user?.role === "warga" ? "Lapor dan pantau Jakarta" : user?.role === "polisi" ? "Tugas unit Anda" : "Pusat monitoring";
  const description = user?.role === "warga" ? "Pilih titik di peta untuk membuat laporan. Informasi laporan Anda akan diteruskan ke unit terdekat." : user?.role === "polisi" ? "Pantau laporan yang masuk ke wilayah unit Anda dari peta dan antrian kerja." : "Pantau sebaran laporan dan status penanganan seluruh wilayah Jakarta.";

  return (
    <main className="dashboard-page dashboard-workspace-page">
      <header className="dashboard-header dashboard-workspace-header">
        <Link className="map-brand" to="/dashboard" aria-label="Dashboard Garda Jakarta"><AppLogo size={155} aria-label="Garda Jakarta" /></Link>
        <div className="dashboard-account"><div className="dashboard-account-copy"><span>{user?.name}</span><small>{roleLabel}</small></div><Avatar name={user?.name || "Garda"} image={user?.image} /><button type="button" onClick={() => void signOut()}>Keluar</button></div>
      </header>

      <div className="dashboard-workspace">
        <section className="dashboard-map-stage" aria-label="Peta keamanan Jakarta">
          <div className="dashboard-map-toolbar"><div><span className="dashboard-kicker">{roleLabel}</span><h1>{title}</h1><p>{description}</p></div><Link className="dashboard-public-link" to="/map">Lihat peta publik</Link></div>
          {error && <p className="dashboard-error dashboard-error-floating" role="alert">{error}</p>}
          <GardaMap className="dashboard-full-map" units={data?.units || []} reports={mapReports} onMapClick={user?.role === "warga" ? handleMapClick : undefined} />
          <div className="dashboard-map-key" aria-label="Keterangan peta"><span><i className="legend-dot legend-report" />Laporan</span><span><i className="legend-dot legend-police" />Kantor polisi</span><span><i className="legend-dot legend-safety" />Area perhatian</span></div>
        </section>

        <aside className={`dashboard-side-panel dashboard-side-panel-${user?.role || "warga"}`}>
          <div className="dashboard-side-scroll">
            <section className="dashboard-summary-block"><div className="dashboard-panel-title"><div><span className="dashboard-kicker">Ringkasan</span><h2>Aktivitas hari ini</h2></div><span className="dashboard-live-dot">Live</span></div><div className="dashboard-stats dashboard-stats-compact" aria-label="Ringkasan laporan"><div className="dashboard-stat"><span>Total</span><strong>{isLoading ? "—" : stats.total}</strong></div><div className="dashboard-stat"><span>Menunggu</span><strong>{isLoading ? "—" : stats.pending}</strong></div><div className="dashboard-stat"><span>Diproses</span><strong>{isLoading ? "—" : stats.inProgress}</strong></div><div className="dashboard-stat"><span>Selesai</span><strong>{isLoading ? "—" : stats.resolved}</strong></div></div></section>

            {user?.role === "warga" ? <>
              <section className="dashboard-panel-section"><div className="dashboard-panel-title"><div><span className="dashboard-kicker">Laporan baru</span><h2>Laporkan kejadian</h2></div></div><form className="report-form-card report-form-workspace" onSubmit={(event) => void submitReport(event)}><label>Kategori<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required><option value="">Pilih kategori</option><option>Gangguan keamanan</option><option>Penerangan jalan</option><option>Fasilitas umum</option><option>Lalu lintas</option></select></label><label>Detail kejadian<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Ceritakan apa yang terjadi..." minLength={10} required /></label><label>Tingkat urgensi<select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value as ReportSeverity })}>{Object.entries(severityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><div className="report-location-hint"><span className="report-location-dot" />{form.latitude.toFixed(4)}, {form.longitude.toFixed(4)}<small>Lokasi dipilih dari peta atau perangkat Anda.</small></div><button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? "Mengirim laporan..." : "Kirim laporan"}</button></form></section>
              <section className="dashboard-panel-section dashboard-history-section"><div className="dashboard-panel-title"><div><span className="dashboard-kicker">Riwayat</span><h2>Laporan saya</h2></div></div>{reports.length === 0 ? <p className="dashboard-empty">Belum ada laporan.</p> : <div className="dashboard-report-list">{reports.map((report) => <article key={report.id}><div><strong>{report.category}</strong><span>{report.ticketNumber} · {new Date(report.createdAt).toLocaleDateString("id-ID")}</span></div><StatusBadge status={report.status} /></article>)}</div>}</section>
            </> : <section className="dashboard-panel-section dashboard-queue-section"><div className="dashboard-panel-title"><div><span className="dashboard-kicker">Antrian kerja</span><h2>{user?.role === "polisi" ? "Laporan unit Anda" : "Semua laporan"}</h2></div><span className="dashboard-queue-count">{reports.length}</span></div>{reports.length === 0 ? <p className="dashboard-empty">Belum ada laporan untuk ditampilkan.</p> : <div className="dashboard-queue-list">{reports.map((report) => <article className="dashboard-queue-item" key={report.id}><div className="dashboard-queue-item-top"><div><strong>{report.category}</strong><span>{report.ticketNumber}</span></div><StatusBadge status={report.status} /></div><p>{report.description || "Tidak ada detail laporan."}</p><small>{report.policeUnit?.name || "Belum ditentukan"} · {severityLabels[report.severity]}</small>{user?.role === "polisi" && report.status !== "RESOLVED" && <select aria-label={`Perbarui status ${report.ticketNumber}`} value="" disabled={activeReportId === report.id} onChange={(event) => { if (event.target.value) void updateStatus(report.id, event.target.value as Exclude<ReportStatus, "PENDING">); }}><option value="">Perbarui status</option><option value="VERIFIED">Terverifikasi</option><option value="IN_PROGRESS">Diproses</option><option value="RESOLVED">Selesai</option><option value="REJECTED">Tolak</option></select>}</article>)}</div>}</section>}
          </div>
        </aside>
      </div>
    </main>
  );
}
