import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import GardaMap from "../components/GardaMap";
import AppLogo from "../components/branding/AppLogo";
import { useAuth } from "../context/useAuth";
import { createReport, getDashboard, getPublicMap, updatePoliceReportStatus } from "../lib/api";
import { portalPaths } from "../lib/portals";
import type { DashboardData, IncidentReport, PoliceUnit, ReportSeverity, ReportStatus } from "../types";

type ViewMode = "map" | "feed";
type StatusFilter = "ALL" | Exclude<ReportStatus, "REJECTED">;
type ReportFormState = { category: string; description: string; severity: ReportSeverity; latitude: number; longitude: number };

const statusLabels: Record<ReportStatus, string> = {
  PENDING: "Belum diverifikasi",
  VERIFIED: "Terverifikasi",
  IN_PROGRESS: "Ditindaklanjuti",
  RESOLVED: "Selesai",
  REJECTED: "Ditolak",
};
const statusShortLabels: Record<ReportStatus, string> = { PENDING: "Masuk", VERIFIED: "Terverifikasi", IN_PROGRESS: "Diproses", RESOLVED: "Selesai", REJECTED: "Ditolak" };
const severityLabels: Record<ReportSeverity, string> = { P0: "Kritis", P1: "Tinggi", P2: "Sedang", P3: "Rendah" };
const categories = [
  "Pelecehan verbal atau catcalling",
  "Pelecehan atau kekerasan seksual",
  "Pencurian atau perampasan",
  "Begal atau perampokan",
  "Kekerasan fisik",
  "Tawuran atau kerumunan berbahaya",
  "Penipuan atau pemerasan",
  "Gangguan penerangan atau fasilitas yang berdampak pada keamanan",
  "Lainnya",
];
const statusFilters: StatusFilter[] = ["ALL", "PENDING", "VERIFIED", "IN_PROGRESS", "RESOLVED"];
const EMPTY_REPORTS: DashboardData["reports"] = [];

function roleLabel(role: DashboardData["role"] | undefined) {
  return role === "polisi" ? "Petugas polisi" : role === "admin" ? "Admin operasional" : "Warga";
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Waktu tidak tersedia";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function ageLabel(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "waktu tidak tersedia";
  const hours = Math.max(0, Math.floor((Date.now() - timestamp) / 3_600_000));
  if (hours < 1) return "baru saja";
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

function Avatar({ name, image, size = "h-9 w-9" }: { name: string; image?: string | null; size?: string }) {
  return image
    ? <img className={`${size} rounded-full object-cover`} src={image} alt={`Foto profil ${name}`} referrerPolicy="no-referrer" />
    : <span className={`grid ${size} place-items-center rounded-full bg-[#e62428] text-sm font-extrabold text-white`}>{name.slice(0, 1).toUpperCase()}</span>;
}

function StatusBadge({ status }: { status: ReportStatus }) {
  const colors: Record<ReportStatus, string> = { PENDING: "bg-amber-50 text-amber-700", VERIFIED: "bg-sky-50 text-sky-700", IN_PROGRESS: "bg-orange-50 text-orange-700", RESOLVED: "bg-emerald-50 text-emerald-700", REJECTED: "bg-red-50 text-red-700" };
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-black ${colors[status]}`}>{statusLabels[status]}</span>;
}

function SeverityBadge({ severity }: { severity: ReportSeverity }) {
  const colors: Record<ReportSeverity, string> = { P0: "bg-red-100 text-red-800", P1: "bg-orange-100 text-orange-800", P2: "bg-amber-100 text-amber-800", P3: "bg-slate-100 text-slate-600" };
  return <span className={`inline-flex rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wide ${colors[severity]}`}>{severityLabels[severity]}</span>;
}

function Chevron({ open }: { open: boolean }) {
  return <svg className={`h-4 w-4 fill-none stroke-current stroke-[1.8] transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;
}

function FilterIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 5h16v2H4V5Zm3 6h10v2H7v-2Zm3 6h4v2h-4v-2Z" /></svg>;
}

