import MobileDetailSheet from "../components/MobileDetailSheet";
import EvidenceFilePreview from "../components/EvidenceFilePreview";
import ReportConversation from "../components/ReportConversation";
import ReportStatusOptions from "../components/ReportStatusOptions";
import { defaultReportStatuses } from "../lib/report-status";
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import GardaMap from "../components/GardaMap";
import { CurrentLocationButton, CustomStatusSelect, MapFilterMenu } from "../components/MapFilters";
import { defaultMapFilters, type MapFilterState } from "../components/map-filter-state";
import AppLogo from "../components/branding/AppLogo";
import ImagePreview from "../components/ImagePreview";
import { ReportListSkeleton } from "../components/LoadingSkeleton";
import { useAuth } from "../context/useAuth";
import { createReport, getDashboard, getPublicMap, getReportFeed, updatePoliceReportStatus, uploadReportEvidence } from "../lib/api";
import { portalPaths } from "../lib/portals";
import type { DashboardData, IncidentReport, PoliceUnit, ReportSeverity, ReportStatus } from "../types";

type ViewMode = "map" | "feed";
type StatusFilter = ReportStatus[];
type ReportFormState = { category: string; topic: string; description: string; severity: ReportSeverity; latitude: number; longitude: number };

const statusLabels: Record<ReportStatus, string> = {
  PENDING: "Belum diverifikasi",
  VERIFIED: "Terverifikasi",
  IN_PROGRESS: "Ditindaklanjuti", CLARIFICATION: "Butuh klarifikasi",
  RESOLVED: "Selesai",
  REJECTED: "Ditolak",
};
const statusGlyphs: Record<ReportStatus, string> = { PENDING: "•", VERIFIED: "✓", IN_PROGRESS: "↗", CLARIFICATION: "?", RESOLVED: "✓", REJECTED: "×" };
const statusShortLabels: Record<ReportStatus, string> = { PENDING: "Masuk", VERIFIED: "Terverifikasi", IN_PROGRESS: "Diproses", CLARIFICATION: "Butuh klarifikasi", RESOLVED: "Selesai", REJECTED: "Ditolak" };
const severityLabels: Record<ReportSeverity, string> = { P0: "Kritis", P1: "Tinggi", P2: "Sedang", P3: "Rendah" };
const severityGlyphs: Record<ReportSeverity, string> = { P0: "!", P1: "!", P2: "•", P3: "–" };
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
const EMPTY_REPORTS: DashboardData["reports"] = [];
type SafetySelection = { reports: IncidentReport[]; level: string; score: number };
type LocalNotification = { id: string; title: string; body: string; createdAt: number };
type LocationSearchResult = { id: string; label: string; subtitle: string; latitude: number; longitude: number };

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
    : <span className={`grid ${size} place-items-center rounded-full border border-red-100 bg-red-50 text-[#e62428]`} aria-hidden="true"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></svg></span>;
}

function StatusBadge({ status }: { status: ReportStatus }) {
  const colors: Record<ReportStatus, string> = { PENDING: "bg-amber-50 text-amber-700", VERIFIED: "bg-sky-50 text-sky-700", IN_PROGRESS: "bg-orange-50 text-orange-700", CLARIFICATION: "bg-amber-50 text-amber-800", RESOLVED: "bg-emerald-50 text-emerald-700", REJECTED: "bg-red-50 text-red-700" };
  const borders: Record<ReportStatus, string> = { PENDING: "border-amber-100", VERIFIED: "border-sky-100", IN_PROGRESS: "border-orange-100", CLARIFICATION: "border-amber-100", RESOLVED: "border-emerald-100", REJECTED: "border-red-100" };
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${borders[status]} ${colors[status]}`}><span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-current text-[9px] leading-none text-white" aria-hidden="true">{statusGlyphs[status]}</span>{statusLabels[status]}</span>;
}

function SeverityBadge({ severity }: { severity: ReportSeverity }) {
  const colors: Record<ReportSeverity, string> = { P0: "bg-red-100 text-red-800", P1: "bg-orange-100 text-orange-800", P2: "bg-amber-100 text-amber-800", P3: "bg-slate-100 text-slate-600" };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${colors[severity]}`}><span aria-hidden="true">{severityGlyphs[severity]}</span>{severityLabels[severity]}</span>;
}

function Chevron({ open }: { open: boolean }) {
  return <svg className={`h-4 w-4 fill-none stroke-current stroke-[1.8] transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;
}

function FilterIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 5h16v2H4V5Zm3 6h10v2H7v-2Zm3 6h4v2h-4v-2Z" /></svg>;
}

function MapModeIcon() {
  return <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Z" /><path d="M9 3v15M15 6v15" /></svg>;
}

function FeedModeIcon() {
  return <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h9" /></svg>;
}

function PinIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z" /><circle cx="12" cy="9" r="2.3" /></svg>;
}

function ListIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h9" /></svg>;
}

function TicketIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 3h10v18H7z" /><path d="M9.5 7h5M9.5 11h5M9.5 15h3" /></svg>;
}

function NotificationIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></svg>;
}

function PlusIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
}

function CloseIcon({ className = "h-4 w-4" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>;
}

function StatIcon({ kind }: { kind: "total" | "pending" | "progress" | "done" }) {
  const paths = {
    total: <><circle cx="12" cy="12" r="8" /><path d="M12 8v8M8 12h8" /></>,
    pending: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2" /></>,
    progress: <><path d="M5 18V9M12 18V5M19 18v-7" /><path d="M3 18h18" /></>,
    done: <><circle cx="12" cy="12" r="8" /><path d="m8 12 2.5 2.5L16 9" /></>,
  };
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}

type SpritePosition = `${number}% ${number}%`;
type CategoryOption = { value: string; description: string; illustration: SpritePosition };

const categoryOptions: CategoryOption[] = [
  { value: categories[0], illustration: "0% 0%", description: "Catcalling, siulan, atau komentar mengganggu." },
  { value: categories[1], illustration: "50% 0%", description: "Pelecehan atau kekerasan seksual." },
  { value: categories[2], illustration: "100% 0%", description: "Pencurian, jambret, atau kehilangan barang." },
  { value: categories[3], illustration: "0% 50%", description: "Begal, perampokan, atau ancaman di jalan." },
  { value: categories[4], illustration: "50% 50%", description: "Pemukulan, penganiayaan, atau ancaman fisik." },
  { value: categories[5], illustration: "100% 50%", description: "Tawuran, kerumunan, atau situasi berbahaya." },
  { value: categories[6], illustration: "0% 100%", description: "Penipuan, pemerasan, atau transaksi mencurigakan." },
  { value: categories[7], illustration: "50% 100%", description: "Lampu, fasilitas, atau ruang publik yang tidak aman." },
  { value: categories[8], illustration: "100% 100%", description: "Hal lain yang perlu diketahui petugas." },
];

const categoryIllustrations: Record<string, string> = {
  [categories[0]]: "/illustrations/categories/harassment.png",
  [categories[1]]: "/illustrations/categories/sexual.png",
  [categories[2]]: "/illustrations/categories/theft.png",
  [categories[3]]: "/illustrations/categories/robbery.png",
  [categories[4]]: "/illustrations/categories/violence.png",
  [categories[5]]: "/illustrations/categories/crowd-generated.png",
  [categories[6]]: "/illustrations/categories/fraud.png",
  [categories[7]]: "/illustrations/categories/facility.png",
  [categories[8]]: "/illustrations/categories/other2.png",
};

function CategoryIllustration({ category, className = "h-10 w-10" }: { category: string; className?: string }) {
  return <img src={categoryIllustrations[category] || categoryIllustrations[categories[8]]} alt="" aria-hidden="true" className={`${className} shrink-0 rounded-xl object-cover shadow-sm ring-1 ring-black/5`} />;
}

function IllustrationTile({ sprite, position, className = "h-10 w-10" }: { sprite: "categories" | "severity"; position: SpritePosition; className?: string }) {
  if (sprite === "categories") {
    const categoryByPosition: Record<SpritePosition, string> = {
      "0% 0%": categoryIllustrations[categories[0]], "50% 0%": categoryIllustrations[categories[1]], "100% 0%": categoryIllustrations[categories[2]],
      "0% 50%": categoryIllustrations[categories[3]], "50% 50%": categoryIllustrations[categories[4]], "100% 50%": categoryIllustrations[categories[5]],
      "0% 100%": categoryIllustrations[categories[6]], "50% 100%": categoryIllustrations[categories[7]], "100% 100%": categoryIllustrations[categories[8]],
    };
    return <img src={categoryByPosition[position]} alt="" aria-hidden="true" className={`${className} shrink-0 rounded-xl object-cover shadow-sm ring-1 ring-black/5`} />;
  }
  return <span className={`${className} shrink-0 rounded-xl bg-cover bg-no-repeat shadow-sm ring-1 ring-black/5`} style={{ backgroundImage: `url(/illustrations/categories/${sprite}-sprite.png)`, backgroundPosition: position, backgroundSize: "200% 200%" }} aria-hidden="true" />;
}

function GardaMark({ className = "h-5 w-5" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 100 120" fill="none" aria-hidden="true"><path d="M90 70.4941C89.9998 92.3127 72.0913 110 50 110V98.8887C66.5685 98.8887 80 85.6228 80 69.2588V39.6299H90V70.4941Z" fill="currentColor" /><path d="M50 21.1113H20V58.1484C20.0002 74.5123 33.4316 87.7773 50 87.7773V98.8887C27.9086 98.8887 10.0001 81.2014 10 59.3828V10H50V21.1113Z" fill="currentColor" /><path d="M90 32.2227H50V80.3701C37.5737 80.3701 27.5002 70.4213 27.5 58.1484V28.5186H50V21.1113H90V32.2227Z" fill="currentColor" /></svg>;
}

type FloatingMenuStyle = { top: number; left: number; width: number };

function useFloatingMenu(open: boolean, anchorRef: React.RefObject<HTMLElement | null>, menuRef: React.RefObject<HTMLElement | null>, estimatedHeight: number, onClose: () => void) {
  const [style, setStyle] = useState<FloatingMenuStyle | null>(null);
  const update = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const gap = 8;
    const opensAbove = rect.bottom + gap + estimatedHeight > window.innerHeight && rect.top - gap - estimatedHeight >= 8;
    setStyle({ top: opensAbove ? Math.max(8, rect.top - estimatedHeight - gap) : Math.min(window.innerHeight - 8, rect.bottom + gap), left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)), width: rect.width });
  }, [anchorRef, estimatedHeight]);
  useEffect(() => {
    if (!open) return;
    update();
    const refresh = () => update();
    window.addEventListener("resize", refresh);
    window.addEventListener("scroll", refresh, true);
    return () => { window.removeEventListener("resize", refresh); window.removeEventListener("scroll", refresh, true); };
  }, [open, update]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!anchorRef.current?.contains(target) && !menuRef.current?.contains(target)) onClose();
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [anchorRef, menuRef, onClose, open]);
  return style;
}

function CategoryMenu({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, categoryOptions.findIndex((option) => option.value === value)));
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = categoryOptions.find((option) => option.value === value);
  const activeOptionId = `report-category-option-${activeIndex}`;
  const menuStyle = useFloatingMenu(open, ref, menuRef, 440, () => setOpen(false));
  useEffect(() => {
    if (open) document.getElementById(activeOptionId)?.scrollIntoView({ block: "nearest" });
  }, [activeOptionId, open]);
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape") { setOpen(false); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => open ? (current + (event.key === "ArrowDown" ? 1 : -1) + categoryOptions.length) % categoryOptions.length : Math.max(0, categoryOptions.findIndex((option) => option.value === value)));
      return;
    }
    if (event.key === "Home" || event.key === "End") { event.preventDefault(); setOpen(true); setActiveIndex(event.key === "Home" ? 0 : categoryOptions.length - 1); return; }
    if (event.key === "Tab") { setOpen(false); return; }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) { onChange(categoryOptions[activeIndex].value); setOpen(false); }
      else setOpen(true);
    }
  };
  return <div ref={ref} className="relative">
    <button type="button" role="combobox" aria-expanded={open} aria-controls="report-category-options" aria-activedescendant={open ? activeOptionId : undefined} aria-haspopup="listbox" onKeyDown={handleKeyDown} onClick={() => setOpen((current) => !current)} className={`flex min-h-11 w-full items-center gap-3 rounded-sm border bg-white px-3 text-left text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-red-100 ${open ? "border-[#e62428] shadow-[0_0_0_3px_rgba(230,36,40,0.08)]" : "border-gray-200 hover:border-gray-300"}`}>
      {selected ? <IllustrationTile sprite="categories" position={selected.illustration} className="h-9 w-9 rounded-xl" /> : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#fff0ed] text-[#e62428]"><GardaMark className="h-4 w-4" /></span>}
      <span className="min-w-0 flex-1 py-2 text-gray-900">{selected?.value || "Pilih kategori kejadian"}</span>
      <Chevron open={open} />
    </button>
    {open && menuStyle && createPortal(<div ref={menuRef} id="report-category-options" role="listbox" aria-label="Kategori laporan" style={{ ...menuStyle, position: "fixed" }} className="z-[100] max-h-[min(66vh,430px)] overflow-y-auto rounded-2xl border border-gray-100 bg-white p-1.5 shadow-[0_22px_60px_rgba(15,23,42,0.2)]">
      <div className="mb-1.5 flex items-center gap-3 border-b border-gray-100 bg-gray-50 px-2.5 py-2.5"><AppLogo className="h-6 w-auto shrink-0" size={145} aria-label="Garda Jakarta" /><div className="min-w-0 border-l border-gray-200 pl-3"><strong className="block text-[10px] font-black uppercase tracking-[.14em] text-gray-900">Kategori laporan</strong><span className="mt-0.5 block truncate text-[10px] font-semibold text-gray-400">Pilih jenis kejadian.</span></div></div>
      <div className="space-y-1">
        {categoryOptions.map((option, index) => <button id={`report-category-option-${index}`} key={option.value} type="button" role="option" tabIndex={-1} aria-selected={value === option.value} onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(option.value); setActiveIndex(index); setOpen(false); }} className={`flex min-h-12 w-full items-center gap-3 rounded-sm border-l-2 px-2 py-1.5 text-left transition-colors ${value === option.value ? "border-[#e62428] bg-[#fff1ef] text-[#b21e24]" : activeIndex === index ? "border-gray-300 bg-gray-50 text-gray-900" : "border-transparent text-gray-700 hover:bg-gray-50"}`}>
          <IllustrationTile sprite="categories" position={option.illustration} className={`h-12 w-12 rounded-xl transition-transform ${value === option.value ? "scale-105 shadow-md" : ""}`} />
          <span className="min-w-0 flex-1"><strong className="block text-[11px] font-black leading-snug">{option.value}</strong><span className="mt-0.5 block text-[10px] font-medium text-gray-500">{option.description}</span></span>
          {value === option.value && <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#e62428] text-[11px] font-black text-white">✓</span>}
        </button>)}
      </div>
    </div>, document.body)}
  </div>;
}

function SeverityMenu({ value, onChange }: { value: ReportSeverity; onChange: (value: ReportSeverity) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuStyle = useFloatingMenu(open, ref, menuRef, 230, () => setOpen(false));
  const severityPositions: Record<ReportSeverity, SpritePosition> = { P0: "0% 0%", P1: "100% 0%", P2: "0% 100%", P3: "100% 100%" };
  return <div ref={ref} className="relative">
    <button type="button" role="combobox" aria-expanded={open} aria-haspopup="listbox" onClick={() => setOpen((current) => !current)} className="flex h-12 w-full items-center gap-3 rounded-sm border border-gray-200 bg-white px-3 text-left text-sm font-bold text-slate-900 transition focus:border-[#e62428] focus:ring-2 focus:ring-red-100">
      <IllustrationTile sprite="severity" position={severityPositions[value]} className="h-9 w-9 rounded-xl" /><span className="flex-1">{severityLabels[value]}</span><Chevron open={open} />
    </button>
    {open && menuStyle && createPortal(<div ref={menuRef} role="listbox" style={{ ...menuStyle, position: "fixed" }} className="z-[100] rounded-2xl border border-gray-100 bg-white p-1.5 shadow-[0_22px_60px_rgba(15,23,42,0.2)]">{(Object.keys(severityLabels) as ReportSeverity[]).map((option) => <button type="button" role="option" aria-selected={option === value} key={option} onClick={() => { onChange(option); setOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${option === value ? "bg-red-50 text-red-700" : "text-slate-700 hover:bg-slate-50"}`}><IllustrationTile sprite="severity" position={severityPositions[option]} className="h-11 w-11 rounded-xl" /><span className="text-xs font-bold">{severityLabels[option]}</span><span className="ml-auto text-[10px] font-semibold text-slate-400">{option === "P0" ? "Darurat" : option === "P1" ? "Mendesak" : option === "P2" ? "Perlu perhatian" : "Pantau"}</span></button>)}</div>, document.body)}
  </div>;
}

