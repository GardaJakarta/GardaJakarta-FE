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
  return image ? <img className="dashboard-avatar" src={image} alt={`Foto profil ${name}`} /> : <span className="dashboard-avatar dashboard-avatar-fallback">{name.slice(0, 1).toUpperCase()}</span>;
}

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
  };

  const updateStatus = async (id: string, status: Exclude<ReportStatus, "PENDING">) => {
    setActiveReportId(id);
    try { await updatePoliceReportStatus(id, status); await loadDashboard(); }
    catch { setError("Status laporan belum dapat diperbarui."); }
    finally { setActiveReportId(null); }
  };

  const title = user?.role === "warga" ? "Pantau Jakarta bersama" : user?.role === "polisi" ? "Ruang kerja petugas" : "Monitoring Garda Jakarta";
  const description = user?.role === "warga" ? "Lihat laporan di sekitar Anda dan kirim laporan dari satu dashboard." : user?.role === "polisi" ? "Tinjau laporan yang masuk ke unit Anda dan perbarui tindak lanjutnya." : "Pantau volume laporan, status penanganan, dan unit yang bekerja di lapangan.";
  const reports = data?.reports ?? EMPTY_REPORTS;
  const stats = data?.stats || { total: 0, pending: 0, inProgress: 0, resolved: 0 };
  const canUpdate = user?.role === "polisi";
  const mapReports = useMemo(() => reports.filter((report) => report.status !== "REJECTED"), [reports]);
  const handleMapClick = useCallback((coordinates: { latitude: number; longitude: number }) => {
    setForm((current) => ({ ...current, ...coordinates }));
  }, []);

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Link className="map-brand" to="/dashboard" aria-label="Dashboard Garda Jakarta"><AppLogo size={155} aria-label="Garda Jakarta" /></Link>
        <div className="dashboard-account"><Avatar name={user?.name || "Garda"} image={user?.image} /><span>{user?.name}</span><button type="button" onClick={() => void signOut()}>Keluar</button></div>
      </header>
      <div className="dashboard-shell">
        <div className="dashboard-intro"><div><p className="eyebrow">Dashboard {user?.role}</p><h1>{title}</h1><p>{description}</p></div><Link className="dashboard-map-link" to="/map">Buka peta publik</Link></div>
        {error && <p className="dashboard-error" role="alert">{error}</p>}
        <section className="dashboard-stats" aria-label="Ringkasan laporan">
          {[['Total laporan', stats.total], ['Menunggu', stats.pending], ['Diproses', stats.inProgress], ['Selesai', stats.resolved]].map(([label, value]) => <div className="dashboard-stat" key={label}><span>{label}</span><strong>{isLoading ? "—" : value}</strong></div>)}
        </section>
        {user?.role === "warga" && <section className="dashboard-grid">
          <form className="dashboard-card report-form-card" onSubmit={(event) => void submitReport(event)}><p className="eyebrow">Buat laporan</p><h2>Sampaikan situasi di sekitar Anda.</h2><label>Kategori<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required><option value="">Pilih kategori</option><option>Gangguan keamanan</option><option>Penerangan jalan</option><option>Fasilitas umum</option><option>Lalu lintas</option></select></label><label>Detail kejadian<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Ceritakan apa yang terjadi..." minLength={10} required /></label><label>Tingkat urgensi<select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value as ReportSeverity })}>{Object.entries(severityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="primary-button" type="submit">Kirim laporan</button><small>Lokasi akan memakai izin lokasi perangkat atau titik tengah Jakarta bila izin tidak tersedia.</small></form>
          <div className="dashboard-card dashboard-map-card"><div className="dashboard-card-heading"><div><p className="eyebrow">Peta Jakarta</p><h2>Lihat laporan dan kantor polisi.</h2></div><span className="dashboard-readonly">Klik peta untuk lokasi</span></div><GardaMap units={data?.units || []} reports={mapReports} onMapClick={handleMapClick} /></div>
        </section>}
        {user?.role !== "warga" && <section className="dashboard-card dashboard-queue-card"><div className="dashboard-card-heading"><div><p className="eyebrow">Antrian laporan</p><h2>{user?.role === "polisi" ? "Laporan unit Anda" : "Monitoring seluruh laporan"}</h2></div><span className="dashboard-readonly">{user?.role === "admin" ? "Admin" : "Operasional"}</span></div><div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>Tiket</th><th>Kategori</th><th>Unit</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{reports.map((report) => <tr key={report.id}><td>{report.ticketNumber}</td><td>{report.category}<small>{severityLabels[report.severity]}</small></td><td>{report.policeUnit?.name || "Belum ditentukan"}</td><td><span className={`status-badge status-${report.status.toLowerCase()}`}>{statusLabels[report.status]}</span></td><td>{canUpdate && report.status !== "RESOLVED" && <select value="" disabled={activeReportId === report.id} onChange={(event) => { if (event.target.value) void updateStatus(report.id, event.target.value as Exclude<ReportStatus, "PENDING">); }}><option value="">Ubah status</option><option value="VERIFIED">Terverifikasi</option><option value="IN_PROGRESS">Diproses</option><option value="RESOLVED">Selesai</option><option value="REJECTED">Tolak</option></select>}</td></tr>)}</tbody></table>{reports.length === 0 && <p className="dashboard-empty">Belum ada laporan untuk ditampilkan.</p>}</div></section>}
        {user?.role === "warga" && <section className="dashboard-card dashboard-reports-card"><div className="dashboard-card-heading"><div><p className="eyebrow">Riwayat saya</p><h2>Laporan yang pernah Anda kirim.</h2></div></div>{reports.length === 0 ? <p className="dashboard-empty">Belum ada laporan. Laporan pertama Anda akan muncul di sini.</p> : <div className="dashboard-report-list">{reports.map((report) => <article key={report.id}><div><strong>{report.category}</strong><span>{report.ticketNumber} · {new Date(report.createdAt).toLocaleDateString("id-ID")}</span></div><span className={`status-badge status-${report.status.toLowerCase()}`}>{statusLabels[report.status]}</span></article>)}</div>}</section>}
      </div>
    </main>
  );
}
