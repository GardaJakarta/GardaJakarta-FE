import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Bell, Buildings, ChartDonut, FileText, List, Tag, UsersThree, SidebarSimple, UserCircle, SignOut, CaretDown } from "@phosphor-icons/react";
import AppLogo from "../components/branding/AppLogo";
import { ReportListSkeleton } from "../components/LoadingSkeleton";
import { Modal } from "../components/admin/AdminUi";
import { quietButton } from "../components/admin/admin-styles";
import AdminResourcePage from "../components/admin/AdminResourcePage";
import AdminRecordPage from "../components/admin/AdminRecordPage";
import AdminOverview from "../components/admin/AdminOverview";
import { useAuth } from "../context/useAuth";
import { getDashboard } from "../lib/api";
import type { Resource } from "../lib/admin-api";
import type { DashboardData } from "../types";

const tabs = [
  { id: "overview", label: "Overview", icon: ChartDonut },
  { id: "units", label: "Unit polisi", icon: Buildings },
  { id: "categories", label: "Kategori", icon: Tag },
  { id: "users", label: "Pengguna", icon: UsersThree },
  { id: "reports", label: "Laporan", icon: FileText },
] as const;
type Tab = "overview" | Resource;

export default function AdminDashboardPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const route = useParams();
  const active = tabs.find((tab) => tab.id === (route.resource || params.get("tab"))) || tabs[0];
  const [drawer, setDrawer] = useState(false), [notifications, setNotifications] = useState(false), [accountOpen, setAccountOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem("garda-admin-sidebar") === "compact"; } catch { return false; } });
  const [data, setData] = useState<DashboardData | null>(null), [error, setError] = useState("");
  const [revision, setRevision] = useState(0), [loading, setLoading] = useState(true), [signingOut, setSigningOut] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null), accountTrigger = useRef<HTMLButtonElement>(null);
  const compact = collapsed && !drawer;
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
  useEffect(() => {
    if (!accountOpen) return;
    const close = (event: PointerEvent) => { if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { setAccountOpen(false); accountTrigger.current?.focus(); } };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", key); };
  }, [accountOpen]);
  const go = (tab: Tab) => { navigate(tab === "overview" ? "/dashboard" : `/dashboard?tab=${tab}`); setDrawer(false); setAccountOpen(false); };
  const toggleSidebar = () => { const next = !collapsed; setCollapsed(next); try { localStorage.setItem("garda-admin-sidebar", next ? "compact" : "expanded"); } catch { /* Storage can be disabled. */ } };
  async function exit() {
    setSigningOut(true);
    try { await signOut(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Gagal keluar."); } finally { setSigningOut(false); }
  }
  const navigation = <nav aria-label="Navigasi admin" className="grid gap-1">{tabs.map(({ id, label, icon: Icon }) =>
    <button key={id} title={compact ? label : undefined} aria-label={label} type="button" aria-current={id === active.id ? "page" : undefined} onClick={() => go(id)} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold ${compact ? "justify-center" : ""} ${id === active.id ? "bg-red-50 text-red-700" : "text-slate-600 hover:bg-slate-50"}`}><Icon size={20} className="shrink-0" weight={id === active.id ? "fill" : "regular"} />{!compact && label}</button>)}</nav>;
  return <div className="min-h-dvh bg-[#f6f7f9] text-slate-900">
    <aside className={`fixed inset-y-0 left-0 hidden flex-col gap-7 overflow-y-auto border-r border-slate-200 bg-white py-5 transition-[width] lg:flex ${collapsed ? "w-20 px-3" : "w-60 px-5"}`}>
      <a href="https://gardajakarta.my.id" aria-label="Garda Jakarta - landing" className={collapsed ? "mx-auto block w-10 overflow-hidden" : ""}><AppLogo size={collapsed ? 120 : 145} className="max-w-none" /></a>
      {!collapsed && <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Menu utama</p>}{navigation}
      <button type="button" onClick={toggleSidebar} className={quietButton + " mt-auto"} title={collapsed ? "Perbesar sidebar" : "Perkecil sidebar"} aria-label={collapsed ? "Perbesar sidebar" : "Perkecil sidebar"} aria-expanded={!collapsed}><SidebarSimple size={19} />{!collapsed && "Perkecil sidebar"}</button>
    </aside>
    {drawer && <Modal drawer title="Menu admin" onClose={() => setDrawer(false)}><a href="https://gardajakarta.my.id" className="mb-7"><AppLogo size={140} /></a>{navigation}<p className="mt-auto border-t border-slate-100 pt-5 text-xs text-slate-500">Garda Jakarta / Administrator</p></Modal>}
    <div className={`min-w-0 transition-[padding] ${collapsed ? "lg:pl-20" : "lg:pl-60"}`}>
      <header className="sticky top-0 z-20 flex min-h-[72px] items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-7">
        <div className="flex min-w-0 items-center gap-3"><button type="button" onClick={() => setDrawer(true)} className={quietButton + " h-10 w-10 shrink-0 p-0 lg:hidden"} aria-label="Buka menu admin"><List size={20} /></button><div className="min-w-0"><p className="hidden text-[10px] font-bold uppercase tracking-widest text-slate-400 sm:block">Garda Jakarta / Admin</p><h1 className="truncate font-heading text-base font-bold sm:text-lg">{active.label}</h1></div></div>
        <div className="flex shrink-0 items-center gap-3"><button type="button" aria-label="Notifikasi" onClick={() => { setAccountOpen(false); setNotifications(true); }} className={quietButton + " h-10 w-10 rounded-full p-0"}><Bell size={19} /></button>
          <div ref={accountRef} className="relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setAccountOpen(false); }}>
            <button ref={accountTrigger} type="button" aria-label="Menu akun" aria-expanded={accountOpen} aria-controls={accountOpen ? "admin-account-menu" : undefined} onClick={() => setAccountOpen((value) => !value)} className="flex items-center gap-2 rounded-full focus-visible:outline-2 focus-visible:outline-red-600"><span className="grid h-10 w-10 overflow-hidden rounded-full border border-red-100 bg-red-50 text-sm font-bold text-red-700 place-items-center">{user?.image ? <img src={user.image} referrerPolicy="no-referrer" alt="Avatar akun" className="h-full w-full object-cover" /> : user?.name.split(" ").slice(0, 2).map((word) => word[0]).join("") || <UserCircle size={24} />}</span><CaretDown size={13} className="hidden sm:block" /></button>
            {accountOpen && <div id="admin-account-menu" className="absolute right-0 top-12 z-50 w-[min(260px,calc(100vw-32px))] rounded-xl border border-slate-200 bg-white p-2 shadow-xl"><div className="border-b border-slate-100 px-3 py-3"><p className="truncate text-xs font-bold">{user?.name}</p><p className="mt-1 truncate text-[11px] text-slate-500">{user?.email}</p></div><Link className="mt-1 flex items-center gap-2 rounded-lg px-3 py-3 text-xs font-semibold hover:bg-slate-50" to="/profile" onClick={() => setAccountOpen(false)}><UserCircle size={18} />Profile</Link><button type="button" disabled={signingOut} onClick={() => void exit()} className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-xs font-semibold text-red-700 hover:bg-red-50"><SignOut size={18} />{signingOut ? "Keluar..." : "Keluar"}</button></div>}
          </div>
        </div>
      </header>
      <main className="mx-auto min-w-0 max-w-[1440px] p-4 sm:p-7">
        {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}<button type="button" onClick={() => setRevision((n) => n + 1)} className="ml-3 underline">Coba lagi</button></div>}
        {active.id !== "overview" ? route.recordId ? <AdminRecordPage key={`${active.id}-${route.recordId}-${route.action || "detail"}`} resource={active.id} id={route.recordId} edit={route.action === "edit"} onChanged={() => setRevision((n) => n + 1)} /> : <AdminResourcePage key={active.id} resource={active.id} onChanged={() => setRevision((n) => n + 1)} /> : loading ? <ReportListSkeleton count={3} /> : data?.adminOverview ? <AdminOverview data={data} go={go} /> : <p className="rounded-xl bg-white p-8 text-center text-slate-500">Ringkasan belum tersedia.</p>}
      </main>
    </div>
    {notifications && <Modal title="Notifikasi" onClose={() => setNotifications(false)}><div className="space-y-3">{data?.notifications?.length ? data.notifications.map((item) => <article key={item.id} className="rounded-lg border border-slate-200 p-3"><h3 className="text-sm font-bold">{item.title}</h3><p className="mt-1 break-words text-xs leading-relaxed text-slate-600">{item.body}</p><time className="mt-2 block text-[11px] text-slate-400">{new Date(item.createdAt).toLocaleString("id-ID")}</time></article>) : <p className="text-sm text-slate-500">Belum ada notifikasi.</p>}</div></Modal>}
  </div>;
}