function StatusFilterMenu({ value, onChange, mobile = false, fullWidth = false }: { value: StatusFilter; onChange: (value: StatusFilter) => void; mobile?: boolean; fullWidth?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (event: PointerEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);
  const label = `${value.length} status`;
  return <div ref={ref} className="relative min-w-0 sm:shrink-0">
    <button type="button" onClick={() => setOpen((current) => !current)} className={`inline-flex ${mobile ? `h-8 min-w-0 ${fullWidth ? "w-full" : "px-2"}` : "h-9 px-3"} items-center justify-center gap-1.5 rounded-lg text-[10px] font-bold transition-colors ${value.length === defaultReportStatuses.length ? "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" : "bg-slate-900 text-white"}`} aria-label={`Filter status laporan: ${label}`} aria-expanded={open} aria-haspopup="true"><FilterIcon /><span className="hidden sm:inline">Filter</span><span className="min-w-0 truncate sm:max-w-[100px]">{mobile ? "Filter" : label}</span><Chevron open={open} /></button>
    {open && <div className="absolute left-0 top-[calc(100%+10px)] z-50 w-52 rounded-xl border border-slate-100 bg-white p-2 text-left shadow-[0_18px_44px_rgba(15,23,42,0.16)] md:bottom-[calc(100%+10px)] md:top-auto" role="group" aria-label="Filter status laporan"><ReportStatusOptions value={value} onChange={onChange} /></div>}
  </div>;
}

type DashboardControlsProps = {
  mobile?: boolean;
  view: ViewMode;
  citizen: boolean;
  showActions?: boolean;
  role: DashboardData["role"];
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit?: () => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  listOpen: boolean;
  onToggleList: () => void;
  onCreateReport: () => void;
  onPickLocation: () => void;
  pinMode: boolean;
 
  reportOpen: boolean;
  locationSuggestions?: LocationSearchResult[];
  onSelectLocation?: (location: LocationSearchResult) => void;
  mapFilters: MapFilterState;
  onMapFiltersChange: (value: MapFilterState) => void;
};

function DashboardControls({ mobile = false, view, citizen, showActions = true, role, search, onSearchChange, onSearchSubmit, statusFilter, onStatusFilterChange, listOpen, onToggleList, onCreateReport, onPickLocation, pinMode, reportOpen, locationSuggestions = [], onSelectLocation, mapFilters, onMapFiltersChange }: DashboardControlsProps) {
  const controlRadius = "rounded-lg";
  const input = <div className="relative min-w-0 flex-1">
    <div className={`${mobile ? "h-8" : "min-h-10"} flex min-w-0 items-center gap-2 ${controlRadius} border border-gray-200 bg-gray-50 px-3 py-1 transition-all focus-within:border-[#e62428] focus-within:bg-white focus-within:ring-2 focus-within:ring-red-100`}>
    <svg className="h-4 w-4 shrink-0 text-[#e62428]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
    <input aria-label={view === "map" ? "Cari lokasi" : "Cari isu"} value={search} onChange={(event) => onSearchChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onSearchSubmit?.(); }} placeholder={view === "map" ? "Cari lokasi..." : "Cari isu..."} className="min-w-0 w-full bg-transparent py-1.5 text-xs font-bold text-gray-900 outline-none placeholder:text-gray-400" />
    </div>
    {view === "map" && locationSuggestions.length > 0 && <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border border-gray-100 bg-white p-1.5 text-left shadow-[0_18px_44px_rgba(15,23,42,0.18)] md:bottom-[calc(100%+8px)] md:top-auto" role="listbox" aria-label="Hasil pencarian lokasi"><p className="px-2.5 pb-1.5 pt-1 text-[9px] font-black uppercase tracking-[.15em] text-slate-400">Lokasi ditemukan</p>{locationSuggestions.map((location) => <button key={location.id} type="button" role="option" className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[#fff3f0]" onMouseDown={(event) => event.preventDefault()} onClick={() => onSelectLocation?.(location)}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#e5f7f4] text-[#177b86]"><PinIcon /></span><span className="min-w-0"><strong className="block truncate text-[11px] font-black text-slate-800">{location.label}</strong><span className="mt-0.5 block truncate text-[10px] font-medium text-slate-400">{location.subtitle}</span></span></button>)}</div>}
  </div>;
  const buttonHeight = mobile ? "h-8" : "h-9";
  const pinButton = showActions && citizen && <button type="button" onClick={onPickLocation} className={`inline-flex ${buttonHeight} min-w-0 items-center justify-center gap-1.5 ${controlRadius} px-2 text-[10px] font-black transition-colors ${pinMode ? "bg-[#e62428] text-white shadow-sm" : "border border-gray-100 bg-white text-gray-600 hover:bg-gray-100"}`} aria-label="Tandai lokasi laporan"><PinIcon /><span className={mobile ? "truncate" : "hidden sm:inline"}>{pinMode ? "Pilih" : "Tandai"}</span></button>;
  const listButton = showActions && <button type="button" onClick={onToggleList} className={`inline-flex ${buttonHeight} min-w-0 items-center justify-center gap-1.5 ${controlRadius} px-2 text-[10px] font-black transition-colors ${listOpen ? "bg-gray-900 text-white" : "border border-gray-100 bg-white text-gray-600 hover:bg-gray-100"}`} aria-label="Buka daftar laporan"><ListIcon /><span className={mobile ? "truncate" : "hidden sm:inline"}>{citizen ? "Laporan" : role === "polisi" ? "Antrian" : "Monitoring"}</span></button>;
  const createButton = showActions && citizen && <button type="button" onClick={onCreateReport} className={`inline-flex ${buttonHeight} min-w-0 items-center justify-center gap-1.5 ${controlRadius} px-2 text-[10px] font-black text-white shadow-sm transition-colors ${reportOpen ? "bg-gray-900 hover:bg-gray-800" : "bg-[#e62428] hover:bg-[#c91d22]"}`} aria-label={reportOpen ? "Tutup form laporan" : "Buat laporan"}>{reportOpen ? <CloseIcon /> : <PlusIcon />}<span className={mobile ? "truncate" : "hidden sm:inline"}>{reportOpen ? "Tutup" : "Buat"}</span></button>;

  if (mobile) {
    return <div className="relative flex w-full flex-col gap-1.5">
      {showActions ? <>
        <div className="flex h-8 items-center rounded-lg border border-gray-100 bg-gray-50 px-1 shadow-inner">{input}</div>
        <div className={`grid min-w-0 gap-1 ${citizen ? "grid-cols-4" : "grid-cols-2"}`}>
        {view === "map" ? <MapFilterMenu mobile value={mapFilters} onChange={onMapFiltersChange} categories={categories} publicOnly={citizen} /> : <StatusFilterMenu mobile fullWidth value={statusFilter} onChange={onStatusFilterChange} />}
        {citizen && pinButton}
        {listButton}
        {createButton}
        </div>
      </> : <div className="flex min-w-0 items-center gap-1.5">
        {input}
        {view === "map" ? <MapFilterMenu mobile value={mapFilters} onChange={onMapFiltersChange} categories={categories} publicOnly={citizen} /> : <StatusFilterMenu mobile value={statusFilter} onChange={onStatusFilterChange} />}
      </div>}
    </div>;
  }

  return <div className="flex w-full max-w-[700px] items-center gap-1 rounded-lg border border-gray-100 bg-white px-2 py-1.5 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.18)]">
    {input}
    <span className="h-5 w-px shrink-0 bg-gray-200" aria-hidden="true" />
    {view === "map" ? <MapFilterMenu value={mapFilters} onChange={onMapFiltersChange} categories={categories} publicOnly={citizen} /> : <StatusFilterMenu value={statusFilter} onChange={onStatusFilterChange} />}
    {showActions && citizen && <><span className="h-5 w-px shrink-0 bg-gray-200" aria-hidden="true" />{pinButton}</>}
    {showActions && <><span className="h-5 w-px shrink-0 bg-gray-200" aria-hidden="true" />{listButton}{createButton}</>}
  </div>;
}

function ReportCard({ report, selected, onSelect }: { report: IncidentReport; selected: boolean; onSelect: () => void }) {
  return <motion.article layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`w-full rounded-sm border bg-white text-left shadow-[0_18px_44px_rgba(15,23,42,0.08)] transition-shadow ${selected ? "border-[#e62428]/35 ring-2 ring-red-100" : "border-gray-100 hover:shadow-[0_22px_50px_rgba(15,23,42,0.12)]"}`}>
    <header className="flex items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <CategoryIllustration category={report.category} className="h-10 w-10 rounded-xl" />
        <div className="min-w-0"><strong className="block truncate text-sm font-black text-gray-950">Garda Jakarta</strong><div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5 text-[10px] font-bold text-gray-400"><span>{ageLabel(report.createdAt)}</span><span className="h-1 w-1 rounded-full bg-gray-300" /><span className="max-w-[180px] truncate">{report.policeUnit?.district || "Jakarta"}</span></div></div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5"><StatusBadge status={report.status} /><SeverityBadge severity={report.severity} /></div>
    </header>
    <section className="px-4 pb-3 sm:px-5"><h3 className="line-clamp-2 text-base font-black leading-snug text-gray-950 sm:text-lg">{report.category}</h3>{report.description && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-gray-600">{report.description}</p>}</section>
    <footer className="space-y-3 border-t border-gray-100 px-4 py-3.5 sm:px-5"><button type="button" onClick={onSelect} className="flex h-10 w-full items-center justify-center rounded-full bg-gray-900 px-4 text-xs font-black text-white transition-colors hover:bg-gray-800">Lihat detail</button><div className="grid gap-2 text-xs sm:grid-cols-2"><div className="flex min-w-0 items-center gap-2 rounded-sm bg-gray-50 px-3 py-2.5"><GardaMark className="h-4 w-4 shrink-0 text-[#e62428]" /><span className="truncate font-bold text-gray-700">{report.policeUnit?.name || "Menunggu unit penanganan"}</span></div><div className="flex min-w-0 items-center gap-2 rounded-sm bg-gray-50 px-3 py-2.5"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-red-50 text-[#e62428]"><TicketIcon /></span><span className="truncate font-mono text-[10px] font-bold text-gray-600">{report.ticketNumber}</span></div></div></footer>
  </motion.article>;
}

function AdminReportsTable({ reports, selectedId, onSelect, hasMore, loading, onLoadMore }: { reports: IncidentReport[]; selectedId: string | null; onSelect: (report: IncidentReport) => void; hasMore: boolean; loading: boolean; onLoadMore: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !hasMore || loading || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && !loading) onLoadMore();
    }, { root, rootMargin: "160px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore]);
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 160 && hasMore && !loading) onLoadMore();
  };
  return <div className="overflow-hidden rounded-sm border border-gray-100 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.06)]">
    <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3.5 sm:px-5">
      <div><h2 className="font-heading text-base font-black tracking-tight text-gray-950">Semua laporan</h2><p className="mt-1 text-[10px] font-bold text-gray-400">Pantau laporan yang masuk ke Garda Jakarta.</p></div>
      <span className="rounded-full bg-gray-50 px-2.5 py-1 text-[10px] font-black text-gray-500">{reports.length} tiket</span>
    </div>
    <div ref={scrollRef} className="max-h-[calc(100dvh-350px)] overflow-auto" onScroll={handleScroll}>
      <table className="w-full min-w-[720px] border-collapse text-left text-xs">
        <thead><tr className="border-b border-gray-100 bg-gray-50/70 text-[10px] font-black uppercase tracking-widest text-gray-400"><th className="px-4 py-3 sm:px-5">Laporan</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Keparahan</th><th className="px-4 py-3">Unit</th><th className="px-4 py-3">Diperbarui</th><th className="px-4 py-3" /></tr></thead>
        <tbody>{reports.length === 0 ? <tr><td colSpan={6} className="px-5 py-12 text-center text-xs font-semibold text-gray-400">Belum ada laporan yang sesuai.</td></tr> : reports.map((report) => <tr key={report.id} className={`border-b border-gray-100 last:border-0 transition-colors hover:bg-red-50/30 ${selectedId === report.id ? "bg-red-50/50" : ""}`}>
          <td className="max-w-[300px] px-4 py-3 sm:px-5"><button type="button" onClick={() => onSelect(report)} className="block max-w-full text-left"><strong className="block truncate font-black text-gray-900">{report.category}</strong><span className="mt-1 block truncate font-mono text-[10px] font-bold text-gray-400">{report.ticketNumber}</span></button></td>
          <td className="px-4 py-3"><StatusBadge status={report.status} /></td>
          <td className="px-4 py-3"><SeverityBadge severity={report.severity} /></td>
          <td className="max-w-[180px] px-4 py-3"><span className="block truncate font-bold text-gray-600">{report.policeUnit?.name || "Belum ditentukan"}</span><span className="mt-1 block truncate text-[10px] font-semibold text-gray-400">{report.policeUnit?.district || "Jakarta"}</span></td>
          <td className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold text-gray-500">{formatTime(report.updatedAt)}</td>
          <td className="px-4 py-3"><button type="button" onClick={() => onSelect(report)} className="whitespace-nowrap rounded-full bg-gray-900 px-3 py-2 text-[10px] font-black text-white transition-colors hover:bg-gray-800">Detail</button></td>
        </tr>)}</tbody>
      </table>
      <div ref={sentinelRef} className="h-px" aria-hidden="true" />
      {(hasMore || loading) && <div className="flex items-center justify-center gap-2 border-t border-gray-100 px-4 py-3 text-[10px] font-bold text-slate-400" role="status">{loading ? <div className="w-full"><ReportListSkeleton count={2} /></div> : "Gulir untuk memuat laporan berikutnya"}</div>}
    </div>
  </div>;
}

