import { Buildings, FileText, MapPin, ShieldCheck, Tag, UsersThree } from "@phosphor-icons/react";
import { panel } from "./admin-styles";
import { reportStatusLabels } from "../../lib/report-status";
import type { Resource } from "../../lib/admin-api";
import type { DashboardData, ReportStatus } from "../../types";
type Tab = "overview" | Resource;
const colors: Record<ReportStatus, string> = { PENDING: "#6B7280", VERIFIED: "#2563EB", IN_PROGRESS: "#D97706", CLARIFICATION: "#9333EA", RESOLVED: "#16A34A", REJECTED: "#DC2626" };

export default function AdminOverview({ data, go }: { data: DashboardData; go: (tab: Tab) => void }) {
  const info = data.adminOverview!;
  const cards = [
    ["Unit polisi", info.units, Buildings, "units"], ["Wilayah layanan", info.districts, MapPin, "units"],
    ["Kategori", info.categoriesCount, Tag, "categories"], ["Laporan", info.reports, FileText, "reports"],
    ["Pengguna", info.users, UsersThree, "users"], ["Polisi ditugaskan", info.assignedPolice, ShieldCheck, "users"],
  ] as const;
  const max = Math.max(1, ...info.unitsByReport.map((item) => item.count));
  const trend = info.trend || [];
  const peak = Math.max(1, ...trend.map((item) => item.count));
  return <div className="space-y-6">
    <div><h2 className="font-heading text-2xl font-bold">Ringkasan operasional</h2><p className="mt-2 text-sm text-slate-500">Pantau laporan dan penugasan seluruh unit Garda Jakarta.</p></div>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{cards.map(([label, value, Icon, target]) =>
      <button key={label} type="button" onClick={() => go(target)} className={panel + " p-4 text-left transition hover:border-red-300"}>
        <span className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-600"><Icon size={21} weight="duotone" /></span>
        <strong className="block font-heading text-3xl font-bold">{value.toLocaleString("id-ID")}</strong><span className="mt-1 block text-xs text-slate-500">{label}</span>
      </button>)}</div>
    <section className={panel + " p-5 sm:p-6"}><div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold">Tren laporan masuk</h3><p className="mt-1 text-xs text-slate-500">30 hari terakhir, berdasarkan tanggal laporan (WIB).</p></div><strong className="text-xl font-bold">{trend.reduce((sum, item) => sum + item.count, 0)} <span className="text-xs font-normal text-slate-500">laporan</span></strong></div>
      {trend.length ? <><svg viewBox="0 0 800 200" role="img" aria-label="Grafik jumlah laporan masuk selama 30 hari terakhir" className="h-48 w-full sm:h-56" preserveAspectRatio="none">{[0, 1, 2, 3, 4].map((index) => <g key={index}><line x1="30" y1={15 + index * 40} x2="790" y2={15 + index * 40} stroke="#e2e8f0" strokeDasharray="4 4" /><text x="3" y={19 + index * 40} fontSize="10" fill="#64748b">{Math.round(peak * (4 - index) / 4)}</text></g>)}{trend.map((item, index) => <rect key={item.date} x={35 + index * 25} y={175 - item.count / peak * 160} width="14" height={Math.max(1, item.count / peak * 160)} rx="3" fill={item.count ? "#e62428" : "#e2e8f0"}><title>{item.date}: {item.count} laporan</title></rect>)}</svg><div className="flex justify-between pl-7 text-[10px] text-slate-500"><span>{trend[0].date}</span><span>{trend[trend.length - 1].date}</span></div></> : <p className="py-12 text-center text-xs text-slate-500">Data tren belum tersedia.</p>}
    </section>
    <div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
      <section className={panel + " p-5"}><h3 className="font-bold">Status laporan</h3><p className="mt-1 text-xs text-slate-500">Distribusi status saat ini.</p>
        <div className="mx-auto mt-5 grid h-44 w-44 place-items-center rounded-full" style={{ background: `conic-gradient(${(Object.keys(colors) as ReportStatus[]).map((status, index, all) => { const count = info.statuses.find((item) => item.status === status)?.count || 0; const before = all.slice(0, index).reduce((sum, item) => sum + (info.statuses.find((row) => row.status === item)?.count || 0), 0); const total = Math.max(1, info.reports); return `${colors[status]} ${before / total * 360}deg ${(before + count) / total * 360}deg`; }).join(", ")})` }}><div className="grid h-28 w-28 place-items-center rounded-full bg-white"><strong className="font-heading text-3xl">{info.reports}</strong><span className="-mt-2 text-[10px] text-slate-400">laporan</span></div></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">{(Object.keys(colors) as ReportStatus[]).map((status) => {
          const count = info.statuses.find((item) => item.status === status)?.count || 0;
          return <div key={status} className="flex items-center justify-between gap-3 text-xs"><span className="flex min-w-0 items-center gap-2"><i className="h-2 w-2 shrink-0 rounded-full" style={{ background: colors[status] }} />{reportStatusLabels[status]}</span><strong>{count}</strong></div>;
        })}</div>
      </section>
      <section className={panel + " p-5"}><h3 className="font-bold">Laporan per unit</h3><p className="mt-1 text-xs text-slate-500">Unit dengan laporan terbanyak.</p>
        <div className="mt-6 space-y-4">{info.unitsByReport.slice(0, 6).map((item) => <div key={item.name}><div className="mb-2 flex justify-between gap-3 text-xs"><span className="min-w-0 truncate">{item.name}</span><strong>{item.count}</strong></div><div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-red-500" style={{ width: item.count / max * 100 + "%" }} /></div></div>)}
          {!info.unitsByReport.length && <p className="text-sm text-slate-500">Belum ada laporan.</p>}
        </div>
      </section>
    </div>
  </div>;
}
