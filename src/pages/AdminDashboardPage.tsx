import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Bell, Buildings, ChartDonut, FileText, List, MapPin, ShieldCheck, SignOut, Tag, UsersThree } from "@phosphor-icons/react";
import AppLogo from "../components/branding/AppLogo";
import { ReportListSkeleton } from "../components/LoadingSkeleton";
import { Modal } from "../components/admin/AdminUi";
import { panel, quietButton } from "../components/admin/admin-styles";
import AdminResourcePage from "../components/admin/AdminResourcePage";
import { useAuth } from "../context/useAuth";
import { getDashboard } from "../lib/api";
import type { Resource } from "../lib/admin-api";
import { reportStatusLabels } from "../lib/report-status";
import type { DashboardData, ReportStatus } from "../types";

type Tab = "overview" | Resource;
const tabs = [
  { id: "overview", label: "Overview", icon: ChartDonut },
  { id: "units", label: "Unit polisi", icon: Buildings },
  { id: "categories", label: "Kategori", icon: Tag },
  { id: "users", label: "Pengguna", icon: UsersThree },
  { id: "reports", label: "Laporan", icon: FileText },
] as const;
const colors: Record<ReportStatus, string> = { PENDING: "#6B7280", VERIFIED: "#2563EB", IN_PROGRESS: "#D97706", CLARIFICATION: "#9333EA", RESOLVED: "#16A34A", REJECTED: "#DC2626" };

