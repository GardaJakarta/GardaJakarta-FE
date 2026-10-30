import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Bell,
  Buildings,
  CaretRight,
  ChartDonut,
  CheckCircle,
  FileText,
  ListChecks,
  MapPin,
  SignOut,
  ShieldCheck,
  Tag,
  UsersThree,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import AppLogo from "../components/branding/AppLogo";
import { ReportListSkeleton } from "../components/LoadingSkeleton";
import { useAuth } from "../context/useAuth";
import { getDashboard } from "../lib/api";
import { reportStatusLabels } from "../lib/report-status";
import type { DashboardData, IncidentReport, ReportStatus } from "../types";

const navItems = [
  ["Overview", "#overview", ChartDonut],
  ["Unit polisi", "#units", Buildings],
  ["Kategori", "#categories", Tag],
  ["Pengguna", "#users", UsersThree],
  ["Laporan", "#reports", FileText],
] as const;

const statusMeta: Record<ReportStatus, { label: string; color: string; track: string; icon: typeof CheckCircle }> = {
  PENDING: { label: reportStatusLabels.PENDING, color: "text-slate-500", track: "bg-slate-400", icon: WarningCircle },
  VERIFIED: { label: reportStatusLabels.VERIFIED, color: "text-blue-600", track: "bg-blue-500", icon: ShieldCheck },
  IN_PROGRESS: { label: reportStatusLabels.IN_PROGRESS, color: "text-amber-600", track: "bg-amber-500", icon: ListChecks },
  CLARIFICATION: { label: reportStatusLabels.CLARIFICATION, color: "text-violet-600", track: "bg-violet-500", icon: WarningCircle },
  RESOLVED: { label: reportStatusLabels.RESOLVED, color: "text-emerald-600", track: "bg-emerald-500", icon: CheckCircle },
  REJECTED: { label: reportStatusLabels.REJECTED, color: "text-red-600", track: "bg-red-500", icon: XCircle },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function AdminKpi({ label, value, sub, icon: Icon, tone }: { label: string; value: number; sub?: string; icon: typeof FileText; tone: string }) {
  return <article className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(15,23,42,0.08)] sm:p-5"><div className={`mb-4 grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon size={19} weight="bold" /></div><strong className="block font-heading text-2xl font-black tracking-tight text-slate-950">{value.toLocaleString("id-ID")}</strong><span className="mt-1 block text-xs font-bold text-slate-500">{label}</span>{sub && <span className="mt-1 block text-[10px] font-semibold text-slate-400">{sub}</span>}<ArrowUpRight className="absolute right-4 top-4 text-slate-200 transition group-hover:text-slate-400" size={17} weight="bold" /></article>;
}

function StatusBreakdown({ overview }: { overview: NonNullable<DashboardData["adminOverview"]> }) {
  const total = Math.max(overview.reports, 1);
  const rows = (Object.keys(statusMeta) as ReportStatus[]).map((status) => ({ status, count: overview.statuses.find((item) => item.status === status)?.count || 0 }));
  return <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)] sm:p-6"><div className="flex items-start justify-between gap-3"><div><h2 className="font-heading text-sm font-black text-slate-950">Status laporan</h2><p className="mt-1 text-[11px] font-semibold text-slate-400">Distribusi laporan di seluruh wilayah.</p></div><ChartDonut size={21} className="text-red-500" weight="duotone" /></div><div className="mt-6 grid gap-4">{rows.map(({ status, count }) => { const meta = statusMeta[status]; const Icon = meta.icon; const percent = Math.round((count / total) * 100); return <div key={status} className="grid grid-cols-[auto_1fr_auto] items-center gap-3"><span className={`grid h-8 w-8 place-items-center rounded-lg bg-slate-50 ${meta.color}`}><Icon size={16} weight="bold" /></span><div className="min-w-0"><div className="flex items-center justify-between gap-2 text-[11px] font-bold"><span className="truncate text-slate-700">{meta.label}</span><span className="text-slate-400">{count}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${meta.track}`} style={{ width: `${Math.min(100, percent)}%` }} /></div></div><span className="w-8 text-right text-[10px] font-black text-slate-400">{percent}%</span></div>; })}</div></section>;
}