function InfiniteReportList({ reports, selectedId, onSelect, hasMore, loading, onLoadMore }: { reports: IncidentReport[]; selectedId: string | null; onSelect: (report: IncidentReport) => void; hasMore: boolean; loading: boolean; onLoadMore: () => void }) {
  const [visibleCount, setVisibleCount] = useState(10);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const visibleReports = reports.slice(0, visibleCount);
  useEffect(() => {
    const root = scrollRef.current?.closest("[aria-busy]");
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || (visibleCount >= reports.length && !hasMore) || loading || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && !loading) { if (visibleCount < reports.length) setVisibleCount((count) => count + 10); else if (hasMore) onLoadMore(); }
    }, { root, rootMargin: "160px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore, visibleCount, reports.length]);
  return <div ref={scrollRef} className="flex min-w-0 flex-col gap-4" onScroll={(event) => {
    const target = event.currentTarget;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 160) {
      if (visibleCount < reports.length) setVisibleCount((current) => Math.min(current + 10, reports.length));
      else if (hasMore && !loading) onLoadMore();
    }
  }}>
    {reports.length === 0 ? <div className="mt-8 flex min-h-[260px] flex-col items-center justify-center px-6 text-center"><div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-gray-100 text-gray-400"><img src="/illustrations/stats/total.png" alt="" className="h-14 w-14 rounded-xl" /></div><p className="text-sm font-black text-gray-800">Belum ada laporan</p></div> : visibleReports.map((report) => <ReportCard key={report.id} report={report} selected={selectedId === report.id} onSelect={() => onSelect(report)} />)}
    <div ref={sentinelRef} className="h-px" aria-hidden="true" />
    {(visibleCount < reports.length || hasMore || loading) && <div className="flex items-center justify-center gap-2 py-3 text-[10px] font-bold text-slate-400" role="status">{loading ? <div className="w-full"><ReportListSkeleton count={2} /></div> : "Gulir untuk memuat laporan berikutnya"}</div>}
  </div>;
}

function MyReportsPanel({ reports, selectedId, onSelect, onClose, isDesktop, stats }: { reports: IncidentReport[]; selectedId: string | null; onSelect: (report: IncidentReport) => void; onClose: () => void; isDesktop: boolean; stats: DashboardData["stats"] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ReportStatus | "ALL">("ALL");
  const visibleReports = reports.filter((report) => (status === "ALL" || report.status === status) && (!query.trim() || [report.ticketNumber, report.category, report.description, report.policeUnit?.name, report.policeUnit?.district].filter(Boolean).some((value) => value!.toLowerCase().includes(query.trim().toLowerCase()))));
  const listDragControls = useDragControls();
  const statTiles = [
    ["Total", stats.total, "/illustrations/stats/total.png"],
    ["Masuk", stats.pending, "/illustrations/stats/incoming.png"],
    ["Proses", stats.inProgress, "/illustrations/stats/progress.png"],
    ["Selesai", stats.resolved, "/illustrations/stats/resolved.png"],
  ] as const;
  return <motion.aside drag={isDesktop ? true : "y"} dragControls={listDragControls} dragListener={false} dragMomentum={false} dragElastic={0.06} dragConstraints={isDesktop ? { top: -120, bottom: 120, left: -Math.max(0, window.innerWidth - 440), right: Math.max(0, window.innerWidth - 440) } : { top: -window.innerHeight * 0.5, bottom: 0 }} className={`${isDesktop ? "absolute left-6 top-24 h-[calc(100dvh-120px)] w-[380px]" : "fixed bottom-0 left-0 right-0 h-[86dvh] w-full rounded-t-2xl"} z-[45] overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_22px_65px_rgba(15,23,42,0.2)] active:cursor-grabbing`} aria-label="Daftar laporan saya">
    <div className="flex h-full flex-col">
      <div onPointerDown={(event) => { if (!(event.target as HTMLElement).closest("button")) listDragControls.start(event); }} className="shrink-0 touch-none cursor-move active:cursor-grabbing border-b border-slate-100 px-4 pb-3 pt-4">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-widest text-[#e62428]">Riwayat</p><h2 className="mt-1 text-lg font-bold tracking-tight">Laporan saya</h2><p className="mt-1 text-[10px] font-bold text-slate-400">{visibleReports.length} laporan ditemukan</p></div><button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100" aria-label="Tutup daftar laporan"><CloseIcon /></button></div>
        <div className="mt-3 grid grid-cols-4 gap-1 rounded-lg bg-slate-50 p-1 text-center">{statTiles.map(([label, count, image]) => <div key={label} className="py-1.5"><img src={image} alt="" aria-hidden="true" className="mx-auto mb-1 h-12 w-12 object-contain" /><strong className="block text-sm font-bold">{count}</strong><span className="text-[8px] font-bold uppercase text-slate-400">{label}</span></div>)}</div>
        <div className="mt-3 flex gap-2"><input aria-label="Cari laporan saya" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari laporan..." className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-[#e62428]" /><select aria-label="Filter status laporan saya" value={status} onChange={(event) => setStatus(event.target.value as ReportStatus | "ALL")} className="max-w-32 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold"><option value="ALL">Semua status</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-white p-3">{visibleReports.length === 0 ? <p className="rounded-lg bg-white px-3 py-10 text-center text-xs font-semibold text-slate-400">Belum ada laporan yang sesuai.</p> : visibleReports.map((report) => <ReportCard key={report.id} report={report} selected={selectedId === report.id} onSelect={() => onSelect(report)} />)}</div>
    </div>
  </motion.aside>;
}

function ReportDetail({ report, role, isDesktop, onClose }: { report: IncidentReport; role: DashboardData["role"]; isDesktop: boolean; onClose: () => void; onStatusChange: (status: Exclude<ReportStatus, "PENDING">) => void; updating: boolean }) {
  // Keep the draft pin visible above the mobile sheet so it can be dragged directly.
  const [sheetHeight, setSheetHeight] = useState(45);
  const dragControls = useDragControls();
  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isDesktop) { dragControls.start(event); return; }
    const startY = event.clientY;
    const startHeight = sheetHeight;
    event.currentTarget.setPointerCapture(event.pointerId);
    const target = event.currentTarget;
    const move = (moveEvent: PointerEvent) => setSheetHeight(Math.max(34, Math.min(86, startHeight + (startY - moveEvent.clientY) / window.innerHeight * 100)));
    const end = () => { target.removeEventListener('pointermove', move); target.removeEventListener('pointerup', end); target.removeEventListener('pointercancel', end); };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', end);
  };

  return <motion.aside drag={isDesktop} dragControls={dragControls} dragListener={false} dragMomentum={false} dragElastic={0} dragConstraints={{ left: -Math.max(0, window.innerWidth - 440), right: 8, top: -40, bottom: 24 }} style={{ height: isDesktop ? undefined : `${sheetHeight}dvh` }} className={`${isDesktop ? "absolute right-6 top-[7vh] h-[calc(100dvh-120px)] min-h-[400px] w-[400px] min-w-[320px] max-w-[calc(100vw-2rem)] rounded-sm" : "fixed bottom-0 left-0 right-0 max-h-[88dvh] w-full rounded-t-2xl rounded-b-none"} z-[70] overflow-y-auto border border-slate-100 bg-white p-6 shadow-[0_22px_65px_rgba(15,23,42,0.2)]`} aria-live="polite">{!isDesktop && <div onPointerDown={startDrag} className="-mx-6 -mt-6 mb-4 flex h-8 touch-none cursor-grab items-center justify-center border-b border-slate-100 active:cursor-grabbing"><span className="h-1.5 w-11 rounded-full bg-slate-200" /></div>}<button type="button" onClick={onClose} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-800" aria-label="Tutup detail"><CloseIcon /></button><div onPointerDown={startDrag} className={`flex items-start justify-between gap-4 border-b border-slate-100 pb-4 touch-none ${isDesktop ? "cursor-move active:cursor-grabbing" : ""}`}><div className="pr-8"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={report.status} /><SeverityBadge severity={report.severity} /></div><h2 className="mt-3 text-xl font-bold leading-tight tracking-tight text-slate-950">{report.category}</h2><p className="mt-1 text-[11px] font-semibold text-slate-400">{report.ticketNumber} · diperbarui {formatTime(report.updatedAt)}</p></div></div><div className="mt-5 grid gap-3 text-xs"><div><span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Wilayah penanganan</span><strong className="mt-1 block text-slate-800">{report.policeUnit?.name || "Belum ditentukan"}</strong><span className="mt-0.5 block text-slate-500">{report.policeUnit?.district || "Akan ditentukan oleh petugas"}</span></div><div><span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Lokasi laporan</span><span className="mt-1 block text-slate-600">Area dianonimkan pada tampilan publik · {report.latitude.toFixed(3)}, {report.longitude.toFixed(3)}</span></div>{report.description && <div><span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Kronologi</span><p className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-600">{report.description}</p></div>}</div><ReportConversation key={report.id} reportId={report.id} onStatusChanged={() => window.dispatchEvent(new Event("garda:report-updated"))} />{role === "admin" && <p className="mt-5 border-t border-slate-100 pt-4 text-[10px] leading-relaxed text-slate-400">Data pelapor dan koordinat presisi hanya tersedia sesuai permission. Peta publik menampilkan area yang sudah dianonimkan.</p>}</motion.aside>;
}