function Overview({ data, go }: { data: DashboardData; go: (tab: Tab) => void }) {
  const info = data.adminOverview!;
  const cards = [
    ["Unit polisi", info.units, Buildings, "units"], ["Wilayah layanan", info.districts, MapPin, "units"],
    ["Kategori", info.categoriesCount, Tag, "categories"], ["Laporan", info.reports, FileText, "reports"],
    ["Pengguna", info.users, UsersThree, "users"], ["Polisi ditugaskan", info.assignedPolice, ShieldCheck, "users"],
  ] as const;
  const max = Math.max(1, ...info.unitsByReport.map((item) => item.count));
  return <div className="space-y-6">
    <div><h2 className="font-heading text-2xl font-bold">Ringkasan operasional</h2><p className="mt-2 text-sm text-slate-500">Pantau laporan dan penugasan seluruh unit Garda Jakarta.</p></div>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{cards.map(([label, value, Icon, target]) =>
      <button key={label} type="button" onClick={() => go(target)} className={panel + " p-4 text-left transition hover:border-red-300"}>
        <span className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-600"><Icon size={21} weight="duotone" /></span>
        <strong className="block font-heading text-3xl font-bold">{value.toLocaleString("id-ID")}</strong><span className="mt-1 block text-xs text-slate-500">{label}</span>
      </button>)}</div>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className={panel + " p-5"}><h3 className="font-bold">Status laporan</h3><p className="mt-1 text-xs text-slate-500">Distribusi seluruh laporan.</p>
        <div className="mt-6 space-y-4">{(Object.keys(colors) as ReportStatus[]).map((status) => {
          const count = info.statuses.find((item) => item.status === status)?.count || 0;
          return <div key={status}><div className="mb-2 flex justify-between gap-4 text-xs"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full" style={{ background: colors[status] }} />{reportStatusLabels[status]}</span><strong>{count}</strong></div>
            <div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ background: colors[status], width: (info.reports ? count / info.reports * 100 : 0) + "%" }} /></div></div>;
        })}</div>
      </section>
      <section className={panel + " p-5"}><h3 className="font-bold">Laporan per unit</h3><p className="mt-1 text-xs text-slate-500">Unit dengan laporan terbanyak.</p>
        <div className="mt-6 space-y-4">{info.unitsByReport.slice(0, 6).map((item) => <div key={item.name}><div className="mb-2 flex justify-between gap-3 text-xs"><span className="min-w-0 truncate">{item.name}</span><strong>{item.count}</strong></div><div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-red-500" style={{ width: item.count / max * 100 + "%" }} /></div></div>)}
          {!info.unitsByReport.length && <p className="text-sm text-slate-500">Belum ada laporan.</p>}
        </div>
      </section>
    </div>
    <section className={panel + " p-5"}><h3 className="mb-4 font-bold">Akses cepat</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{tabs.slice(1).map(({ id, label, icon: Icon }) => <button key={id} onClick={() => go(id)} className={quietButton + " justify-start"}><Icon size={18} />Kelola {label.toLowerCase()}</button>)}</div></section>
  </div>;
}

export default function AdminDashboardPage() {
  const { user, signOut } = useAuth();
  const [params, setParams] = useSearchParams();
  const active = tabs.find((tab) => tab.id === params.get("tab")) || tabs[0];
  const [drawer, setDrawer] = useState(false), [notifications, setNotifications] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null), [error, setError] = useState("");
  const [revision, setRevision] = useState(0), [loading, setLoading] = useState(true), [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    let live = true;
    getDashboard().then((result) => { if (live) { setData(result); setError(""); } }).catch((reason: Error) => { if (live) setError(reason.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [revision]);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const change = () => { if (query.matches) setDrawer(false); };
    query.addEventListener("change", change); return () => query.removeEventListener("change", change);
  }, []);
  const go = (tab: Tab) => { setParams(tab === "overview" ? {} : { tab }); setDrawer(false); };
  async function exit() {
    setSigningOut(true);
    try { await signOut(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Gagal keluar."); setDrawer(false); } finally { setSigningOut(false); }
  }
  const navigation = <nav aria-label="Navigasi admin" className="grid gap-1">{tabs.map(({ id, label, icon: Icon }) =>
    <button key={id} type="button" aria-current={id === active.id ? "page" : undefined} onClick={() => go(id)} className={"flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold " + (id === active.id ? "bg-red-50 text-red-700" : "text-slate-600 hover:bg-slate-50")}><Icon size={20} weight={id === active.id ? "fill" : "regular"} />{label}</button>)}</nav>;
  const account = <div className="mt-auto border-t border-slate-200 pt-5"><strong className="block break-words text-sm">{user?.name}</strong><p className="mt-1 text-xs text-slate-500">Administrator</p><button type="button" disabled={signingOut} onClick={() => void exit()} className={quietButton + " mt-4 w-full justify-start"}><SignOut size={18} />{signingOut ? "Keluar..." : "Keluar"}</button></div>;
  return <div className="min-h-dvh bg-[#f6f7f9] text-slate-900">
    <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col gap-7 overflow-y-auto border-r border-slate-200 bg-white p-5 lg:flex">
      <a href="https://gardajakarta.my.id" aria-label="Garda Jakarta - landing"><AppLogo size={145} /></a><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Menu utama</p>{navigation}{account}
    </aside>
    {drawer && <Modal drawer title="Menu admin" onClose={() => setDrawer(false)}><div className="mb-7"><AppLogo size={140} /></div>{navigation}<div className="mt-auto pt-8">{account}</div></Modal>}
    <div className="min-w-0 lg:pl-60">
      <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-7">
        <div className="flex min-w-0 items-center gap-3"><button type="button" onClick={() => setDrawer(true)} className={quietButton + " lg:hidden"} aria-label="Buka menu admin"><List size={20} /></button><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-widest text-red-600">Garda Jakarta / Admin</p><h1 className="truncate font-heading text-lg font-bold">{active.label}</h1></div></div>
        <div className="flex shrink-0 items-center gap-2"><Link className={quietButton + " hidden sm:inline-flex"} to="/profile">Profile</Link><button type="button" aria-label="Notifikasi" onClick={() => setNotifications(true)} className={quietButton + " rounded-full"}><Bell size={19} /></button></div>
      </header>
      <main className="mx-auto min-w-0 max-w-[1440px] p-4 sm:p-7">
        {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}<button type="button" onClick={() => setRevision((n) => n + 1)} className="ml-3 underline">Coba lagi</button></div>}
        {active.id !== "overview" ? <AdminResourcePage key={active.id} resource={active.id} onChanged={() => setRevision((n) => n + 1)} /> : loading ? <ReportListSkeleton count={3} /> : data?.adminOverview ? <Overview data={data} go={go} /> : <p className="rounded-xl bg-white p-8 text-center text-slate-500">Ringkasan belum tersedia.</p>}
      </main>
    </div>
    {notifications && <Modal title="Notifikasi" onClose={() => setNotifications(false)}><div className="space-y-3">{data?.notifications?.length ? data.notifications.map((item) => <article key={item.id} className="rounded-lg border border-slate-200 p-3"><h3 className="text-sm font-bold">{item.title}</h3><p className="mt-1 break-words text-xs leading-relaxed text-slate-600">{item.body}</p><time className="mt-2 block text-[11px] text-slate-400">{new Date(item.createdAt).toLocaleString("id-ID")}</time></article>) : <p className="text-sm text-slate-500">Belum ada notifikasi.</p>}</div></Modal>}
  </div>;
}