function Distribution({ overview }: { overview: NonNullable<DashboardData["adminOverview"]> }) {
  const rows = overview.unitsByReport.length ? overview.unitsByReport : overview.categories;
  const max = Math.max(...rows.map((item) => item.count), 1);
  return <section id="units" className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)] sm:p-6"><div className="flex items-start justify-between gap-3"><div><h2 className="font-heading text-sm font-black text-slate-950">Distribusi laporan</h2><p className="mt-1 text-[11px] font-semibold text-slate-400">Unit dengan laporan terbanyak.</p></div><Buildings size={21} className="text-red-500" weight="duotone" /></div><div className="mt-7 grid gap-4">{rows.slice(0, 6).map((item, index) => <div key={`${item.name}-${index}`}><div className="mb-1.5 flex items-center justify-between gap-3 text-[11px]"><span className="truncate font-bold text-slate-700">{item.name}</span><strong className="text-slate-900">{item.count}</strong></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${index % 2 ? "bg-red-300" : "bg-red-500"}`} style={{ width: `${Math.max(5, (item.count / max) * 100)}%` }} /></div></div>)}</div></section>;
}

function RecentReports({ reports }: { reports: IncidentReport[] }) {
  return <section id="reports" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_28px_rgba(15,23,42,0.04)]"><div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6"><div><h2 className="font-heading text-sm font-black text-slate-950">Laporan terbaru</h2><p className="mt-1 text-[11px] font-semibold text-slate-400">Pantau aktivitas laporan yang paling baru.</p></div><Link to="/dashboard" className="inline-flex items-center gap-1 text-[10px] font-black text-red-600 hover:text-red-700">Buka daftar <CaretRight size={13} weight="bold" /></Link></div><div className="divide-y divide-slate-100">{reports.slice(0, 8).map((report) => { const meta = statusMeta[report.status]; const Icon = meta.icon; return <div key={report.id} className="grid gap-3 px-5 py-4 transition hover:bg-slate-50/70 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6"><div className="flex min-w-0 items-center gap-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 ${meta.color}`}><Icon size={17} weight="bold" /></span><div className="min-w-0"><strong className="block truncate text-xs font-black text-slate-900">{report.category}</strong><span className="mt-1 block truncate text-[10px] font-semibold text-slate-400">{report.ticketNumber} · {report.policeUnit?.name || "Belum dirutekan"}</span></div></div><div className="flex items-center justify-between gap-3 sm:justify-end"><span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${meta.color} bg-slate-50`}>{meta.label}</span><time className="text-[10px] font-semibold text-slate-400">{formatDate(report.updatedAt)}</time></div></div>; })}</div>{!reports.length && <div className="px-6 py-10 text-center text-xs font-semibold text-slate-400">Belum ada laporan.</div>}</section>;
}

export default function AdminDashboardPage() {
  const { user, signOut } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => { let active = true; getDashboard().then((result) => { if (active) setData(result); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Dashboard belum dapat dimuat."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const overview = data?.adminOverview;
  const cards = useMemo(() => overview ? [
    ["Total unit polisi", overview.units, "Terdaftar dan dipublikasikan", Buildings, "bg-blue-50 text-blue-600"],
    ["Total cabang", overview.districts, "Wilayah operasional", MapPin, "bg-violet-50 text-violet-600"],
    ["Kategori laporan", overview.categoriesCount, "Kategori yang digunakan", Tag, "bg-amber-50 text-amber-600"],
    ["Total laporan", overview.reports, "Seluruh laporan masuk", FileText, "bg-red-50 text-red-600"],
    ["Total pengguna", overview.users, "Akun terdaftar", UsersThree, "bg-emerald-50 text-emerald-600"],
    ["Petugas aktif", overview.assignedPolice, "Akun polisi terhubung unit", ShieldCheck, "bg-rose-50 text-rose-600"],
  ] as const : [], [overview]);
  return <main className="min-h-dvh overflow-x-hidden bg-[#f6f7f9] text-slate-900">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200/80 bg-white px-5 py-6 lg:flex">
      <Link to="/" className="px-2"><AppLogo className="h-auto w-36" /></Link>
      <div className="mt-10 px-2 text-[9px] font-black uppercase tracking-[.22em] text-slate-400">Admin workspace</div>
      <nav className="mt-3 grid gap-1">{navItems.map(([label, href, Icon], index) => <a key={label} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold transition ${index === 0 ? "bg-red-50 text-red-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}><Icon size={17} weight={index === 0 ? "fill" : "bold"} />{label}</a>)}</nav>
      <div className="mt-auto rounded-2xl bg-slate-950 p-4 text-white"><p className="text-[10px] font-bold text-white/55">Sesi admin</p><strong className="mt-1 block truncate text-xs">{user?.name || "Admin"}</strong><button type="button" onClick={() => void signOut()} className="mt-4 inline-flex items-center gap-2 text-[10px] font-black text-white/70 hover:text-white"><SignOut size={14} weight="bold" /> Keluar</button></div>
    </aside>
    {sidebarOpen && <div className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true"><aside className="h-full w-[min(82vw,300px)] bg-white px-5 py-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><Link to="/" onClick={() => setSidebarOpen(false)}><AppLogo className="h-auto w-32" /></Link><button type="button" onClick={() => setSidebarOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500" aria-label="Tutup menu">×</button></div><div className="mt-10 px-2 text-[9px] font-black uppercase tracking-[.22em] text-slate-400">Admin workspace</div><nav className="mt-3 grid gap-1">{navItems.map(([label, href, Icon], index) => <a key={label} href={href} onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-xs font-bold ${index === 0 ? "bg-red-50 text-red-700" : "text-slate-500 hover:bg-slate-50"}`}><Icon size={17} weight={index === 0 ? "fill" : "bold"} />{label}</a>)}</nav><div className="mt-8 rounded-2xl bg-slate-950 p-4 text-white"><p className="text-[10px] font-bold text-white/55">Sesi admin</p><strong className="mt-1 block truncate text-xs">{user?.name || "Admin"}</strong><button type="button" onClick={() => void signOut()} className="mt-4 inline-flex items-center gap-2 text-[10px] font-black text-white/70 hover:text-white"><SignOut size={14} weight="bold" /> Keluar</button></div></aside></div>}
    <div className="lg:pl-64"><header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-9"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><button type="button" onClick={() => setSidebarOpen(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 lg:hidden" aria-label="Buka menu">☰</button><Link to="/" className="lg:hidden"><AppLogo className="h-auto w-28" /></Link><div className="hidden lg:block"><p className="text-[10px] font-black uppercase tracking-[.18em] text-red-500">Admin / Overview</p><h1 className="mt-0.5 font-heading text-base font-black text-slate-950">Pusat kendali Garda Jakarta</h1></div></div><div className="flex shrink-0 items-center"><button type="button" className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500" aria-label="Notifikasi"><Bell size={17} weight="bold" /></button></div></div></header><div id="overview" className="mx-auto max-w-7xl space-y-6 px-4 py-6 pb-14 sm:px-6 sm:py-8 lg:px-9"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-red-500">Overview</p><h2 className="mt-2 font-heading text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Selamat datang kembali{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</h2><p className="mt-2 max-w-xl text-xs font-semibold leading-relaxed text-slate-500">Pantau kesehatan laporan, unit polisi, dan aktivitas operasional dari satu ruang kerja.</p></div>{error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">{error}</div>}{loading ? <ReportListSkeleton count={2} /> : overview ? <><div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{cards.map(([label, value, sub, Icon, tone]) => <AdminKpi key={label} label={label} value={value} sub={sub} icon={Icon} tone={tone} />)}</div><div className="grid gap-6 lg:grid-cols-5"><div className="lg:col-span-2"><StatusBreakdown overview={overview} /></div><div className="lg:col-span-3"><Distribution overview={overview} /></div></div><section id="categories" className="grid gap-6 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)] sm:p-6"><div className="flex items-center justify-between"><div><h2 className="font-heading text-sm font-black text-slate-950">Kategori teratas</h2><p className="mt-1 text-[11px] font-semibold text-slate-400">Topik laporan yang paling sering masuk.</p></div><Tag size={21} className="text-red-500" weight="duotone" /></div><div className="mt-5 grid gap-2">{overview.categories.map((category) => <div key={category.name} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5"><span className="truncate text-[11px] font-bold text-slate-700">{category.name}</span><span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-black text-red-600">{category.count}</span></div>)}</div></div><div id="users" className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)] sm:p-6"><div className="flex items-center justify-between"><div><h2 className="font-heading text-sm font-black text-slate-950">Aksi cepat</h2><p className="mt-1 text-[11px] font-semibold text-slate-400">Kelola data inti Garda Jakarta.</p></div><ArrowUpRight size={21} className="text-red-500" weight="bold" /></div><div className="mt-5 grid grid-cols-2 gap-2.5"><a href="#units" className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-3 text-[11px] font-black text-blue-700 hover:bg-blue-100">Kelola unit</a><a href="#categories" className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-3 text-[11px] font-black text-amber-700 hover:bg-amber-100">Kelola kategori</a><a href="#users" className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-[11px] font-black text-emerald-700 hover:bg-emerald-100">Kelola pengguna</a><a href="#reports" className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-3 text-[11px] font-black text-violet-700 hover:bg-violet-100">Lihat laporan</a></div></div></section><RecentReports reports={data?.reports || []} /></> : <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm font-bold text-slate-500">Data admin belum tersedia.</div>}</div></div></main>;
}
