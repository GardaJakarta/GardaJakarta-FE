import { useReportCategories } from "../lib/use-report-categories";
import { createPortal } from "react-dom";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import ReportStatusOptions from "./ReportStatusOptions";
import type { MapFilterState } from "./map-filter-state";
import { defaultMapFilters, mapFilterCount } from "./map-filter-state";
import type { ReportSeverity } from "../types";
import type { ReportStatus } from "../types";
import { reportStatusLabels } from "../lib/report-status";

const categoryImages = ["harassment.png", "sexual.png", "theft.png", "robbery.png", "violence.png", "crowd-generated.png", "fraud.png", "facility.png", "other-generated.png"];
const severityLabels: Record<ReportSeverity, string> = { P0: "Kritis", P1: "Tinggi", P2: "Sedang", P3: "Rendah" };
function IllustratedFilterSelect({ label, value, options, onChange, imageFor, owner }: { label: string; value: string; options: string[]; onChange: (value: string) => void; imageFor: (value: string, index: number) => string; owner: string }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 260, maxHeight: 300 });
  const ref = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const choices = ["", ...options];
  const title = (option: string) => option ? (label === "Keparahan" ? severityLabels[option as ReportSeverity] : option) : label === "Kategori" ? "Semua kategori" : "Semua tingkat";
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = ref.current!.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - 16;
      const above = rect.top - 16;
      const height = Math.min(320, Math.max(above, below));
      const width = Math.min(Math.max(rect.width, 270), window.innerWidth - 24);
      setPosition({ top: below >= 320 || below >= above ? rect.bottom + 8 : rect.top - height - 8, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), width, maxHeight: height });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const close = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => { document.removeEventListener("pointerdown", close); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [open]);
  useEffect(() => { if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: "nearest" }); }, [open, active, id]);
  const art = (option: string) => label === "Keparahan"
    ? <span aria-hidden="true" className="h-9 w-9 shrink-0 rounded-lg bg-slate-50" style={{ backgroundImage: "url(/illustrations/categories/severity-sprite.png)", backgroundSize: option ? "200% 200%" : "100% 100%", backgroundPosition: option ? ({ P0: "0% 0%", P1: "100% 0%", P2: "0% 100%", P3: "100% 100%" })[option] : "center" }} />
    : <img src={`/illustrations/categories/${imageFor(option, options.indexOf(option))}`} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />;
  return <div className="grid min-w-0 gap-1 text-[11px] font-bold text-slate-600">
    <span id={`${id}-label`}>{label}</span>
    <button ref={ref} type="button" role="combobox" aria-labelledby={`${id}-label`} aria-controls={id} aria-haspopup="listbox" aria-expanded={open} aria-activedescendant={open ? `${id}-${active}` : undefined} onClick={() => { setActive(Math.max(0, choices.indexOf(value))); setOpen(!open); }} onKeyDown={(event) => {
      if (event.key === "Escape" || event.key === "Tab") { setOpen(false); return; }
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) { event.preventDefault(); setOpen(true); setActive(event.key === "Home" ? 0 : event.key === "End" ? choices.length - 1 : (active + (event.key === "ArrowUp" ? -1 : 1) + choices.length) % choices.length); }
      if (open && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onChange(choices[active]); setOpen(false); }
    }} className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-left text-xs text-slate-800 hover:border-slate-300">
      {value && art(value)}<span className="min-w-0 flex-1 truncate" title={title(value)}>{title(value)}</span><span aria-hidden="true">⌄</span>
    </button>
    {open && createPortal(<div ref={menu} data-filter-owner={owner} id={id} role="listbox" aria-labelledby={`${id}-label`} style={position} className="fixed z-[110] overflow-y-auto rounded-xl border border-slate-100 bg-white p-1.5 shadow-2xl">
      {choices.map((option, index) => <button id={`${id}-${index}`} key={option} type="button" role="option" tabIndex={-1} aria-selected={option === value} onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(option); setOpen(false); ref.current?.focus(); }} className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[11px] ${option === value ? "bg-red-50 text-red-700" : index === active ? "bg-slate-100" : "hover:bg-slate-50"}`}>{art(option)}<span className="min-w-0 flex-1 break-words">{title(option)}</span>{option === value && <span aria-hidden="true">✓</span>}</button>)}
    </div>, document.body)}
  </div>;
}

export function CustomStatusSelect({ value, onChange }: { value: ReportStatus | "ALL"; onChange: (value: ReportStatus | "ALL") => void }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 230 });
  const ref = useRef<HTMLButtonElement>(null);
  const options = ["ALL", ...(Object.keys(reportStatusLabels) as ReportStatus[])];
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => { const rect = ref.current?.getBoundingClientRect(); if (!rect) return; const width = Math.min(230, window.innerWidth - 24); const height = Math.min(280, window.innerHeight - 24); const above = rect.top - 12; setPosition({ top: above >= height ? rect.top - height - 8 : rect.bottom + 8, left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)), width }); };
    update(); window.addEventListener("resize", update); window.addEventListener("scroll", update, true); return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [open]);
  return <div className="relative min-w-0"><button ref={ref} type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-xs font-bold text-slate-800"><span className="truncate">{value === "ALL" ? "Semua status" : reportStatusLabels[value]}</span><span aria-hidden="true">⌄</span></button>{open && createPortal(<div role="listbox" style={{ ...position, maxHeight: "min(280px, calc(100dvh - 24px))" }} className="fixed z-[120] grid gap-1 overflow-y-auto rounded-xl border border-slate-100 bg-white p-1.5 shadow-2xl">{options.map((option) => <button key={option} type="button" role="option" aria-selected={option === value} onClick={() => { onChange(option as ReportStatus | "ALL"); setOpen(false); }} className={`rounded-lg px-3 py-2 text-left text-xs font-semibold ${option === value ? "bg-red-50 text-red-700" : "hover:bg-slate-50"}`}>{option === "ALL" ? "Semua status" : reportStatusLabels[option as ReportStatus]}</button>)}</div>, document.body)}</div>;
}

export function MapFilterMenu({ value, onChange, categories: fallbackCategories, publicOnly = false, mobile = false, alignRight = false }: {
  value: MapFilterState;
  onChange: (value: MapFilterState) => void;
  categories: string[];
  publicOnly?: boolean;
  mobile?: boolean;
  alignRight?: boolean;
}) {
  const categories = useReportCategories(fallbackCategories);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const owner = useId();
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node) && !(event.target as HTMLElement).closest(`[data-filter-owner="${owner}"]`)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open, owner]);
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
    {open && <div role="group" aria-label="Filter peta" className={`absolute top-[calc(100%+10px)] z-[80] max-h-[min(65dvh,530px)] w-[min(320px,calc(100vw-24px))] sm:w-[min(600px,calc(100vw-32px))] overflow-y-auto rounded-xl border border-slate-100 bg-white p-4 text-left shadow-[0_18px_44px_rgba(15,23,42,0.18)] sm:top-auto sm:bottom-[calc(100%+10px)] sm:left-auto sm:right-0 ${alignRight ? "right-0 left-auto" : "left-0 right-auto"}`}>
      <div className="mb-3 flex items-center justify-between"><strong className="text-sm text-slate-900">Filter peta</strong><button type="button" className="text-xs font-bold text-[#e62428]" onClick={() => onChange({ ...defaultMapFilters })}>Reset</button></div>
      <div className="grid min-w-0 gap-5 sm:grid-cols-2">
        <div className="grid min-w-0 content-start gap-4">
          <IllustratedFilterSelect owner={owner} label="Kategori" value={value.category} options={categories} onChange={(category) => onChange({ ...value, category })} imageFor={(name) => categoryImages[fallbackCategories.indexOf(name)] || "other-generated.png"} />
          <ReportStatusOptions publicOnly={publicOnly} value={value.status} onChange={(status) => onChange({ ...value, status })} />
        </div>
        <div className="grid min-w-0 content-start gap-4 sm:border-l sm:border-slate-100 sm:pl-5">
          <IllustratedFilterSelect owner={owner} label="Keparahan" value={value.severity} options={Object.keys(severityLabels)} onChange={(severity) => onChange({ ...value, severity: severity as ReportSeverity | "" })} imageFor={() => "severity-sprite.png"} />
          <fieldset className="grid gap-1 border-t border-slate-100 pt-3"><legend className="text-xs font-bold text-slate-700">Tampilkan di peta</legend>{visibility.map(([key, label]) => <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-red-50"><input type="checkbox" className="h-4 w-4 accent-[#e62428]" checked={value[key]} onChange={(event) => onChange({ ...value, [key]: event.target.checked })} />{label}</label>)}</fieldset>
        </div>
      </div>
    </div>}
  </div>;
}

export function CurrentLocationButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return <button type="button" onClick={onClick} aria-label="Kembali ke lokasi saya" className={`inline-flex h-9 items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 text-xs font-bold text-slate-700 shadow-lg transition-colors hover:bg-red-50 ${className}`}><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>Current</button>;
}