function StatusFilterMenu({ value, onChange }: { value: StatusFilter; onChange: (value: StatusFilter) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (event: PointerEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);
  const label = value === "ALL" ? "Semua status" : statusShortLabels[value];
  return <div ref={ref} className="relative shrink-0">
    <button type="button" onClick={() => setOpen((current) => !current)} className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[10px] font-black transition-colors ${value === "ALL" ? "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" : "bg-slate-900 text-white"}`} aria-expanded={open} aria-haspopup="listbox"><FilterIcon /><span className="hidden sm:inline">Filter</span><span className="max-w-[100px] truncate">{label}</span><Chevron open={open} /></button>
    {open && <div className="absolute bottom-[calc(100%+10px)] left-0 z-50 w-52 rounded-xl border border-slate-100 bg-white p-2 text-left shadow-[0_18px_44px_rgba(15,23,42,0.16)]" role="listbox" aria-label="Filter status laporan"><p className="px-2 pb-2 pt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Status laporan</p>{statusFilters.map((option) => <button key={option} type="button" role="option" aria-selected={value === option} onClick={() => { onChange(option); setOpen(false); }} className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-bold transition-colors ${value === option ? "bg-red-50 text-[#b21e24]" : "text-slate-700 hover:bg-slate-50"}`}><span className={`grid h-4 w-4 place-items-center rounded-full border text-[10px] ${value === option ? "border-[#e62428] bg-[#e62428] text-white" : "border-slate-300 text-transparent"}`}>✓</span>{option === "ALL" ? "Semua status" : statusLabels[option]}</button>)}</div>}
  </div>;
}

function ReportCard({ report, selected, onSelect }: { report: IncidentReport; selected: boolean; onSelect: () => void }) {
  return <button type="button" onClick={onSelect} className={`w-full rounded-xl border bg-white p-3.5 text-left transition-all ${selected ? "border-red-200 shadow-md ring-1 ring-red-100" : "border-slate-100 hover:border-slate-200 hover:shadow-sm"}`}><div className="flex items-start justify-between gap-2"><div className="flex min-w-0 flex-wrap items-center gap-1.5"><StatusBadge status={report.status} /><SeverityBadge severity={report.severity} /></div><span className="shrink-0 text-[10px] font-semibold text-slate-400">{ageLabel(report.updatedAt)}</span></div><h3 className="mt-2 line-clamp-2 text-sm font-black leading-snug tracking-tight text-slate-900">{report.category}</h3><div className="mt-2 flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-400"><span className="truncate">{report.policeUnit?.district || "Wilayah belum ditentukan"}</span><span className="shrink-0 font-black tracking-wide">{report.ticketNumber}</span></div></button>;
}