function MapInfoPanel({ title, eyebrow, children, onClose, isDesktop }: { title: string; eyebrow: string; children: ReactNode; onClose: () => void; isDesktop: boolean }) {
  const panel = <motion.aside className={`${isDesktop ? "absolute right-6 top-24 w-[360px] max-w-[calc(100vw-24px)] rounded-xl" : "fixed bottom-0 left-0 right-0 rounded-t-2xl"} z-[70] box-border max-h-[72dvh] min-w-0 overflow-x-hidden overflow-y-auto border border-slate-100 bg-white p-5 shadow-[0_22px_65px_rgba(15,23,42,0.2)]`} aria-live="polite">
    <button type="button" onClick={onClose} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100" aria-label="Tutup detail peta"><CloseIcon /></button>
    <p className="pr-10 text-[10px] font-black uppercase tracking-[.16em] text-[#e62428]">{eyebrow}</p>
    <h2 className="mt-1 min-w-0 break-words pr-10 font-heading text-xl font-black tracking-tight text-slate-950">{title}</h2>
    <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 text-xs text-slate-600">{children}</div>
  </motion.aside>;
  return isDesktop ? panel : <MobileDetailSheet onClose={onClose}>{panel}</MobileDetailSheet>;
}

function PoliceMapDetail({ unit, isDesktop, onClose }: { unit: PoliceUnit; isDesktop: boolean; onClose: () => void }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  return <MapInfoPanel title={unit.name} eyebrow="Kantor polisi" isDesktop={isDesktop} onClose={onClose}>
    {unit.photoUrl && <><button type="button" className="group relative block min-w-0 max-w-full overflow-hidden rounded-lg" onClick={() => setPreviewOpen(true)} aria-label={`Lihat foto ${unit.name}`}><img src={unit.photoUrl} alt={unit.name} className="block h-40 w-full max-w-full object-cover transition-transform group-hover:scale-[1.02]" referrerPolicy="no-referrer" /><span className="absolute bottom-2 right-2 rounded-md bg-slate-950/70 px-2 py-1 text-[10px] font-bold text-white">Lihat foto</span></button>{previewOpen && <ImagePreview src={unit.photoUrl} alt={unit.name} onClose={() => setPreviewOpen(false)} />}</>}
    <div><span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Wilayah</span><strong className="mt-1 block text-slate-900">{unit.district}</strong></div>
    <div className="min-w-0"><span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Alamat</span><p className="mt-1 break-words leading-relaxed">{unit.address}</p></div>
    {unit.phone && <div><span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Telepon</span><a className="mt-1 block font-bold text-[#e62428]" href={`tel:${unit.phone}`}>{unit.phone}</a></div>}
    <a className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#e62428] px-4 text-xs font-black text-white transition-colors hover:bg-[#c91d22]" href={`https://www.google.com/maps/dir/?api=1&destination=${unit.latitude},${unit.longitude}`} target="_blank" rel="noreferrer">
      Arahkan ke kantor polisi
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
    </a>
  </MapInfoPanel>;
}

