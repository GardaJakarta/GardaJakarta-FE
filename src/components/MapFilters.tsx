import { useEffect, useRef, useState } from "react";
import ReportStatusOptions from "./ReportStatusOptions";
import type { MapFilterState } from "./map-filter-state";
import { defaultMapFilters, mapFilterCount } from "./map-filter-state";
import type { ReportSeverity } from "../types";

export function MapFilterMenu({ value, onChange, categories, publicOnly = false, mobile = false, alignRight = false }: {
  value: MapFilterState;
  onChange: (value: MapFilterState) => void;
  categories: string[];
  publicOnly?: boolean;
  mobile?: boolean;
  alignRight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const count = mapFilterCount(value);
  const visibility = [
    ["showReports", "Penanda laporan"],
    ["showPoliceUnits", "Penanda kantor polisi"],
    ["showSafetyZones", "Polygon area"],
  ] as const;
  return <div ref={ref} className="relative shrink-0">
    <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-haspopup="true" aria-label="Filter peta" className={`inline-flex ${mobile ? "h-8" : "h-9"} items-center justify-center gap-1.5 rounded-lg px-3 text-[10px] font-bold transition-colors ${count ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10m-7 6h4" /></svg>Filter{count > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[#e62428] px-1 text-[9px] text-white">{count}</span>}
    </button>
    {open && <div role="group" aria-label="Filter peta" className={`absolute top-[calc(100%+10px)] z-[80] max-h-[min(65dvh,530px)] w-[min(320px,calc(100vw-24px))] overflow-y-auto rounded-xl border border-slate-100 bg-white p-4 text-left shadow-[0_18px_44px_rgba(15,23,42,0.18)] sm:left-auto sm:right-0 ${alignRight ? "right-0 left-auto" : "left-0 right-auto"}`}>
      <div className="mb-3 flex items-center justify-between"><strong className="text-sm text-slate-900">Filter peta</strong><button type="button" className="text-xs font-bold text-[#e62428]" onClick={() => onChange({ ...defaultMapFilters })}>Reset</button></div>
      <div className="grid gap-3">
        <label className="grid gap-1 text-[11px] font-bold text-slate-600">Kategori<select value={value.category} onChange={(event) => onChange({ ...value, category: event.target.value })} className="min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-[#e62428]"><option value="">Semua kategori</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
        <ReportStatusOptions publicOnly={publicOnly} value={value.status} onChange={(status) => onChange({ ...value, status })} />
        <label className="grid gap-1 text-[11px] font-bold text-slate-600">Keparahan<select value={value.severity} onChange={(event) => onChange({ ...value, severity: event.target.value as ReportSeverity | "" })} className="min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-[#e62428]"><option value="">Semua tingkat</option><option value="P0">Kritis</option><option value="P1">Tinggi</option><option value="P2">Sedang</option><option value="P3">Rendah</option></select></label>
        <fieldset className="grid gap-1 border-t border-slate-100 pt-3"><legend className="text-xs font-bold text-slate-700">Tampilkan di peta</legend>{visibility.map(([key, label]) => <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-red-50"><input type="checkbox" className="h-4 w-4 accent-[#e62428]" checked={value[key]} onChange={(event) => onChange({ ...value, [key]: event.target.checked })} />{label}</label>)}</fieldset>
      </div>
    </div>}
  </div>;
}

export function CurrentLocationButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return <button type="button" onClick={onClick} aria-label="Kembali ke lokasi saya" className={`inline-flex h-9 items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 text-xs font-bold text-slate-700 shadow-lg transition-colors hover:bg-red-50 ${className}`}><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>Current</button>;
}