function ReportDetail({ report, role, onClose, onStatusChange, updating }: { report: IncidentReport; role: DashboardData["role"]; onClose: () => void; onStatusChange: (status: Exclude<ReportStatus, "PENDING">) => void; updating: boolean }) {
  const canUpdate = role === "polisi" && report.status !== "RESOLVED" && report.status !== "REJECTED";
  return <aside className="absolute bottom-3 right-3 z-40 max-h-[calc(100dvh-104px)] w-[min(380px,calc(100vw-24px))] overflow-y-auto rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_22px_65px_rgba(15,23,42,0.2)] sm:bottom-6 sm:right-6" aria-live="polite"><button type="button" onClick={onClose} className="absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-full text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-800" aria-label="Tutup detail">×</button><div className="pr-8"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={report.status} /><SeverityBadge severity={report.severity} /></div><h2 className="mt-3 text-xl font-black leading-tight tracking-tight text-slate-950">{report.category}</h2><p className="mt-1 text-[11px] font-bold text-slate-400">{report.ticketNumber} · diperbarui {formatTime(report.updatedAt)}</p></div><div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 text-xs"><div><span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Wilayah penanganan</span><strong className="mt-1 block text-slate-800">{report.policeUnit?.name || "Belum ditentukan"}</strong><span className="mt-0.5 block text-slate-500">{report.policeUnit?.district || "Akan ditentukan oleh petugas"}</span></div><div><span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Lokasi laporan</span><span className="mt-1 block text-slate-600">Area dianonimkan pada tampilan publik · {report.latitude.toFixed(3)}, {report.longitude.toFixed(3)}</span></div>{report.description && <div><span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Kronologi</span><p className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-600">{report.description}</p></div>}</div>{canUpdate && <div className="mt-5 border-t border-slate-100 pt-4"><label className="grid gap-1.5 text-xs font-black text-slate-700">Perbarui status<select disabled={updating} value={report.status} onChange={(event) => void onStatusChange(event.target.value as Exclude<ReportStatus, "PENDING">)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none transition-colors focus:border-[#e62428] focus:ring-4 focus:ring-red-100"><option value="PENDING" disabled>{statusLabels.PENDING}</option><option value="VERIFIED">{statusLabels.VERIFIED}</option><option value="IN_PROGRESS">{statusLabels.IN_PROGRESS}</option><option value="RESOLVED">{statusLabels.RESOLVED}</option><option value="REJECTED">{statusLabels.REJECTED}</option></select></label><p className="mt-2 text-[10px] leading-relaxed text-slate-400">Perubahan status dicatat sebagai aktivitas operasional.</p></div>}{role === "admin" && <p className="mt-5 border-t border-slate-100 pt-4 text-[10px] leading-relaxed text-slate-400">Data pelapor dan koordinat presisi hanya tersedia sesuai permission. Peta publik menampilkan area yang sudah dianonimkan.</p>}</aside>;
}

function ReportForm({ form, setForm, pinMode, setPinMode, submitting, onSubmit, onClose, error }: { form: ReportFormState; setForm: Dispatch<SetStateAction<ReportFormState>>; pinMode: boolean; setPinMode: (value: boolean) => void; submitting: boolean; onSubmit: (event: FormEvent) => void; onClose: () => void; error: string | null }) {
  return <aside className="absolute bottom-3 right-3 z-40 max-h-[calc(100dvh-104px)] w-[min(410px,calc(100vw-24px))] overflow-y-auto rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_22px_65px_rgba(15,23,42,0.2)] sm:bottom-6 sm:right-6" aria-label="Form laporan baru"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-widest text-[#e62428]">Laporan warga</p><h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Buat laporan</h2><p className="mt-1 text-xs leading-relaxed text-slate-500">Pilih lokasi dan ceritakan kejadian secara singkat.</p></div><button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full text-lg leading-none text-slate-400 hover:bg-slate-100" aria-label="Tutup form">×</button></div><form className="mt-5 grid gap-3.5" onSubmit={onSubmit}><label className="grid gap-1.5 text-xs font-black text-slate-700">Kategori kejadian<select required value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-[#e62428] focus:ring-4 focus:ring-red-100"><option value="">Pilih kategori kejadian</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label className="grid gap-1.5 text-xs font-black text-slate-700">Kronologi singkat<textarea required minLength={10} maxLength={2000} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Apa yang terjadi?" className="min-h-28 resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-normal leading-relaxed outline-none focus:border-[#e62428] focus:ring-4 focus:ring-red-100" /><span className="text-[10px] font-normal text-slate-400">Minimal 10 karakter. Jangan tulis identitas korban, wajah, atau nomor telepon.</span></label><label className="grid gap-1.5 text-xs font-black text-slate-700">Tingkat keparahan yang dirasakan<select value={form.severity} onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value as ReportSeverity }))} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-[#e62428] focus:ring-4 focus:ring-red-100">{Object.entries(severityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><div className="rounded-xl bg-slate-50 p-3"><div className="flex items-start gap-2"><span className="mt-0.5 text-[#e62428]">⌖</span><div className="min-w-0 flex-1"><strong className="block text-xs text-slate-800">Lokasi kejadian</strong><span className="mt-1 block text-[11px] text-slate-500">{form.latitude.toFixed(4)}, {form.longitude.toFixed(4)}</span></div><button type="button" onClick={() => setPinMode(!pinMode)} className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black ${pinMode ? "bg-[#e62428] text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>{pinMode ? "Pilih di peta" : "Ubah titik"}</button></div></div>{error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700" role="alert">{error}</p>}<button type="submit" disabled={submitting || !form.category} className="h-11 rounded-lg bg-[#e62428] px-4 text-xs font-black text-white transition-colors hover:bg-[#c91d22] disabled:cursor-wait disabled:opacity-60">{submitting ? "Mengirim laporan..." : "Kirim laporan"}</button></form></aside>;
}

function FeedView({ reports, role, stats, units, overview, onSelect, selectedId }: { reports: IncidentReport[]; role: DashboardData["role"]; stats: DashboardData["stats"]; units: PoliceUnit[]; overview?: DashboardData["adminOverview"]; onSelect: (report: IncidentReport) => void; selectedId: string | null }) {
  const title = role === "warga" ? "Laporan saya" : role === "polisi" ? "Antrian unit" : "Monitoring laporan";
  const description = role === "warga" ? "Pantau status dan pembaruan laporan yang Anda kirim." : role === "polisi" ? "Triage laporan dari wilayah unit Anda dan catat status penanganannya." : "Ringkasan laporan dan unit operasional Garda Jakarta.";
  return <div className="absolute inset-0 overflow-y-auto bg-[#f3f4f6] px-3 pb-24 pt-24 sm:px-6 sm:pt-28"><div className="mx-auto w-full max-w-5xl"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-widest text-[#e62428]">Dashboard {roleLabel(role)}</p><h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{title}</h1><p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-500">{description}</p></div>{role === "admin" && <span className="rounded-full bg-white px-3 py-2 text-[10px] font-black text-slate-500 ring-1 ring-slate-200">{units.length} unit terpublikasi</span>}</div><div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-xl bg-white p-3 ring-1 ring-slate-100"><span className="text-[10px] font-bold text-slate-400">Total</span><strong className="mt-1 block text-xl font-black text-slate-900">{stats.total}</strong></div><div className="rounded-xl bg-white p-3 ring-1 ring-slate-100"><span className="text-[10px] font-bold text-slate-400">Masuk</span><strong className="mt-1 block text-xl font-black text-slate-900">{stats.pending}</strong></div><div className="rounded-xl bg-white p-3 ring-1 ring-slate-100"><span className="text-[10px] font-bold text-slate-400">Diproses</span><strong className="mt-1 block text-xl font-black text-slate-900">{stats.inProgress}</strong></div><div className="rounded-xl bg-white p-3 ring-1 ring-slate-100"><span className="text-[10px] font-bold text-slate-400">Selesai</span><strong className="mt-1 block text-xl font-black text-slate-900">{stats.resolved}</strong></div></div>{role === "admin" && overview && <div className="mt-4 grid gap-3 lg:grid-cols-[1.15fr_.85fr]"><div className="rounded-xl bg-white p-4 ring-1 ring-slate-100"><div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-black text-slate-900">Ringkasan operasional</h2><p className="mt-1 text-[10px] text-slate-400">Data agregat untuk monitoring admin.</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black text-slate-500">{overview.auditLogs} aktivitas</span></div><div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-lg bg-slate-50 p-3"><span className="block text-[9px] font-bold text-slate-400">Pengguna</span><strong className="mt-1 block text-lg font-black">{overview.users}</strong></div><div className="rounded-lg bg-slate-50 p-3"><span className="block text-[9px] font-bold text-slate-400">Unit polisi</span><strong className="mt-1 block text-lg font-black">{overview.units}</strong></div><div className="rounded-lg bg-slate-50 p-3"><span className="block text-[9px] font-bold text-slate-400">Audit log</span><strong className="mt-1 block text-lg font-black">{overview.auditLogs}</strong></div></div></div><div className="rounded-xl bg-white p-4 ring-1 ring-slate-100"><h2 className="text-sm font-black text-slate-900">Kategori terbanyak</h2><div className="mt-3 grid gap-2">{overview.categories.length === 0 ? <p className="text-xs text-slate-400">Belum ada data kategori.</p> : overview.categories.map((category) => <div key={category.name} className="flex items-center justify-between gap-3 text-[11px]"><span className="truncate font-bold text-slate-600">{category.name}</span><span className="shrink-0 rounded-full bg-red-50 px-2 py-1 font-black text-red-700">{category.count}</span></div>)}</div></div></div>}<div className="mt-4 grid gap-3 md:grid-cols-2">{reports.length === 0 ? <div className="rounded-xl bg-white p-8 text-center text-xs font-semibold text-slate-400 ring-1 ring-slate-100 md:col-span-2">Belum ada laporan untuk ditampilkan.</div> : reports.map((report) => <ReportCard key={report.id} report={report} selected={selectedId === report.id} onSelect={() => onSelect(report)} />)}</div></div></div>;
}

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  const role = user?.role || "warga";
  const citizen = role === "warga";
  const [data, setData] = useState<DashboardData | null>(null);
  const [publicMap, setPublicMap] = useState<{ units: PoliceUnit[]; reports: IncidentReport[]; updatedAt: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("map");
  const [listOpen, setListOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [signoutOpen, setSignoutOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<ReportFormState>({ category: "", description: "", severity: "P2", latitude: -6.1754, longitude: 106.8272 });

  useEffect(() => {
    if (!accountOpen) return;
    const handler = (event: PointerEvent) => { if (accountRef.current && !accountRef.current.contains(event.target as Node)) setAccountOpen(false); };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [accountOpen]);

  const load = useCallback(async () => {
    setLoading(true);
    const [dashboardResult, publicResult] = await Promise.allSettled([getDashboard(), getPublicMap()]);
    if (dashboardResult.status === "fulfilled") { setData(dashboardResult.value); setError(null); } else setError("Dashboard belum dapat dimuat. Periksa koneksi lalu coba lagi.");
    if (publicResult.status === "fulfilled") setPublicMap(publicResult.value);
    setLoading(false);
  }, []);
  // Dashboard data is synchronized with the authenticated API session.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const reports = data?.reports ?? EMPTY_REPORTS;
  const stats = data?.stats || { total: 0, pending: 0, inProgress: 0, resolved: 0 };
  const matches = useCallback((report: IncidentReport) => {
    const statusMatches = statusFilter === "ALL" || report.status === statusFilter;
    const query = search.trim().toLowerCase();
    const searchMatches = !query || [report.ticketNumber, report.category, report.description, report.policeUnit?.name, report.policeUnit?.district].filter(Boolean).some((value) => value!.toLowerCase().includes(query));
    return report.status !== "REJECTED" && statusMatches && searchMatches;
  }, [search, statusFilter]);
  const filteredReports = useMemo(() => reports.filter(matches), [matches, reports]);
  const publicReports = useMemo(() => (publicMap?.reports ?? []).filter(matches), [matches, publicMap?.reports]);
  const mapReports = citizen ? publicReports : filteredReports;
  const mapUnits = citizen ? (publicMap?.units ?? data?.units ?? []) : (data?.units ?? []);
  const selectedReport = useMemo(() => (citizen ? [...publicReports, ...reports] : reports).find((report) => report.id === selectedId) ?? null, [citizen, publicReports, reports, selectedId]);
  const activeFilter = statusFilter !== "ALL" || Boolean(search.trim());

  const openReportForm = () => { setSelectedId(null); setListOpen(false); setReportOpen(true); setPinMode(true); setError(null); };
  const selectReport = (report: IncidentReport) => { setSelectedId(report.id); setListOpen(false); setReportOpen(false); };
  const mapClick = useCallback((coordinates: { latitude: number; longitude: number }) => { setForm((current) => ({ ...current, ...coordinates })); setPinMode(false); setNotice("Lokasi laporan sudah dipilih dari peta."); }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSubmitting(true); setError(null); setNotice(null);
    try { await createReport(form); setForm((current) => ({ ...current, category: "", description: "" })); setReportOpen(false); setPinMode(false); setNotice("Laporan berhasil dikirim dan masuk ke unit penanganan terdekat."); await load(); }
    catch { setError("Laporan belum dapat dikirim. Periksa isian lalu coba lagi."); }
    finally { setSubmitting(false); }
  };
  const updateStatus = async (id: string, status: Exclude<ReportStatus, "PENDING">) => { setUpdatingId(id); setError(null); try { await updatePoliceReportStatus(id, status); setNotice("Status laporan diperbarui."); await load(); } catch { setError("Status laporan belum dapat diperbarui."); } finally { setUpdatingId(null); } };
  const handleSignOut = async () => { try { await signOut(); window.location.assign(portalPaths[role].login); } catch { setError("Sesi belum dapat ditutup. Coba lagi."); } finally { setSignoutOpen(false); } };

  return <main className="relative h-[100dvh] min-h-[620px] overflow-hidden bg-[#f3f4f6] text-slate-900">
    <header className="absolute left-1/2 top-3 z-50 flex w-[calc(100%-24px)] max-w-6xl -translate-x-1/2 items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-[0_8px_32px_-8px_rgba(15,23,42,0.18)] ring-1 ring-slate-100 sm:top-4 sm:rounded-full sm:px-4 sm:py-2.5"><a href="https://gardajakarta.my.id" aria-label="Beranda Garda Jakarta" className="shrink-0"><AppLogo className="h-auto w-[112px] sm:w-[135px]" size={145} aria-label="Garda Jakarta" /></a><div className="flex min-w-0 flex-1 items-center justify-center sm:justify-start"><div className="flex items-center rounded-full bg-slate-100 p-1"><button type="button" onClick={() => setView("map")} className={`rounded-full px-3 py-1.5 text-[10px] font-black transition-colors sm:px-4 ${view === "map" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Peta</button><button type="button" onClick={() => { setView("feed"); setListOpen(false); setReportOpen(false); }} className={`rounded-full px-3 py-1.5 text-[10px] font-black transition-colors sm:px-4 ${view === "feed" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{citizen ? "Laporan saya" : role === "polisi" ? "Antrian" : "Monitoring"}</button></div></div><div ref={accountRef} className="relative shrink-0"><button type="button" onClick={() => setAccountOpen((current) => !current)} className="inline-flex items-center gap-2 rounded-full px-1.5 py-1 text-left hover:bg-slate-50" aria-haspopup="menu" aria-expanded={accountOpen}><Avatar name={user?.name || "Garda"} image={user?.image} size="h-8 w-8 sm:h-9 sm:w-9" /><span className="hidden max-w-[150px] sm:block"><strong className="block truncate text-[11px] font-black text-slate-900">{user?.name}</strong><small className="mt-0.5 block text-[9px] font-black text-[#e62428]">{roleLabel(role)}</small></span><Chevron open={accountOpen} /></button>{accountOpen && <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-56 rounded-xl border border-slate-100 bg-white p-2 shadow-2xl" role="menu"><div className="border-b border-slate-100 px-3 py-2.5"><strong className="block truncate text-xs">{user?.name}</strong><span className="mt-1 block truncate text-[10px] text-slate-400">{user?.email}</span></div><button type="button" role="menuitem" onClick={() => { setAccountOpen(false); setSignoutOpen(true); }} className="mt-1 flex w-full items-center rounded-lg px-3 py-2.5 text-left text-xs font-black text-red-700 hover:bg-red-50">Keluar</button></div>}</div></header>

    {view === "map" ? <section className="absolute inset-0" aria-label="Dashboard peta keamanan Jakarta"><GardaMap className="!h-full !min-h-0" units={mapUnits} reports={mapReports} onMapClick={citizen && (reportOpen || pinMode) ? mapClick : undefined} onSelectReport={selectReport} />
      <div className="absolute left-4 top-24 z-10 flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-[10px] font-black text-slate-600 shadow-lg backdrop-blur-md sm:left-6"><span className="h-2 w-2 rounded-full bg-[#e62428]" />{roleLabel(role)}<span className="text-slate-300">·</span><span>{loading ? "Memuat" : `${mapReports.length} laporan di peta`}</span></div>{publicMap?.updatedAt && citizen && <span className="absolute bottom-4 left-4 z-10 hidden rounded-full bg-white/90 px-3 py-2 text-[10px] font-bold text-slate-500 shadow-lg backdrop-blur-md sm:block">Pembaruan peta {formatTime(publicMap.updatedAt)}</span>}
      <div className="absolute bottom-4 left-1/2 z-20 flex w-[calc(100%-24px)] max-w-2xl -translate-x-1/2 items-center gap-1.5 rounded-full bg-white p-1.5 shadow-[0_8px_32px_-8px_rgba(15,23,42,0.22)] ring-1 ring-slate-100"><div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 ring-1 ring-slate-100 focus-within:bg-white focus-within:ring-red-100"><svg className="h-4 w-4 shrink-0 text-[#e62428]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg><input aria-label="Cari laporan" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={citizen ? "Cari kategori atau tiket..." : "Cari tiket, kategori, atau wilayah..."} className="min-w-0 w-full bg-transparent text-[11px] font-bold text-slate-800 outline-none placeholder:text-slate-400" /></div><StatusFilterMenu value={statusFilter} onChange={setStatusFilter} />{citizen && <button type="button" onClick={openReportForm} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[#e62428] px-3 text-[10px] font-black text-white shadow-sm hover:bg-[#c91d22]"><span className="text-base leading-none">+</span><span className="hidden sm:inline">Buat laporan</span></button>}<button type="button" onClick={() => { setListOpen((current) => !current); setReportOpen(false); setSelectedId(null); }} className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[10px] font-black transition-colors ${listOpen ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}><span className="text-sm leading-none">☷</span><span className="hidden sm:inline">{citizen ? "Laporan saya" : role === "polisi" ? "Antrian" : "Laporan"}</span>{activeFilter && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[#e62428] px-1 text-[9px] text-white">!</span>}</button></div>
      {listOpen && <aside className="absolute bottom-[72px] left-3 right-3 z-30 max-h-[68dvh] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_22px_65px_rgba(15,23,42,0.2)] sm:bottom-auto sm:left-6 sm:right-auto sm:top-24 sm:w-[380px]" aria-label="Daftar laporan"><div className="border-b border-slate-100 px-4 pb-3 pt-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-widest text-[#e62428]">{citizen ? "Riwayat" : "Operasional"}</p><h2 className="mt-1 text-lg font-black tracking-tight">{citizen ? "Laporan saya" : role === "polisi" ? "Antrian unit" : "Monitoring laporan"}</h2><p className="mt-1 text-[10px] font-bold text-slate-400">{filteredReports.length} laporan sesuai filter</p></div><button type="button" onClick={() => setListOpen(false)} className="grid h-7 w-7 place-items-center rounded-full text-lg text-slate-400 hover:bg-slate-100" aria-label="Tutup daftar">×</button></div><div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-50 p-1 text-center"><div className="rounded-lg bg-white py-1.5 shadow-sm"><strong className="block text-sm font-black">{stats.total}</strong><span className="text-[8px] font-black uppercase text-slate-400">Total</span></div><div className="py-1.5"><strong className="block text-sm font-black">{stats.pending}</strong><span className="text-[8px] font-black uppercase text-slate-400">Masuk</span></div><div className="py-1.5"><strong className="block text-sm font-black">{stats.inProgress}</strong><span className="text-[8px] font-black uppercase text-slate-400">Proses</span></div><div className="py-1.5"><strong className="block text-sm font-black">{stats.resolved}</strong><span className="text-[8px] font-black uppercase text-slate-400">Selesai</span></div></div></div><div className="max-h-[calc(68dvh-166px)] space-y-2 overflow-y-auto bg-slate-50/70 p-3">{(citizen ? filteredReports : filteredReports).length === 0 ? <p className="px-3 py-10 text-center text-xs font-semibold text-slate-400">Belum ada laporan yang sesuai.</p> : filteredReports.map((report) => <ReportCard key={report.id} report={report} selected={selectedId === report.id} onSelect={() => selectReport(report)} />)}</div></aside>}
      {selectedReport && !reportOpen && <ReportDetail report={selectedReport} role={role} onClose={() => setSelectedId(null)} onStatusChange={(status) => void updateStatus(selectedReport.id, status)} updating={updatingId === selectedReport.id} />}{reportOpen && <ReportForm form={form} setForm={setForm} pinMode={pinMode} setPinMode={setPinMode} submitting={submitting} onSubmit={(event) => void submit(event)} onClose={() => { setReportOpen(false); setPinMode(false); }} error={error} />}{notice && <div className="absolute left-1/2 top-24 z-30 w-[calc(100%-32px)] max-w-md -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-3 text-center text-xs font-bold text-white shadow-xl" role="status">{notice}<button type="button" onClick={() => setNotice(null)} className="ml-3 text-white/60 hover:text-white" aria-label="Tutup notifikasi">×</button></div>}{error && !reportOpen && <p className="absolute left-1/2 top-24 z-30 w-[calc(100%-32px)] max-w-md -translate-x-1/2 rounded-xl bg-red-50 px-4 py-3 text-center text-xs font-bold text-red-700 shadow-lg" role="alert">{error}</p>}
    </section> : <FeedView reports={filteredReports} role={role} stats={stats} units={mapUnits} overview={data?.adminOverview} onSelect={(report) => { setView("map"); selectReport(report); }} selectedId={selectedId} />}

    {signoutOpen && <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/35 px-5 backdrop-blur-sm" role="presentation"><section className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="signout-title"><h2 id="signout-title" className="text-xl font-black tracking-tight">Keluar dari dashboard?</h2><p className="mt-2 text-xs leading-relaxed text-slate-500">Sesi di perangkat ini akan ditutup.</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setSignoutOpen(false)} className="rounded-lg px-4 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-100">Batal</button><button type="button" onClick={() => void handleSignOut()} className="rounded-lg bg-[#e62428] px-4 py-2.5 text-xs font-black text-white hover:bg-[#c91d22]">Keluar</button></div></section></div>}
  </main>;
}