function SafetyMapDetail({ zone, isDesktop, onClose, onSelectReport }: { zone: SafetySelection; isDesktop: boolean; onClose: () => void; onSelectReport: (report: IncidentReport) => void }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<ReportStatus | "ALL">('ALL');
  const visible = zone.reports.filter(r => (status === 'ALL' || r.status === status) && [r.category, r.ticketNumber, r.description].some(value => value?.toLowerCase().includes(query.toLowerCase())));
  return <MapInfoPanel title="Indeks keamanan area" eyebrow="Area laporan" isDesktop={isDesktop} onClose={onClose}>
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-3"><span className="font-bold text-slate-600">Perhatian {zone.level}</span><strong className="text-lg text-slate-950">{zone.score}/4</strong></div>
    <p className="font-semibold text-slate-500">{zone.reports.length} laporan berada di area ini.</p>
    <div className="flex gap-2"><input aria-label="Cari laporan area" placeholder="Cari laporan..." value={query} onChange={e => setQuery(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2" /><CustomStatusSelect value={status} onChange={setStatus} /></div>
    <div className="grid min-w-0 grid-cols-1 gap-2">{visible.length ? visible.map((report) => <button key={report.id} type="button" onClick={() => onSelectReport(report)} className="flex w-full min-w-0 items-center gap-3 rounded-lg border border-slate-100 bg-white px-3 py-3 text-left shadow-sm hover:border-red-100 hover:bg-red-50"><CategoryIllustration category={report.category} className="h-10 w-10 rounded-lg" /><span className="min-w-0 flex-1"><strong title={report.category} className="block truncate text-xs text-slate-900">{report.category}</strong><span className="mt-1 block font-mono text-[10px] text-slate-400">{report.ticketNumber}</span><span className="mt-1 block text-[10px] font-bold text-slate-500">{statusShortLabels[report.status]} · titik laporan {report.latitude.toFixed(3)}, {report.longitude.toFixed(3)}</span></span></button>) : <p className="rounded-lg bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-500">Belum ada laporan terhubung di area ini.</p>}</div>
  </MapInfoPanel>;
}

function ReportForm({ open, isDesktop, form, setForm, evidenceFiles, setEvidenceFiles, pinMode, setPinMode, submitting, onSubmit, onClose, onUseLocation, error }: { open: boolean; isDesktop: boolean; form: ReportFormState; setForm: Dispatch<SetStateAction<ReportFormState>>; evidenceFiles: File[]; setEvidenceFiles: Dispatch<SetStateAction<File[]>>; pinMode: boolean; setPinMode: (value: boolean) => void; submitting: boolean; onSubmit: (event: FormEvent) => void; onClose: () => void; onUseLocation: () => void; error: string | null }) {
  // Leave a clear map strip above the mobile sheet so the draft pin remains draggable.
  const [sheetHeight, setSheetHeight] = useState(68);
  const dragControls = useDragControls();
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const dragMovedRef = useRef(false);
  const heightRef = useRef(sheetHeight);

  useEffect(() => () => resizeCleanupRef.current?.(), []);

  const startResize = (event: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>) => {
    if (isDesktop || event.button !== 0) return;
    event.preventDefault();
    resizeCleanupRef.current?.();
    dragMovedRef.current = false;
    const startY = event.clientY;
    const startHeight = sheetHeight;
    const move = (moveEvent: PointerEvent) => {
      if (Math.abs(moveEvent.clientY - startY) > 4) dragMovedRef.current = true;
      const nextHeight = Math.max(34, Math.min(86, startHeight + ((startY - moveEvent.clientY) / window.innerHeight) * 100));
      heightRef.current = nextHeight;
      setSheetHeight(nextHeight);
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      resizeCleanupRef.current = null;
    };
    const end = () => {
      cleanup();
      if (!dragMovedRef.current) return;
      const value = heightRef.current;
      if (value < 42) { onClose(); return; }
      const snapPoints = [68, 86];
      const snap = snapPoints.reduce((nearest, point) => Math.abs(point - value) < Math.abs(nearest - value) ? point : nearest, snapPoints[0]);
      heightRef.current = snap;
      setSheetHeight(snap);
    };
    resizeCleanupRef.current = cleanup;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  return <AnimatePresence>
    {open && <>
      {!isDesktop && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none fixed inset-0 z-40 bg-gray-950/45 backdrop-blur-[2px]" aria-hidden="true" />}
      <motion.div key={isDesktop ? "desktop-form" : "mobile-form"} initial={isDesktop ? { x: "100%", opacity: 0 } : { y: "100%", opacity: 0 }} animate={{ x: 0, y: 0, opacity: 1 }} exit={isDesktop ? { x: "100%", opacity: 0 } : { y: "100%", opacity: 0 }} transition={{ type: "spring", stiffness: 360, damping: 34 }} className={`pointer-events-none absolute z-50 ${isDesktop ? "right-6 top-24" : "inset-x-0 bottom-0"}`}>
      <motion.aside drag={isDesktop} dragControls={dragControls} dragListener={false} dragMomentum={false} dragElastic={0} dragConstraints={isDesktop ? { left: -Math.max(0, window.innerWidth - 440), right: 8, top: -80, bottom: 8 } : undefined} style={!isDesktop ? { height: `${sheetHeight}dvh` } : undefined} className={`${isDesktop ? "h-[calc(100dvh-120px)] w-[400px] min-w-[320px] max-w-[calc(100vw-2rem)] rounded-sm border border-gray-100" : "max-h-[86dvh] w-full rounded-t-2xl"} pointer-events-auto flex flex-col overflow-hidden bg-white shadow-[0_24px_72px_rgba(15,23,42,0.24)]`} aria-label="Form laporan baru">
        {!isDesktop && <button type="button" onPointerDown={startResize} onClick={() => { if (dragMovedRef.current) { dragMovedRef.current = false; return; } setSheetHeight((height) => height > 78 ? 68 : 86); }} className="flex w-full touch-none justify-center bg-white pb-2 pt-3" aria-label={sheetHeight > 78 ? "Perkecil panel laporan" : "Perbesar panel laporan"}><span className="h-1.5 w-12 rounded-full bg-gray-200" /></button>}
        <div onPointerDown={isDesktop ? (event) => dragControls.start(event) : startResize} className={`flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-6 touch-none ${isDesktop ? "cursor-move py-6 active:cursor-grabbing" : "py-4"}`}>
          <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#e62428]">Laporan warga</p><h2 className="mt-1 font-heading text-xl font-black tracking-tight text-gray-900">Buat laporan</h2><p className="mt-1 text-xs font-semibold text-gray-400">Pilih titik dan ceritakan kejadian.</p></div>
          <button type="button" onClick={onClose} onPointerDown={(event) => event.stopPropagation()} className="grid h-8 w-8 place-items-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900" aria-label="Tutup form"><CloseIcon /></button>
        </div>
        <form id="new-report-form" className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 pb-6 pt-5" onSubmit={onSubmit}>
          <label className="grid gap-2 text-xs font-black tracking-normal text-slate-700">Kategori kejadian <span aria-hidden="true" className="text-[#e62428]">*</span><CategoryMenu value={form.category} onChange={(category) => setForm((current) => ({ ...current, category }))} /></label>
          {form.category === categories[8] && <label className="grid gap-2 text-xs font-black tracking-normal text-slate-700">Judul/topik laporan<input required value={form.topic} onChange={(event) => setForm((current) => ({ ...current, topic: event.target.value }))} placeholder="Contoh: Lampu jalan mati di depan sekolah" className="h-11 rounded-sm border border-gray-200 bg-white px-4 text-sm font-bold normal-case tracking-normal text-slate-900 outline-none transition focus:border-[#e62428] focus:ring-2 focus:ring-red-100" /></label>}
          <label className="grid gap-2 text-xs font-black tracking-normal text-slate-700">Kronologi singkat<textarea required minLength={10} maxLength={2000} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Ceritakan urutan dan kondisi yang terjadi..." className="min-h-32 resize-none rounded-sm border border-gray-200 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-slate-900 outline-none transition focus:border-[#e62428] focus:ring-2 focus:ring-red-100" /><span className="text-[10px] font-medium normal-case tracking-normal text-slate-400">Minimal 10 karakter. Jangan tulis identitas korban atau nomor telepon.</span></label>
          <label className="grid gap-2 text-xs font-black tracking-normal text-slate-700">Foto pendukung<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { const files = Array.from(event.target.files ?? []); if (files.length <= 3 && files.every((file) => file.size <= 5 * 1024 * 1024)) setEvidenceFiles(files); }} className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs file:mr-2 file:rounded-full file:border-0 file:bg-white file:px-3 file:py-2" /><span className="text-[10px] font-medium text-slate-400">Opsional, maksimal 3 foto dan 5 MB per foto.</span></label>{evidenceFiles.length > 0 && <div className="grid grid-cols-3 gap-2">{evidenceFiles.map((file, index) => <EvidenceFilePreview key={`${file.name}-${file.lastModified}`} file={file} onRemove={() => setEvidenceFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} />)}</div>}
          <label className="grid gap-2 text-xs font-black tracking-normal text-slate-700">Tingkat keparahan <span aria-hidden="true" className="text-[#e62428]">*</span><SeverityMenu value={form.severity} onChange={(severity) => setForm((current) => ({ ...current, severity }))} /></label>
          <div className="space-y-2"><p className="text-xs font-black tracking-normal text-slate-700">Lokasi kejadian</p><div className="flex items-center justify-between gap-3 rounded-sm bg-slate-50 px-3 py-3"><div><strong className="block text-xs font-black text-slate-900">Titik laporan</strong><span className="mt-1 block font-mono text-[11px] font-bold text-slate-500">{form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}</span></div><button type="button" onClick={() => setPinMode(!pinMode)} className={`shrink-0 rounded-full px-3 py-2 text-[10px] font-black tracking-wide ${pinMode ? "bg-[#e62428] text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>{pinMode ? "Pilih di peta" : "Ubah titik"}</button></div><button type="button" onClick={onUseLocation} className="text-[10px] font-black tracking-wide text-[#e62428] hover:text-[#b21e24]">Gunakan lokasi saya</button></div>
          {error && <p className="rounded-sm bg-red-50 px-3 py-2 text-xs font-bold normal-case tracking-normal text-red-700" role="alert">{error}</p>}
        </form>
        <div className="shrink-0 border-t border-gray-100 bg-white px-6 py-4"><button type="submit" form="new-report-form" disabled={submitting || !form.category || form.description.trim().length < 10} className="h-12 w-full rounded-full bg-[#e62428] px-4 text-xs font-black tracking-wide text-white transition-colors hover:bg-[#c91d22] disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Mengirim laporan..." : "Kirim laporan"}</button></div>
      </motion.aside>
      </motion.div>
    </>}
  </AnimatePresence>;
}

function FeedView({ reports, role, stats, overview, onSelect, selectedId, selectedReport, onCloseDetail, hasMore, loadingMore, onLoadMore, isLoading }: { reports: IncidentReport[]; role: DashboardData["role"]; stats: DashboardData["stats"]; overview?: DashboardData["adminOverview"]; onSelect: (report: IncidentReport) => void; selectedId: string | null; selectedReport: IncidentReport | null; isDesktop: boolean; onCloseDetail: () => void; onStatusChange: (status: Exclude<ReportStatus, "PENDING">) => void; updating: boolean; hasMore: boolean; loadingMore: boolean; onLoadMore: () => void; isLoading: boolean }) {
  const title = role === "warga" ? "Isu Terkini" : role === "polisi" ? "Antrian unit" : "Monitoring laporan";
  const description = role === "warga" ? `${reports.length} laporan warga` : role === "polisi" ? "Triage laporan dari wilayah unit Anda dan catat status penanganannya." : "Ringkasan laporan dan unit operasional Garda Jakarta.";
  const statCards = [["Total", stats.total, "total", "bg-red-50 text-[#e62428]"], ["Masuk", stats.pending, "pending", "bg-amber-50 text-amber-700"], ["Diproses", stats.inProgress, "progress", "bg-sky-50 text-sky-700"], ["Selesai", stats.resolved, "done", "bg-emerald-50 text-emerald-700"]] as const;
  if (isLoading) return <div className="absolute inset-0 overflow-y-auto bg-[#f3f4f6] px-4 pb-28 pt-40 sm:pt-28"><div className="mx-auto max-w-2xl"><ReportListSkeleton /></div></div>;
  if (selectedReport) return <div className="absolute inset-0 z-10 overflow-y-auto bg-[#f3f4f6] px-4 pb-28 pt-40 sm:pt-28"><article className="mx-auto max-w-2xl rounded-xl bg-white p-6"><button type="button" onClick={onCloseDetail} className="mb-5 text-xs font-bold text-red-600">Kembali ke feed</button><div className="flex gap-2"><StatusBadge status={selectedReport.status} /><SeverityBadge severity={selectedReport.severity} /></div><h1 className="mt-4 break-words text-2xl font-bold">{selectedReport.category}</h1><p className="mt-2 text-xs text-slate-500">{selectedReport.ticketNumber}</p><p className="mt-5 whitespace-pre-wrap break-words text-sm leading-relaxed">{selectedReport.description}</p><ReportConversation key={selectedReport.id} reportId={selectedReport.id} /></article></div>;
  return <div className="absolute inset-0 z-10 overflow-y-auto bg-[#f3f4f6] px-3 pb-28 pt-40 sm:px-5 sm:pb-36 sm:pt-24 md:px-8 md:pt-28" aria-busy={isLoading}><div className={`${role === "admin" ? "max-w-5xl" : "max-w-2xl"} mx-auto w-full`}><div className="mb-4 border-b border-gray-200/70 bg-[#f3f4f6] pb-3"><h1 className="font-heading text-lg font-black tracking-tight text-gray-950">{title}</h1><p className="text-xs font-bold text-gray-400">{description}</p></div>{role !== "warga" && <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{statCards.map(([label, count, icon, color]) => <div key={label} className="rounded-sm border border-gray-100 bg-white p-3"><span className={`mb-2 grid h-8 w-8 place-items-center rounded-xl ${color}`}><StatIcon kind={icon} /></span><span className="text-[10px] font-bold text-gray-400">{label}</span><strong className="mt-1 block text-xl font-black text-gray-900">{count}</strong></div>)}</div>}{role === "admin" && overview && <div className="mb-4 grid gap-3 sm:grid-cols-[1.15fr_.85fr]"><div className="rounded-sm border border-gray-100 bg-white p-4"><h2 className="font-heading text-sm font-black text-gray-900">Ringkasan operasional</h2><div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-sm bg-gray-50 p-3"><span className="block text-[9px] font-bold text-gray-400">Pengguna</span><strong className="mt-1 block text-lg font-black">{overview.users}</strong></div><div className="rounded-sm bg-gray-50 p-3"><span className="block text-[9px] font-bold text-gray-400">Unit polisi</span><strong className="mt-1 block text-lg font-black">{overview.units}</strong></div><div className="rounded-sm bg-gray-50 p-3"><span className="block text-[9px] font-bold text-gray-400">Audit log</span><strong className="mt-1 block text-lg font-black">{overview.auditLogs}</strong></div></div></div><div className="rounded-sm border border-gray-100 bg-white p-4"><h2 className="font-heading text-sm font-black text-gray-900">Kategori terbanyak</h2><div className="mt-3 grid gap-2">{overview.categories.map((category) => <div key={category.name} className="flex items-center justify-between gap-3 text-[11px]"><span className="truncate font-bold text-gray-600">{category.name}</span><span className="rounded-full bg-red-50 px-2 py-1 font-black text-red-700">{category.count}</span></div>)}</div></div></div>}{role === "admin" ? <AdminReportsTable reports={reports} selectedId={selectedId} onSelect={onSelect} hasMore={hasMore} loading={loadingMore} onLoadMore={onLoadMore} /> : <InfiniteReportList reports={reports} selectedId={selectedId} onSelect={onSelect} hasMore={hasMore} loading={loadingMore} onLoadMore={onLoadMore} />}</div>{isLoading && <MapLoadingOverlay label="Memuat laporan Garda Jakarta..." />}</div>;
}

function MapLoadingOverlay({ label = "Memeriksa keamanan Jakarta..." }: { label?: string }) {
  return <div className="pointer-events-none absolute inset-0 z-[35] bg-slate-950/5 p-4 pt-28 backdrop-blur-[1px]" role="status" aria-label={label} aria-live="polite"><div className="mx-auto max-w-2xl"><ReportListSkeleton count={3} /></div></div>;
}

export default function DashboardPage({ publicMode = false }: { publicMode?: boolean }) {
  const { user, signOut } = useAuth();
  const role = publicMode ? "warga" : (user?.role || "warga");
  const citizen = role === "warga";
  const canReport = citizen && !publicMode;
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  const [data, setData] = useState<DashboardData | null>(null);
  const [publicMap, setPublicMap] = useState<{ units: PoliceUnit[]; reports: IncidentReport[]; updatedAt: string } | null>(null);
  const [feedItems, setFeedItems] = useState<IncidentReport[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [notificationItems, setNotificationItems] = useState<LocalNotification[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<ViewMode>(() => {
    if (publicMode) return "map";
    if (user?.role === "admin") return "feed";
    const stored = window.localStorage.getItem("garda.dashboard.viewMode");
    return stored === "feed" ? "feed" : "map";
  });
  const [listOpen, setListOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(defaultReportStatuses);
  const [mapFilters, setMapFilters] = useState<MapFilterState>({ ...defaultMapFilters });
  const [search, setSearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSearchResult[]>([]);
  const [searchedLocation, setSearchedLocation] = useState<LocationSearchResult | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [signoutOpen, setSignoutOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [feedPage, setFeedPage] = useState(1);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<PoliceUnit | null>(null);
  const [selectedZone, setSelectedZone] = useState<SafetySelection | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [followingUser, setFollowingUser] = useState(true);
  const [focusLocation, setFocusLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const popupAnchor = selectedUnit || (selectedZone?.reports.length ? { latitude: selectedZone.reports.reduce((sum, r) => sum + r.latitude, 0) / selectedZone.reports.length, longitude: selectedZone.reports.reduce((sum, r) => sum + r.longitude, 0) / selectedZone.reports.length } : null);
  const accountRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const notifiedRiskReportsRef = useRef(new Set<string>());
  const [form, setForm] = useState<ReportFormState>({ category: "", topic: "", description: "", severity: "P2", latitude: -6.1754, longitude: 106.8272 });
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!accountOpen && !notificationOpen) return;
    const handler = (event: PointerEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) setAccountOpen(false);
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) setNotificationOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [accountOpen, notificationOpen]);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("garda.dashboard.viewMode", view);
  }, [view]);

  useEffect(() => {
    if (publicMode || !citizen || !publicMap?.reports.length || !navigator.geolocation || typeof navigator.geolocation.watchPosition !== "function") return;
    const highRiskReports = publicMap.reports.filter((report) => ["P0", "P1"].includes(report.severity) && report.status !== "RESOLVED" && report.status !== "REJECTED");
    if (!highRiskReports.length) return;
    let disposed = false;
    const notify = (report: IncidentReport) => {
      if (disposed || notifiedRiskReportsRef.current.has(report.id)) return;
      notifiedRiskReportsRef.current.add(report.id);
      const message = `Anda berada dekat area dengan laporan ${report.category.toLowerCase()}.`;
      setNotice(message);
      setNotificationItems((current) => [{ id: report.id, title: "Area perhatian", body: message, createdAt: Date.now() }, ...current.filter((item) => item.id !== report.id)].slice(0, 8));
      if ("Notification" in window) {
        const show = () => { if (!disposed && Notification.permission === "granted") new Notification("Garda Jakarta · Area perhatian", { body: message, tag: `garda-risk-${report.id}` }); };
        if (Notification.permission === "default") void Notification.requestPermission().then(show);
        else show();
      }
    };
    const watchId = navigator.geolocation.watchPosition((position) => {
      const nearest = highRiskReports.find((report) => Math.hypot(report.latitude - position.coords.latitude, report.longitude - position.coords.longitude) <= 0.01);
      if (nearest) notify(nearest);
    }, () => undefined, { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 });
    return () => { disposed = true; if (typeof navigator.geolocation.clearWatch === "function") navigator.geolocation.clearWatch(watchId); };
  }, [citizen, publicMap, publicMode]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const geolocation = navigator.geolocation;
    const updateLocation = (position: GeolocationPosition) => setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    if (typeof geolocation.getCurrentPosition === "function") geolocation.getCurrentPosition(updateLocation, () => undefined, { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 });
    if (typeof geolocation.watchPosition !== "function") return;
    const watchId = geolocation.watchPosition(updateLocation, () => undefined, { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 });
    return () => { if (typeof geolocation.clearWatch === "function") geolocation.clearWatch(watchId); };
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    const [dashboardResult, publicResult, feedResult] = await Promise.allSettled([publicMode ? Promise.resolve(null) : getDashboard(), getPublicMap(), publicMode ? Promise.resolve(null) : getReportFeed(1, 10)]);
    if (publicMode) { setData(null); setFeedItems([]); setError(null); }
    else if (dashboardResult.status === "fulfilled" && dashboardResult.value) { setData(dashboardResult.value); setError(null); }
    else setError("Dashboard belum dapat dimuat. Periksa koneksi lalu coba lagi.");
    if (feedResult.status === "fulfilled" && feedResult.value) {
      // Keep the feed useful when the feed endpoint has no rows but the dashboard does.
      const fallbackReports = dashboardResult.status === "fulfilled" && dashboardResult.value ? dashboardResult.value.reports : [];
      const nextReports = feedResult.value.reports.length ? feedResult.value.reports : fallbackReports;
      setFeedItems(nextReports);
      setFeedPage(feedResult.value.page);
      setFeedHasMore(feedResult.value.reports.length ? feedResult.value.hasMore : false);
    }
    else if (!publicMode) { setFeedItems([]); setFeedPage(1); setFeedHasMore(false); }
    if (publicResult.status === "fulfilled") setPublicMap(publicResult.value);
    else if (publicMode) setError("Peta belum dapat dimuat. Periksa koneksi lalu coba lagi.");
    setIsLoading(false);
  }, [publicMode]);
  // Dashboard data is synchronized with the authenticated API session.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); const refresh = () => { void load(); }; window.addEventListener("garda:report-updated", refresh); return () => window.removeEventListener("garda:report-updated", refresh); }, [load]);

  const reports = data?.reports ?? EMPTY_REPORTS;
  const stats = data?.stats || { total: 0, pending: 0, inProgress: 0, resolved: 0 };
  const matches = useCallback((report: IncidentReport) => {
    const statusMatches = (view === "map" ? mapFilters.status : statusFilter).includes(report.status);
    const categoryMatches = view !== "map" || !mapFilters.category || report.category === mapFilters.category;
    const severityMatches = view !== "map" || !mapFilters.severity || report.severity === mapFilters.severity;
    const query = view === "feed" ? search.trim().toLowerCase() : "";
    const searchMatches = !query || [report.ticketNumber, report.category, report.description, report.policeUnit?.name, report.policeUnit?.district].filter(Boolean).some((value) => value!.toLowerCase().includes(query));
    const visibilityMatches = true;
    return visibilityMatches && statusMatches && categoryMatches && severityMatches && searchMatches;
  }, [mapFilters, search, statusFilter, view]);
  const filteredReports = useMemo(() => reports.filter(matches), [matches, reports]);
  const publicReports = useMemo(() => (publicMap?.reports ?? []).filter((report) => report.status !== "REJECTED" && matches(report)), [matches, publicMap?.reports]);
  const mapReports = citizen ? publicReports : filteredReports;
  const mapUnits = useMemo(() => citizen ? (publicMap?.units ?? data?.units ?? []) : (data?.units ?? []), [citizen, data?.units, publicMap?.units]);
  const feedReports = useMemo(() => {
    const source = citizen ? [...(publicMap?.reports ?? []), ...reports] : feedItems;
    return [...new Map(source.map((report) => [report.id, report])).values()].filter(matches);
  }, [citizen, feedItems, matches, publicMap?.reports, reports]);
  const selectedReport = useMemo(() => [...reports, ...publicReports, ...feedItems].find((report) => report.id === selectedId) ?? null, [feedItems, publicReports, reports, selectedId]);


  useEffect(() => {
    if (view !== "map" || !locationSearch.trim() || locationSearch.trim().length < 2 || (searchedLocation && locationSearch === searchedLocation.label)) return;
    const query = locationSearch.trim().toLowerCase();
    const unitMatches = mapUnits
      .filter((unit) => [unit.name, unit.district, unit.address].some((value) => value.toLowerCase().includes(query)))
      .slice(0, 3)
      .map((unit) => ({ id: `unit-${unit.id}`, label: unit.name, subtitle: unit.address || unit.district, latitude: unit.latitude, longitude: unit.longitude }));
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=4&countrycodes=id&accept-language=id&q=${encodeURIComponent(locationSearch.trim())}`, { signal: controller.signal, headers: { Accept: "application/json" } });
        if (!response.ok) return;
        const results = await response.json() as Array<{ place_id: number; display_name: string; lat: string; lon: string; type?: string }>;
        const remoteMatches = results.map((result) => {
          const parts = result.display_name.split(",").map((part) => part.trim());
          return { id: `place-${result.place_id}`, label: parts.slice(0, 2).join(", "), subtitle: parts.slice(2, 4).join(", ") || result.type || "Lokasi", latitude: Number(result.lat), longitude: Number(result.lon) };
        });
        setLocationSuggestions([...unitMatches, ...remoteMatches].slice(0, 5));
      } catch { /* Ignore aborted or unavailable autocomplete requests. */ }
    }, 320);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [locationSearch, mapUnits, searchedLocation, view]);
  const loadMoreFeed = useCallback(async () => {
    if (loadingMore || !feedHasMore) return;
    setLoadingMore(true);
    try {
      const next = await getReportFeed(feedPage + 1, 10);
      setFeedItems((current) => [...current, ...next.reports]);
      setFeedPage(next.page);
      setFeedHasMore(next.hasMore);
    } catch { setNotice("Laporan berikutnya belum dapat dimuat."); }
    finally { setLoadingMore(false); }
  }, [feedHasMore, feedPage, loadingMore]);

  const openReportForm = useCallback(() => { if (!canReport) return; setView("map"); setSelectedId(null); setFocusLocation({ latitude: form.latitude, longitude: form.longitude }); setReportOpen(true); setPinMode(true); setError(null); }, [canReport, form.latitude, form.longitude]);
  const selectReport = useCallback((report: IncidentReport) => { setFollowingUser(false); setSelectedId(report.id); setListOpen(false); setReportOpen(false); }, []);
  const selectReportFromMap = useCallback((report: IncidentReport) => { setFollowingUser(false); setFocusLocation({ latitude: report.latitude, longitude: report.longitude }); selectReport(report); }, [selectReport]);
  const toggleReportForm = useCallback(() => {
    if (reportOpen) { setReportOpen(false); setPinMode(false); return; }
    openReportForm();
  }, [openReportForm, reportOpen]);
  const handleDraftLocationChange = useCallback((coordinates: { latitude: number; longitude: number }) => {
    setForm((current) => ({ ...current, ...coordinates }));
  }, []);
  const mapClick = useCallback((coordinates: { latitude: number; longitude: number }) => { setForm((current) => ({ ...current, ...coordinates })); setPinMode(false); }, []);
  const searchLocation = useCallback(async () => {
    const query = locationSearch.trim();
    if (!query) return;
    if (locationSuggestions[0]) {
      const location = locationSuggestions[0];
      setLocationSearch(location.label);
      setLocationSuggestions([]);
      setSearchedLocation(location);
      setFocusLocation({ latitude: location.latitude, longitude: location.longitude });
      if (reportOpen) { setForm((current) => ({ ...current, latitude: location.latitude, longitude: location.longitude })); setPinMode(false); }
      setSelectedId(null); setSelectedUnit(null); setSelectedZone(null);
      return;
    }
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=id&accept-language=id&q=${encodeURIComponent(query)}`);
      const result = await response.json() as Array<{ lat: string; lon: string; display_name: string }>;
      const location = result[0];
      if (!location) { setNotice("Lokasi belum ditemukan. Coba nama tempat atau wilayah yang lebih spesifik."); return; }
      const parts = location.display_name.split(",").map((part) => part.trim());
      const selected = { id: `place-${location.lat}-${location.lon}`, label: parts.slice(0, 2).join(", "), subtitle: parts.slice(2, 4).join(", ") || "Lokasi", latitude: Number(location.lat), longitude: Number(location.lon) };
      setFollowingUser(false); setLocationSearch(selected.label); setLocationSuggestions([]); setSearchedLocation(selected); setFocusLocation({ latitude: selected.latitude, longitude: selected.longitude });
      if (reportOpen) { setForm((current) => ({ ...current, latitude: selected.latitude, longitude: selected.longitude })); setPinMode(false); }
      setSelectedId(null); setSelectedUnit(null); setSelectedZone(null);
    } catch { setNotice("Pencarian lokasi belum tersedia. Coba lagi sebentar."); }
  }, [locationSearch, locationSuggestions, reportOpen]);
  const selectLocation = useCallback((location: LocationSearchResult) => {
    setFollowingUser(false); setLocationSearch(location.label); setLocationSuggestions([]); setSearchedLocation(location); setFocusLocation({ latitude: location.latitude, longitude: location.longitude });
    if (reportOpen) { setForm((current) => ({ ...current, latitude: location.latitude, longitude: location.longitude })); setPinMode(false); }
    setSelectedId(null); setSelectedUnit(null); setSelectedZone(null);
  }, [reportOpen]);
  const centerOnUser = useCallback(() => {
    if (!userLocation) {
      if (!navigator.geolocation) { setError("Perangkat ini tidak mendukung lokasi otomatis."); return; }
      navigator.geolocation.getCurrentPosition((position) => {
        const current = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setUserLocation(current); setFollowingUser(true); setFocusLocation(current); setError(null);
      }, () => setError("Lokasi belum tersedia. Izinkan akses lokasi di browser lalu coba lagi."), { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 });
      return;
    }
    setFollowingUser(true);
    setSearchedLocation(null);
    setLocationSearch("");
    setFocusLocation(userLocation);
    setSelectedId(null);
    setSelectedUnit(null);
    setSelectedZone(null);
  }, [userLocation]);
  const clearSearchedLocation = useCallback(() => { setSearchedLocation(null); setFocusLocation(null); setLocationSuggestions([]); setLocationSearch(""); }, []);
  const useLocation = useCallback(() => {
    const geolocation = navigator.geolocation;
    if (!geolocation || typeof geolocation.getCurrentPosition !== "function") { setError("Perangkat ini tidak mendukung lokasi otomatis. Pilih titik langsung di peta."); return; }
    geolocation.getCurrentPosition((position) => { const coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude }; setFollowingUser(true); setForm((current) => ({ ...current, ...coordinates })); setFocusLocation(coordinates); setPinMode(false); setNotice("Lokasi perangkat sudah dipilih."); }, () => setError("Lokasi perangkat belum tersedia. Pilih titik langsung di peta."), { timeout: 5000 });
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSubmitting(true); setError(null); setNotice(null);
    try { const created = await createReport({ ...form, category: form.category === categories[8] && form.topic.trim() ? `Lainnya: ${form.topic.trim()}` : form.category }); for (const file of evidenceFiles) await uploadReportEvidence(created.id, file); setForm((current) => ({ ...current, category: "", topic: "", description: "" })); setEvidenceFiles([]); setReportOpen(false); setPinMode(false); setNotice("Laporan berhasil dikirim dengan status Belum diverifikasi."); await load(); }
    catch { setError("Laporan belum dapat dikirim. Periksa isian lalu coba lagi."); }
    finally { setSubmitting(false); }
  };
  const updateStatus = async (id: string, status: Exclude<ReportStatus, "PENDING">) => { setUpdatingId(id); setError(null); try { await updatePoliceReportStatus(id, status); setNotice("Status laporan diperbarui."); await load(); } catch { setError("Status laporan belum dapat diperbarui."); } finally { setUpdatingId(null); } };
  const handleSignOut = async () => { try { await signOut(); window.location.assign(portalPaths[role].login); } catch { setError("Sesi belum dapat ditutup. Coba lagi."); } finally { setSignoutOpen(false); } };

  return <main className="dashboard-app relative h-[100dvh] min-h-[620px] overflow-hidden bg-[#f3f4f6] text-slate-900">
    <header className="absolute left-1/2 top-2 z-50 flex w-[96%] max-w-5xl -translate-x-1/2 flex-col gap-1.5 rounded-2xl bg-white px-2.5 py-1.5 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.35)] sm:top-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:rounded-full sm:px-4 sm:py-2.5">
      <div className="flex w-full min-w-0 items-center justify-between gap-2 sm:flex-1">
        <div className="flex min-w-0 shrink items-center gap-2 sm:gap-3">
          <a href="https://gardajakarta.my.id" aria-label="Beranda Garda Jakarta" className="group flex min-w-0 shrink-0 items-center"><AppLogo className="h-6 w-auto max-w-[76px] object-contain transition-opacity group-hover:opacity-80 sm:h-9 sm:max-w-none" size={145} aria-label="Garda Jakarta" /></a>
          {role !== "admin" && <div className="flex shrink-0 rounded-full border border-gray-100 bg-gray-50 p-0.5 shadow-inner sm:p-1">
            <button type="button" onClick={() => { setView("map"); setSelectedId(null); setSelectedUnit(null); setSelectedZone(null); setFocusLocation(null); setListOpen(false); setReportOpen(false); }} aria-pressed={view === "map"} className={`flex h-7 min-w-[48px] items-center justify-center gap-1 rounded-full px-1.5 text-[9px] font-black transition-colors sm:h-8 sm:min-w-[74px] sm:gap-1.5 sm:px-3 sm:text-[11px] ${view === "map" ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:bg-white hover:text-gray-900"}`}><MapModeIcon /><span>Map</span></button>
            <button type="button" onClick={() => { setView("feed"); setSelectedId(null); setSelectedUnit(null); setSelectedZone(null); setFocusLocation(null); setListOpen(false); setReportOpen(false); }} aria-pressed={view === "feed"} className={`flex h-7 min-w-[48px] items-center justify-center gap-1 rounded-full px-1.5 text-[9px] font-black transition-colors sm:h-8 sm:min-w-[74px] sm:gap-1.5 sm:px-3 sm:text-[11px] ${view === "feed" ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:bg-white hover:text-gray-900"}`}><FeedModeIcon /><span>Feed</span></button>
          </div>}
        </div>
        {publicMode ? <a href="/login" className="inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-[#e62428] px-3 text-[10px] font-black leading-none text-white shadow-sm transition-colors hover:bg-[#c91d22] sm:h-9 sm:px-4 sm:text-[11px]" aria-label="Masuk sebagai pelapor"><span className="sm:hidden">Masuk</span><span className="hidden sm:inline">Masuk sebagai pelapor</span></a> : <div className="flex shrink-0 items-center gap-1.5"><div ref={notificationRef} className="relative">
          <button type="button" onClick={() => setNotificationOpen((current) => !current)} className="relative grid h-8 w-8 place-items-center rounded-full text-slate-600 transition-colors hover:bg-gray-50 sm:h-9 sm:w-9" aria-label="Buka notifikasi" aria-haspopup="menu" aria-expanded={notificationOpen}><NotificationIcon />{notificationItems.length > 0 && <span className="absolute right-0.5 top-0.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-[#e62428] px-0.5 text-[8px] font-black text-white">{Math.min(notificationItems.length, 9)}</span>}</button>
          {notificationOpen && <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(320px,calc(100vw-24px))] rounded-xl border-2 border-slate-200 bg-white p-2 shadow-2xl" role="menu"><div className="flex items-center justify-between border-b border-gray-100 px-3 py-2.5"><strong className="text-xs">Notifikasi</strong>{notificationItems.length > 0 && <button type="button" className="text-[10px] font-bold text-[#e62428]" onClick={() => setNotificationItems([])}>Bersihkan</button>}</div>{notificationItems.length === 0 ? <p className="px-3 py-5 text-center text-xs font-semibold text-slate-400">Belum ada notifikasi.</p> : <div className="max-h-64 overflow-y-auto">{notificationItems.map((item) => <div key={item.id} className="flex gap-2 border-b border-gray-50 px-3 py-3 last:border-0"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-red-50 text-[#e62428]"><NotificationIcon /></span><div className="min-w-0"><strong className="block text-[11px] font-black text-slate-800">{item.title}</strong><p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">{item.body}</p></div></div>)}</div>}</div>}
        </div><div ref={accountRef} className="relative shrink-0">
          <button type="button" onClick={() => setAccountOpen((current) => !current)} className="inline-flex h-8 w-8 items-center justify-center rounded-full p-0 text-left hover:bg-gray-50 sm:h-auto sm:w-auto sm:gap-2 sm:justify-start sm:px-1.5 sm:py-1" aria-haspopup="menu" aria-expanded={accountOpen}>
            <Avatar name={user?.name || "Garda"} image={user?.image} size="h-8 w-8 sm:h-9 sm:w-9" />
            <span className="hidden max-w-[150px] sm:block"><strong className="block truncate text-[11px] font-bold text-gray-900">{user?.name}</strong><small className="mt-0.5 block text-[9px] font-bold text-[#e62428]">{roleLabel(role)}</small></span>
            <span className="hidden sm:block"><Chevron open={accountOpen} /></span>
          </button>
          {accountOpen && <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 rounded-xl border border-gray-100 bg-white p-2 shadow-2xl" role="menu"><div className="border-b border-gray-100 px-3 py-2.5"><strong className="block truncate text-xs">{user?.name}</strong><span className="mt-1 block truncate text-[10px] text-gray-400">{user?.email}</span></div><a href="/profile" role="menuitem" className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold hover:bg-red-50"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>Profile</a><button type="button" role="menuitem" onClick={() => { setAccountOpen(false); setSignoutOpen(true); }} className="mt-1 flex w-full items-center rounded-lg px-3 py-2.5 text-left text-xs font-bold text-red-700 hover:bg-red-50">Keluar</button></div>}
         </div></div>}
      </div>
      <div className="w-full sm:hidden">
        <DashboardControls mobile view={view} citizen={citizen} showActions={!publicMode} role={role} search={view === "map" ? locationSearch : search} onSearchChange={(value) => { if (view === "map") { setLocationSearch(value); setLocationSuggestions([]); if (searchedLocation) setSearchedLocation(null); } else setSearch(value); }} onSearchSubmit={view === "map" ? searchLocation : undefined} locationSuggestions={locationSuggestions} onSelectLocation={selectLocation} mapFilters={mapFilters} onMapFiltersChange={setMapFilters} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} listOpen={listOpen} onToggleList={() => { setView("map"); setListOpen((current) => !current); setSelectedId(null); }} onCreateReport={toggleReportForm} onPickLocation={() => { if (!reportOpen) openReportForm(); else setPinMode((current) => !current); }} pinMode={pinMode} reportOpen={reportOpen} />
      </div>
    </header>

    <section className="absolute inset-0" aria-label={view === "map" ? "Dashboard peta keamanan Jakarta" : "Feed laporan keamanan Jakarta"}>
      {view === "map" && <>
         <GardaMap popupAnchor={popupAnchor} onPopupPosition={setPopupPosition} className="!h-full !min-h-0" units={mapUnits} reports={mapReports} showReportMarkers={mapFilters.showReports} showPoliceMarkers={mapFilters.showPoliceUnits} showSafetyZones={mapFilters.showSafetyZones} userLocation={userLocation} followUser={followingUser && !focusLocation && !selectedId && !selectedUnit && !selectedZone && !reportOpen} focusLocation={focusLocation} searchedLocation={searchedLocation} onClearSearchedLocation={clearSearchedLocation} draftLocation={form} draftActive={canReport && reportOpen} onDraftLocationChange={handleDraftLocationChange} onMapClick={canReport && reportOpen && pinMode ? mapClick : undefined} onSelectReport={(report) => { setSelectedUnit(null); setSelectedZone(null); selectReportFromMap(report); }} onSelectUnit={(unit) => { setFollowingUser(false); setSelectedId(null); setSelectedZone(null); setFocusLocation({ latitude: unit.latitude, longitude: unit.longitude }); setSelectedUnit(unit); }} onSelectSafetyZone={(zone) => { setFollowingUser(false); setSelectedId(null); setSelectedUnit(null); setSelectedZone(zone); }} />
        {isLoading && <MapLoadingOverlay label="Memeriksa keamanan Jakarta..." />}
      </>}
      <div className="pointer-events-none absolute left-1/2 bottom-6 z-40 hidden w-full -translate-x-1/2 items-center justify-center px-4 sm:flex"><div className="pointer-events-auto w-full max-w-[700px]"><DashboardControls view={view} citizen={citizen} showActions={!publicMode} role={role} search={view === "map" ? locationSearch : search} onSearchChange={(value) => { if (view === "map") { setLocationSearch(value); setLocationSuggestions([]); if (searchedLocation) setSearchedLocation(null); } else setSearch(value); }} onSearchSubmit={view === "map" ? searchLocation : undefined} locationSuggestions={locationSuggestions} onSelectLocation={selectLocation} mapFilters={mapFilters} onMapFiltersChange={setMapFilters} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} listOpen={listOpen} onToggleList={() => { setView("map"); setListOpen((current) => !current); setSelectedId(null); }} onCreateReport={toggleReportForm} onPickLocation={() => { if (!reportOpen) openReportForm(); else setPinMode((current) => !current); }} pinMode={pinMode} reportOpen={reportOpen} /></div></div>
      {view === "map" && <CurrentLocationButton onClick={centerOnUser} className="fixed left-3 bottom-6 z-40 sm:absolute sm:left-4 sm:top-auto sm:bottom-20" />}
      {view === "map" && <>
        {listOpen && <MyReportsPanel reports={reports} selectedId={selectedId} onSelect={selectReport} onClose={() => setListOpen(false)} isDesktop={isDesktop} stats={stats} />}
        {selectedReport && !reportOpen && <ReportDetail report={selectedReport} role={role} isDesktop={isDesktop} onClose={() => { setSelectedId(null); setFocusLocation(null); }} onStatusChange={(status) => void updateStatus(selectedReport.id, status)} updating={updatingId === selectedReport.id} />}
        {isDesktop ? <div className="map-anchored-detail" style={{ left: popupPosition?.x, top: popupPosition?.y, visibility: popupPosition ? "visible" : "hidden" }}>
          {selectedUnit && !reportOpen && <PoliceMapDetail unit={selectedUnit} isDesktop onClose={() => { setSelectedUnit(null); setFocusLocation(null); }} />}
          {selectedZone && !reportOpen && <SafetyMapDetail zone={selectedZone} isDesktop onClose={() => { setSelectedZone(null); setFocusLocation(null); }} onSelectReport={(report) => { setSelectedZone(null); setFocusLocation({ latitude: report.latitude, longitude: report.longitude }); selectReport(report); }} />}
        </div> : <>
          {selectedUnit && !reportOpen && <PoliceMapDetail unit={selectedUnit} isDesktop={false} onClose={() => { setSelectedUnit(null); setFocusLocation(null); }} />}
          {selectedZone && !reportOpen && <SafetyMapDetail zone={selectedZone} isDesktop={false} onClose={() => { setSelectedZone(null); setFocusLocation(null); }} onSelectReport={(report) => { setSelectedZone(null); setFocusLocation({ latitude: report.latitude, longitude: report.longitude }); selectReport(report); }} />}
        </>}
        {canReport && <ReportForm open={reportOpen} isDesktop={isDesktop} form={form} setForm={setForm} evidenceFiles={evidenceFiles} setEvidenceFiles={setEvidenceFiles} pinMode={pinMode} setPinMode={setPinMode} submitting={submitting} onSubmit={(event) => void submit(event)} onClose={() => { setReportOpen(false); setPinMode(false); setFocusLocation(null); }} onUseLocation={useLocation} error={error} />}
      </>}
      {notice && <div className="absolute left-1/2 top-[9.25rem] z-30 w-[calc(100%-32px)] max-w-md -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-3 text-center text-xs font-bold text-white shadow-xl sm:top-24" role="status">{notice}<button type="button" onClick={() => setNotice(null)} className="ml-3 grid h-7 w-7 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white" aria-label="Tutup notifikasi"><CloseIcon className="h-3.5 w-3.5" /></button></div>}
      {error && !reportOpen && <p className="absolute left-1/2 top-[9.25rem] z-30 w-[calc(100%-32px)] max-w-md -translate-x-1/2 rounded-lg bg-red-50 px-4 py-3 text-center text-xs font-bold text-red-700 shadow-lg sm:top-24" role="alert">{error}</p>}
    </section>
    {view === "feed" && <FeedView reports={feedReports} role={role} stats={stats} overview={data?.adminOverview} onSelect={selectReport} selectedId={selectedId} selectedReport={selectedReport} isDesktop={isDesktop} onCloseDetail={() => setSelectedId(null)} onStatusChange={(status) => selectedReport && void updateStatus(selectedReport.id, status)} updating={Boolean(selectedReport && updatingId === selectedReport.id)} hasMore={!citizen && feedHasMore} loadingMore={loadingMore} onLoadMore={() => void loadMoreFeed()} isLoading={isLoading} />}
    {signoutOpen && <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/35 px-5 backdrop-blur-sm" role="presentation"><section className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="signout-title"><h2 id="signout-title" className="text-xl font-bold tracking-tight">Keluar dari dashboard?</h2><p className="mt-2 text-xs leading-relaxed text-slate-500">Sesi di perangkat ini akan ditutup.</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setSignoutOpen(false)} className="rounded-lg px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100">Batal</button><button type="button" onClick={() => void handleSignOut()} className="rounded-lg bg-[#e62428] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#c91d22]">Keluar</button></div></section></div>}
  </main>;
}








