import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import GardaMap from "../components/GardaMap";
import AppLogo from "../components/branding/AppLogo";
import ImagePreview from "../components/ImagePreview";
import { useAuth } from "../context/useAuth";
import { createReport, getDashboard, getPublicMap, getReportFeed, updatePoliceReportStatus } from "../lib/api";
import { portalPaths } from "../lib/portals";
import type { DashboardData, IncidentReport, PoliceUnit, ReportSeverity, ReportStatus } from "../types";

type ViewMode = "map" | "feed";
type StatusFilter = "ALL" | ReportStatus;
type ReportFormState = { category: string; description: string; severity: ReportSeverity; latitude: number; longitude: number };

const statusLabels: Record<ReportStatus, string> = {
  PENDING: "Belum diverifikasi",
  VERIFIED: "Terverifikasi",
  IN_PROGRESS: "Ditindaklanjuti",
  RESOLVED: "Selesai",
  REJECTED: "Ditolak",
};
const statusGlyphs: Record<ReportStatus, string> = { PENDING: "•", VERIFIED: "✓", IN_PROGRESS: "↗", RESOLVED: "✓", REJECTED: "×" };
const statusShortLabels: Record<ReportStatus, string> = { PENDING: "Masuk", VERIFIED: "Terverifikasi", IN_PROGRESS: "Diproses", RESOLVED: "Selesai", REJECTED: "Ditolak" };
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
const statusFilters: StatusFilter[] = ["ALL", "PENDING", "VERIFIED", "IN_PROGRESS", "RESOLVED", "REJECTED"];
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
  const colors: Record<ReportStatus, string> = { PENDING: "bg-amber-50 text-amber-700", VERIFIED: "bg-sky-50 text-sky-700", IN_PROGRESS: "bg-orange-50 text-orange-700", RESOLVED: "bg-emerald-50 text-emerald-700", REJECTED: "bg-red-50 text-red-700" };
  const borders: Record<ReportStatus, string> = { PENDING: "border-amber-100", VERIFIED: "border-sky-100", IN_PROGRESS: "border-orange-100", RESOLVED: "border-emerald-100", REJECTED: "border-red-100" };
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

function CloseIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>;
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

function IllustrationTile({ sprite, position, className = "h-10 w-10" }: { sprite: "categories" | "severity"; position: SpritePosition; className?: string }) {
  return <span className={`${className} shrink-0 rounded-xl bg-cover bg-no-repeat shadow-sm ring-1 ring-black/5`} style={{ backgroundImage: `url(/illustrations/categories/${sprite}-sprite.png)`, backgroundPosition: position, backgroundSize: sprite === "categories" ? "300% 300%" : "200% 200%" }} aria-hidden="true" />;
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
  const label = value === "ALL" ? "Semua status" : statusShortLabels[value];
  return <div ref={ref} className="relative min-w-0 sm:shrink-0">
    <button type="button" onClick={() => setOpen((current) => !current)} className={`inline-flex ${mobile ? `h-8 min-w-0 ${fullWidth ? "w-full" : "px-2"}` : "h-9 px-3"} items-center justify-center gap-1.5 rounded-lg text-[10px] font-bold transition-colors ${value === "ALL" ? "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" : "bg-slate-900 text-white"}`} aria-label={`Filter status laporan: ${label}`} aria-expanded={open} aria-haspopup="listbox"><FilterIcon /><span className="hidden sm:inline">Filter</span><span className="min-w-0 truncate sm:max-w-[100px]">{mobile ? "Filter" : label}</span><Chevron open={open} /></button>
    {open && <div className="absolute left-0 top-[calc(100%+10px)] z-50 w-52 rounded-xl border border-slate-100 bg-white p-2 text-left shadow-[0_18px_44px_rgba(15,23,42,0.16)] md:bottom-[calc(100%+10px)] md:top-auto" role="listbox" aria-label="Filter status laporan"><p className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status laporan</p>{statusFilters.map((option) => <button key={option} type="button" role="option" aria-selected={value === option} onClick={() => { onChange(option); setOpen(false); }} className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-bold transition-colors ${value === option ? "bg-red-50 text-[#b21e24]" : "text-slate-700 hover:bg-slate-50"}`}><span className={`grid h-4 w-4 place-items-center rounded-full border text-[10px] ${value === option ? "border-[#e62428] bg-[#e62428] text-white" : "border-slate-300 text-transparent"}`}>✓</span>{option === "ALL" ? "Semua status" : statusLabels[option]}</button>)}</div>}
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
  activeFilter: boolean;
  reportOpen: boolean;
  locationSuggestions?: LocationSearchResult[];
  onSelectLocation?: (location: LocationSearchResult) => void;
};

function DashboardControls({ mobile = false, view, citizen, showActions = true, role, search, onSearchChange, onSearchSubmit, statusFilter, onStatusFilterChange, listOpen, onToggleList, onCreateReport, onPickLocation, pinMode, activeFilter, reportOpen, locationSuggestions = [], onSelectLocation }: DashboardControlsProps) {
  const controlRadius = "rounded-lg";
  const input = <div className="relative min-w-0 flex-1">
    <div className={`${mobile ? "h-8" : "min-h-10"} flex min-w-0 items-center gap-2 ${controlRadius} border border-gray-200 bg-gray-50 px-3 py-1 transition-all focus-within:border-[#e62428] focus-within:bg-white focus-within:ring-2 focus-within:ring-red-100`}>
    <svg className="h-4 w-4 shrink-0 text-[#e62428]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
    <input aria-label={view === "map" ? "Cari lokasi" : "Cari isu"} value={search} onChange={(event) => onSearchChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onSearchSubmit?.(); }} placeholder={view === "map" ? "Cari lokasi..." : "Cari isu..."} className="min-w-0 w-full bg-transparent py-1.5 text-xs font-bold text-gray-900 outline-none placeholder:text-gray-400" />
    </div>
    {view === "map" && locationSuggestions.length > 0 && <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border border-gray-100 bg-white p-1.5 text-left shadow-[0_18px_44px_rgba(15,23,42,0.18)]" role="listbox" aria-label="Hasil pencarian lokasi"><p className="px-2.5 pb-1.5 pt-1 text-[9px] font-black uppercase tracking-[.15em] text-slate-400">Lokasi ditemukan</p>{locationSuggestions.map((location) => <button key={location.id} type="button" role="option" className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[#fff3f0]" onMouseDown={(event) => event.preventDefault()} onClick={() => onSelectLocation?.(location)}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#e5f7f4] text-[#177b86]"><PinIcon /></span><span className="min-w-0"><strong className="block truncate text-[11px] font-black text-slate-800">{location.label}</strong><span className="mt-0.5 block truncate text-[10px] font-medium text-slate-400">{location.subtitle}</span></span></button>)}</div>}
  </div>;
  const buttonHeight = mobile ? "h-8" : "h-9";
  const pinButton = showActions && citizen && <button type="button" onClick={onPickLocation} className={`inline-flex ${buttonHeight} min-w-0 items-center justify-center gap-1.5 ${controlRadius} px-2 text-[10px] font-black transition-colors ${pinMode ? "bg-[#e62428] text-white shadow-sm" : "border border-gray-100 bg-white text-gray-600 hover:bg-gray-100"}`} aria-label="Tandai lokasi laporan"><PinIcon /><span className={mobile ? "truncate" : "hidden sm:inline"}>{pinMode ? "Pilih" : "Tandai"}</span></button>;
  const listButton = showActions && <button type="button" onClick={onToggleList} className={`inline-flex ${buttonHeight} min-w-0 items-center justify-center gap-1.5 ${controlRadius} px-2 text-[10px] font-black transition-colors ${listOpen ? "bg-gray-900 text-white" : "border border-gray-100 bg-white text-gray-600 hover:bg-gray-100"}`} aria-label="Buka daftar laporan"><ListIcon /><span className={mobile ? "truncate" : "hidden sm:inline"}>{citizen ? "Laporan" : role === "polisi" ? "Antrian" : "Monitoring"}</span>{activeFilter && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[#e62428] px-1 text-[9px] text-white">!</span>}</button>;
  const createButton = showActions && citizen && <button type="button" onClick={onCreateReport} className={`inline-flex ${buttonHeight} min-w-0 items-center justify-center gap-1.5 ${controlRadius} px-2 text-[10px] font-black text-white shadow-sm transition-colors ${reportOpen ? "bg-gray-900 hover:bg-gray-800" : "bg-[#e62428] hover:bg-[#c91d22]"}`} aria-label={reportOpen ? "Tutup form laporan" : "Buat laporan"}>{reportOpen ? <CloseIcon /> : <PlusIcon />}<span className={mobile ? "truncate" : "hidden sm:inline"}>{reportOpen ? "Tutup" : "Buat"}</span></button>;

  if (mobile) {
    return <div className="relative flex w-full flex-col gap-1.5">
      {showActions ? <>
        <div className="flex h-8 items-center rounded-lg border border-gray-100 bg-gray-50 px-1 shadow-inner">{input}</div>
        <div className={`grid min-w-0 gap-1 ${citizen ? "grid-cols-4" : "grid-cols-2"}`}>
        <StatusFilterMenu mobile fullWidth value={statusFilter} onChange={onStatusFilterChange} />
        {citizen && pinButton}
        {listButton}
        {createButton}
        </div>
      </> : <div className="flex min-w-0 items-center gap-1.5">
        {input}
        <StatusFilterMenu mobile value={statusFilter} onChange={onStatusFilterChange} />
      </div>}
    </div>;
  }

  return <div className="flex w-full max-w-[700px] items-center gap-1 rounded-lg border border-gray-100 bg-white px-2 py-1.5 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.18)]">
    {input}
    <span className="h-5 w-px shrink-0 bg-gray-200" aria-hidden="true" />
    <StatusFilterMenu value={statusFilter} onChange={onStatusFilterChange} />
    {showActions && citizen && <><span className="h-5 w-px shrink-0 bg-gray-200" aria-hidden="true" />{pinButton}</>}
    {showActions && <><span className="h-5 w-px shrink-0 bg-gray-200" aria-hidden="true" />{listButton}{createButton}</>}
  </div>;
}

function ReportCard({ report, selected, onSelect }: { report: IncidentReport; selected: boolean; onSelect: () => void }) {
  return <motion.article layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`w-full overflow-hidden rounded-sm border bg-white text-left shadow-[0_18px_44px_rgba(15,23,42,0.08)] transition-shadow ${selected ? "border-[#e62428]/35 ring-2 ring-red-100" : "border-gray-100 hover:shadow-[0_22px_50px_rgba(15,23,42,0.12)]"}`}>
    <header className="flex items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50 text-[#e62428]"><GardaMark className="h-5 w-5" /></span>
        <div className="min-w-0"><strong className="block truncate text-sm font-black text-gray-950">Garda Jakarta</strong><div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5 text-[10px] font-bold text-gray-400"><span>{ageLabel(report.createdAt)}</span><span className="h-1 w-1 rounded-full bg-gray-300" /><span className="max-w-[180px] truncate">{report.policeUnit?.district || "Jakarta"}</span></div></div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5"><StatusBadge status={report.status} /><SeverityBadge severity={report.severity} /></div>
    </header>
    <section className="px-4 pb-3 sm:px-5"><h3 className="text-base font-black leading-snug text-gray-950 sm:text-lg">{report.category}</h3>{report.description && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-gray-600">{report.description}</p>}</section>
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
      {(hasMore || loading) && <div className="flex items-center justify-center gap-2 border-t border-gray-100 px-4 py-3 text-[10px] font-bold text-slate-400" role="status"><span className="garda-loader h-3 w-3" /> {loading ? "Memuat laporan berikutnya..." : "Gulir untuk memuat laporan berikutnya"}</div>}
    </div>
  </div>;
}

function InfiniteReportList({ reports, selectedId, onSelect, hasMore, loading, onLoadMore }: { reports: IncidentReport[]; selectedId: string | null; onSelect: (report: IncidentReport) => void; hasMore: boolean; loading: boolean; onLoadMore: () => void }) {
  const [visibleCount, setVisibleCount] = useState(10);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const visibleReports = reports.slice(0, visibleCount);
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
  return <div ref={scrollRef} className="flex max-h-[calc(100dvh-290px)] flex-col gap-4 overflow-y-auto pr-1" onScroll={(event) => {
    const target = event.currentTarget;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 160) {
      if (visibleCount < reports.length) setVisibleCount((current) => Math.min(current + 10, reports.length));
      else if (hasMore && !loading) onLoadMore();
    }
  }}>
    {reports.length === 0 ? <div className="mt-8 flex min-h-[260px] flex-col items-center justify-center px-6 text-center"><div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-gray-100 text-gray-400"><ListIcon /></div><p className="text-sm font-black text-gray-800">Belum ada laporan</p></div> : visibleReports.map((report) => <ReportCard key={report.id} report={report} selected={selectedId === report.id} onSelect={() => onSelect(report)} />)}
    <div ref={sentinelRef} className="h-px" aria-hidden="true" />
    {(visibleCount < reports.length || hasMore || loading) && <div className="flex items-center justify-center gap-2 py-3 text-[10px] font-bold text-slate-400" role="status"><span className="garda-loader h-3 w-3" /> {loading ? "Memuat laporan berikutnya..." : "Gulir untuk memuat laporan berikutnya"}</div>}
  </div>;
}

function ReportDetail({ report, role, isDesktop, onClose, onStatusChange, updating }: { report: IncidentReport; role: DashboardData["role"]; isDesktop: boolean; onClose: () => void; onStatusChange: (status: Exclude<ReportStatus, "PENDING">) => void; updating: boolean }) {
  // Keep the draft pin visible above the mobile sheet so it can be dragged directly.
  const [sheetHeight, setSheetHeight] = useState(45);
  const [desktopOffset, setDesktopOffset] = useState(0);
  const dragRef = useRef<{ startX: number; startY: number; startOffset: number; startHeight: number } | null>(null);
  const sheetHeightRef = useRef(sheetHeight);
  const desktopOffsetRef = useRef(desktopOffset);

  const updateSheetHeight = (value: number) => {
    sheetHeightRef.current = value;
    setSheetHeight(value);
  };

  const updateDesktopOffset = (value: number) => {
    desktopOffsetRef.current = value;
    setDesktopOffset(value);
  };

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragRef.current = { startX: event.clientX, startY: event.clientY, startOffset: desktopOffset, startHeight: sheetHeight };
    const handleMove = (moveEvent: PointerEvent) => {
      const state = dragRef.current;
      if (!state) return;
      if (isDesktop) {
        updateDesktopOffset(Math.max(-120, Math.min(120, state.startOffset + moveEvent.clientX - state.startX)));
      } else {
        updateSheetHeight(Math.max(48, Math.min(88, state.startHeight + ((state.startY - moveEvent.clientY) / window.innerHeight) * 100)));
      }
    };
    const handleUp = () => {
      const state = dragRef.current;
      dragRef.current = null;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      if (!state) return;
      if (isDesktop) {
        if (desktopOffsetRef.current > 92) onClose();
        else updateDesktopOffset(0);
        return;
      }
      if (sheetHeightRef.current < 50) { onClose(); return; }
      const snapPoints = [56, 72, 86];
      updateSheetHeight(snapPoints.reduce((nearest, point) => Math.abs(point - sheetHeightRef.current) < Math.abs(nearest - sheetHeightRef.current) ? point : nearest, snapPoints[0]));
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  };
  const canUpdate = role === "polisi" && report.status !== "RESOLVED" && report.status !== "REJECTED";
  return <aside style={{ transform: isDesktop ? `translateX(${desktopOffset}px)` : undefined, height: isDesktop ? undefined : `${sheetHeight}dvh` }} className={`${isDesktop ? "absolute right-6 top-[7vh] h-[calc(100dvh-120px)] min-h-[400px] w-[400px] min-w-[320px] max-w-[calc(100vw-2rem)] rounded-sm" : "fixed bottom-0 left-0 right-0 max-h-[88dvh] w-full rounded-t-2xl rounded-b-none"} z-40 overflow-y-auto border border-slate-100 bg-white p-6 shadow-[0_22px_65px_rgba(15,23,42,0.2)]`} aria-live="polite">{!isDesktop && <div onPointerDown={startDrag} className="-mx-6 -mt-6 mb-4 flex h-8 touch-none cursor-grab items-center justify-center border-b border-slate-100 active:cursor-grabbing"><span className="h-1.5 w-11 rounded-full bg-slate-200" /></div>}<button type="button" onClick={onClose} className="absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-full text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-800" aria-label="Tutup detail">×</button><div onPointerDown={startDrag} className={`flex items-start justify-between gap-4 border-b border-slate-100 pb-4 touch-none ${isDesktop ? "cursor-move active:cursor-grabbing" : ""}`}><div className="pr-8"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={report.status} /><SeverityBadge severity={report.severity} /></div><h2 className="mt-3 text-xl font-bold leading-tight tracking-tight text-slate-950">{report.category}</h2><p className="mt-1 text-[11px] font-semibold text-slate-400">{report.ticketNumber} · diperbarui {formatTime(report.updatedAt)}</p></div></div><div className="mt-5 grid gap-3 text-xs"><div><span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Wilayah penanganan</span><strong className="mt-1 block text-slate-800">{report.policeUnit?.name || "Belum ditentukan"}</strong><span className="mt-0.5 block text-slate-500">{report.policeUnit?.district || "Akan ditentukan oleh petugas"}</span></div><div><span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Lokasi laporan</span><span className="mt-1 block text-slate-600">Area dianonimkan pada tampilan publik · {report.latitude.toFixed(3)}, {report.longitude.toFixed(3)}</span></div>{report.description && <div><span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Kronologi</span><p className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-600">{report.description}</p></div>}</div>{canUpdate && <div className="mt-5 border-t border-slate-100 pt-4"><label className="grid gap-1.5 text-xs font-bold text-slate-700">Perbarui status<select disabled={updating} value={report.status} onChange={(event) => void onStatusChange(event.target.value as Exclude<ReportStatus, "PENDING">)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold outline-none transition-colors focus:border-[#e62428] focus:ring-4 focus:ring-red-100"><option value="PENDING" disabled>{statusLabels.PENDING}</option><option value="VERIFIED">{statusLabels.VERIFIED}</option><option value="IN_PROGRESS">{statusLabels.IN_PROGRESS}</option><option value="RESOLVED">{statusLabels.RESOLVED}</option><option value="REJECTED">{statusLabels.REJECTED}</option></select></label><p className="mt-2 text-[10px] leading-relaxed text-slate-400">Perubahan status dicatat sebagai aktivitas operasional.</p></div>}{role === "admin" && <p className="mt-5 border-t border-slate-100 pt-4 text-[10px] leading-relaxed text-slate-400">Data pelapor dan koordinat presisi hanya tersedia sesuai permission. Peta publik menampilkan area yang sudah dianonimkan.</p>}</aside>;
}

function MapInfoPanel({ title, eyebrow, children, onClose, isDesktop }: { title: string; eyebrow: string; children: ReactNode; onClose: () => void; isDesktop: boolean }) {
  return <aside className={`${isDesktop ? "absolute right-6 top-24 w-[360px] rounded-xl" : "fixed bottom-0 left-0 right-0 rounded-t-2xl"} z-40 max-h-[72dvh] overflow-y-auto border border-slate-100 bg-white p-5 shadow-[0_22px_65px_rgba(15,23,42,0.2)]`} aria-live="polite">
    <button type="button" onClick={onClose} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-xl leading-none text-slate-400 hover:bg-slate-100" aria-label="Tutup detail peta">×</button>
    <p className="pr-10 text-[10px] font-black uppercase tracking-[.16em] text-[#e62428]">{eyebrow}</p>
    <h2 className="mt-1 pr-10 font-heading text-xl font-black tracking-tight text-slate-950">{title}</h2>
    <div className="mt-4 grid gap-3 text-xs text-slate-600">{children}</div>
  </aside>;
}

function PoliceMapDetail({ unit, isDesktop, onClose }: { unit: PoliceUnit; isDesktop: boolean; onClose: () => void }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  return <MapInfoPanel title={unit.name} eyebrow="Kantor polisi" isDesktop={isDesktop} onClose={onClose}>
    {unit.photoUrl && <><button type="button" className="group relative block w-full overflow-hidden rounded-lg" onClick={() => setPreviewOpen(true)} aria-label={`Lihat foto ${unit.name}`}><img src={unit.photoUrl} alt={unit.name} className="h-40 w-full object-cover transition-transform group-hover:scale-[1.02]" referrerPolicy="no-referrer" /><span className="absolute bottom-2 right-2 rounded-md bg-slate-950/70 px-2 py-1 text-[10px] font-bold text-white">Lihat foto</span></button>{previewOpen && <ImagePreview src={unit.photoUrl} alt={unit.name} onClose={() => setPreviewOpen(false)} />}</>}
    <div><span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Wilayah</span><strong className="mt-1 block text-slate-900">{unit.district}</strong></div>
    <div><span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Alamat</span><p className="mt-1 leading-relaxed">{unit.address}</p></div>
    {unit.phone && <div><span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Telepon</span><a className="mt-1 block font-bold text-[#e62428]" href={`tel:${unit.phone}`}>{unit.phone}</a></div>}
    <a className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#e62428] px-4 text-xs font-black text-white transition-colors hover:bg-[#c91d22]" href={`https://www.google.com/maps/dir/?api=1&destination=${unit.latitude},${unit.longitude}`} target="_blank" rel="noreferrer">
      Arahkan ke kantor polisi
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
    </a>
  </MapInfoPanel>;
}

function SafetyMapDetail({ zone, isDesktop, onClose, onSelectReport }: { zone: SafetySelection; isDesktop: boolean; onClose: () => void; onSelectReport: (report: IncidentReport) => void }) {
  return <MapInfoPanel title="Indeks keamanan area" eyebrow="Area laporan" isDesktop={isDesktop} onClose={onClose}>
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-3"><span className="font-bold text-slate-600">Perhatian {zone.level}</span><strong className="text-lg text-slate-950">{zone.score}/4</strong></div>
    <p className="font-semibold text-slate-500">{zone.reports.length} laporan berada di area ini.</p>
    <div className="grid gap-2">{zone.reports.length ? zone.reports.map((report) => <button key={report.id} type="button" onClick={() => onSelectReport(report)} className="rounded-lg border border-slate-100 bg-white px-3 py-3 text-left shadow-sm hover:border-red-100 hover:bg-red-50"><strong className="block text-xs text-slate-900">{report.category}</strong><span className="mt-1 block font-mono text-[10px] text-slate-400">{report.ticketNumber}</span><span className="mt-1 block text-[10px] font-bold text-slate-500">{statusShortLabels[report.status]} · titik laporan {report.latitude.toFixed(3)}, {report.longitude.toFixed(3)}</span></button>) : <p className="rounded-lg bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-500">Belum ada laporan terhubung di area ini.</p>}</div>
  </MapInfoPanel>;
}

function ReportForm({ open, isDesktop, form, setForm, pinMode, setPinMode, submitting, onSubmit, onClose, onUseLocation, error }: { open: boolean; isDesktop: boolean; form: ReportFormState; setForm: Dispatch<SetStateAction<ReportFormState>>; pinMode: boolean; setPinMode: (value: boolean) => void; submitting: boolean; onSubmit: (event: FormEvent) => void; onClose: () => void; onUseLocation: () => void; error: string | null }) {
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
          <button type="button" onClick={onClose} onPointerDown={(event) => event.stopPropagation()} className="grid h-8 w-8 place-items-center rounded-full text-xl leading-none text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900" aria-label="Tutup form">×</button>
        </div>
        <form id="new-report-form" className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 pb-6 pt-5" onSubmit={onSubmit}>
          <label className="grid gap-2 text-xs font-black tracking-normal text-slate-700">Kategori kejadian<CategoryMenu value={form.category} onChange={(category) => setForm((current) => ({ ...current, category }))} /></label>
          <label className="grid gap-2 text-xs font-black tracking-normal text-slate-700">Kronologi singkat<textarea required minLength={10} maxLength={2000} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Ceritakan urutan dan kondisi yang terjadi..." className="min-h-32 resize-none rounded-sm border border-gray-200 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-slate-900 outline-none transition focus:border-[#e62428] focus:ring-2 focus:ring-red-100" /><span className="text-[10px] font-medium normal-case tracking-normal text-slate-400">Minimal 10 karakter. Jangan tulis identitas korban atau nomor telepon.</span></label>
          <label className="grid gap-2 text-xs font-black tracking-normal text-slate-700">Tingkat keparahan<SeverityMenu value={form.severity} onChange={(severity) => setForm((current) => ({ ...current, severity }))} /></label>
          <div className="space-y-2"><p className="text-xs font-black tracking-normal text-slate-700">Lokasi kejadian</p><div className="flex items-center justify-between gap-3 rounded-sm bg-slate-50 px-3 py-3"><div><strong className="block text-xs font-black text-slate-900">Titik laporan</strong><span className="mt-1 block font-mono text-[11px] font-bold text-slate-500">{form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}</span></div><button type="button" onClick={() => setPinMode(!pinMode)} className={`shrink-0 rounded-full px-3 py-2 text-[10px] font-black tracking-wide ${pinMode ? "bg-[#e62428] text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>{pinMode ? "Pilih di peta" : "Ubah titik"}</button></div><button type="button" onClick={onUseLocation} className="text-[10px] font-black tracking-wide text-[#e62428] hover:text-[#b21e24]">Gunakan lokasi saya</button></div>
          {error && <p className="rounded-sm bg-red-50 px-3 py-2 text-xs font-bold normal-case tracking-normal text-red-700" role="alert">{error}</p>}
        </form>
        <div className="shrink-0 border-t border-gray-100 bg-white px-6 py-4"><button type="submit" form="new-report-form" disabled={submitting || !form.category || form.description.trim().length < 10} className="h-12 w-full rounded-full bg-[#e62428] px-4 text-xs font-black tracking-wide text-white transition-colors hover:bg-[#c91d22] disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Mengirim laporan..." : "Kirim laporan"}</button></div>
      </motion.aside>
      </motion.div>
    </>}
  </AnimatePresence>;
}

function FeedView({ reports, role, stats, overview, onSelect, selectedId, selectedReport, isDesktop, onCloseDetail, onStatusChange, updating, hasMore, loadingMore, onLoadMore, isLoading }: { reports: IncidentReport[]; role: DashboardData["role"]; stats: DashboardData["stats"]; overview?: DashboardData["adminOverview"]; onSelect: (report: IncidentReport) => void; selectedId: string | null; selectedReport: IncidentReport | null; isDesktop: boolean; onCloseDetail: () => void; onStatusChange: (status: Exclude<ReportStatus, "PENDING">) => void; updating: boolean; hasMore: boolean; loadingMore: boolean; onLoadMore: () => void; isLoading: boolean }) {
  const title = role === "warga" ? "Isu Terkini" : role === "polisi" ? "Antrian unit" : "Monitoring laporan";
  const description = role === "warga" ? `${reports.length} laporan warga` : role === "polisi" ? "Triage laporan dari wilayah unit Anda dan catat status penanganannya." : "Ringkasan laporan dan unit operasional Garda Jakarta.";
  const statCards = [["Total", stats.total, "total", "bg-red-50 text-[#e62428]"], ["Masuk", stats.pending, "pending", "bg-amber-50 text-amber-700"], ["Diproses", stats.inProgress, "progress", "bg-sky-50 text-sky-700"], ["Selesai", stats.resolved, "done", "bg-emerald-50 text-emerald-700"]] as const;
  return <div className="absolute inset-0 z-10 overflow-y-auto bg-[#f3f4f6] px-3 pb-28 pt-40 sm:px-5 sm:pb-36 sm:pt-24 md:px-8 md:pt-28" aria-busy={isLoading}><div className={`${role === "admin" ? "max-w-5xl" : "max-w-2xl"} mx-auto w-full`}><div className="mb-4 border-b border-gray-200/70 bg-[#f3f4f6] pb-3"><h1 className="font-heading text-lg font-black tracking-tight text-gray-950">{title}</h1><p className="text-xs font-bold text-gray-400">{description}</p></div>{role !== "warga" && <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{statCards.map(([label, count, icon, color]) => <div key={label} className="rounded-sm border border-gray-100 bg-white p-3"><span className={`mb-2 grid h-8 w-8 place-items-center rounded-xl ${color}`}><StatIcon kind={icon} /></span><span className="text-[10px] font-bold text-gray-400">{label}</span><strong className="mt-1 block text-xl font-black text-gray-900">{count}</strong></div>)}</div>}{role === "admin" && overview && <div className="mb-4 grid gap-3 sm:grid-cols-[1.15fr_.85fr]"><div className="rounded-sm border border-gray-100 bg-white p-4"><h2 className="font-heading text-sm font-black text-gray-900">Ringkasan operasional</h2><div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-sm bg-gray-50 p-3"><span className="block text-[9px] font-bold text-gray-400">Pengguna</span><strong className="mt-1 block text-lg font-black">{overview.users}</strong></div><div className="rounded-sm bg-gray-50 p-3"><span className="block text-[9px] font-bold text-gray-400">Unit polisi</span><strong className="mt-1 block text-lg font-black">{overview.units}</strong></div><div className="rounded-sm bg-gray-50 p-3"><span className="block text-[9px] font-bold text-gray-400">Audit log</span><strong className="mt-1 block text-lg font-black">{overview.auditLogs}</strong></div></div></div><div className="rounded-sm border border-gray-100 bg-white p-4"><h2 className="font-heading text-sm font-black text-gray-900">Kategori terbanyak</h2><div className="mt-3 grid gap-2">{overview.categories.map((category) => <div key={category.name} className="flex items-center justify-between gap-3 text-[11px]"><span className="truncate font-bold text-gray-600">{category.name}</span><span className="rounded-full bg-red-50 px-2 py-1 font-black text-red-700">{category.count}</span></div>)}</div></div></div>}{role === "admin" ? <AdminReportsTable reports={reports} selectedId={selectedId} onSelect={onSelect} hasMore={hasMore} loading={loadingMore} onLoadMore={onLoadMore} /> : <InfiniteReportList reports={reports} selectedId={selectedId} onSelect={onSelect} hasMore={hasMore} loading={loadingMore} onLoadMore={onLoadMore} />}</div>{selectedReport && <ReportDetail report={selectedReport} role={role} isDesktop={isDesktop} onClose={onCloseDetail} onStatusChange={onStatusChange} updating={updating} />}{isLoading && <MapLoadingOverlay label="Memuat laporan Garda Jakarta..." />}</div>;
}

function MapLoadingOverlay({ label = "Memeriksa keamanan Jakarta..." }: { label?: string }) {
  return <div className="pointer-events-none absolute inset-0 z-[35] grid place-items-center bg-slate-950/10 backdrop-blur-[1px]" role="status" aria-live="polite"><div className="grid justify-items-center gap-3 text-center"><AppLogo size={96} aria-label="Garda Jakarta" /><span className="garda-loading-mark h-6 w-6" aria-hidden="true" /><p className="text-[10px] font-black tracking-wide text-slate-700">{label}</p></div></div>;
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
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
  const [selectedUnit, setSelectedUnit] = useState<PoliceUnit | null>(null);
  const [selectedZone, setSelectedZone] = useState<SafetySelection | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [focusLocation, setFocusLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const notifiedRiskReportsRef = useRef(new Set<string>());
  const [form, setForm] = useState<ReportFormState>({ category: "", description: "", severity: "P2", latitude: -6.1754, longitude: 106.8272 });

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
    const watchId = geolocation.watchPosition(updateLocation, () => undefined, { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 });
    return () => { if (typeof geolocation.clearWatch === "function") geolocation.clearWatch(watchId); };
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    const [dashboardResult, publicResult, feedResult] = await Promise.allSettled([publicMode ? Promise.resolve(null) : getDashboard(), getPublicMap(), publicMode ? Promise.resolve(null) : getReportFeed(1, 10)]);
    if (publicMode) { setData(null); setFeedItems([]); setError(null); }
    else if (dashboardResult.status === "fulfilled" && dashboardResult.value) { setData(dashboardResult.value); setError(null); }
    else setError("Dashboard belum dapat dimuat. Periksa koneksi lalu coba lagi.");
    if (feedResult.status === "fulfilled" && feedResult.value) { setFeedItems(feedResult.value.reports); setFeedPage(feedResult.value.page); setFeedHasMore(feedResult.value.hasMore); }
    else if (!publicMode) { setFeedItems([]); setFeedPage(1); setFeedHasMore(false); }
    if (publicResult.status === "fulfilled") setPublicMap(publicResult.value);
    else if (publicMode) setError("Peta belum dapat dimuat. Periksa koneksi lalu coba lagi.");
    setIsLoading(false);
  }, [publicMode]);
  // Dashboard data is synchronized with the authenticated API session.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const reports = data?.reports ?? EMPTY_REPORTS;
  const stats = data?.stats || { total: 0, pending: 0, inProgress: 0, resolved: 0 };
  const matches = useCallback((report: IncidentReport) => {
    const statusMatches = statusFilter === "ALL" || report.status === statusFilter;
    const query = view === "feed" ? search.trim().toLowerCase() : "";
    const searchMatches = !query || [report.ticketNumber, report.category, report.description, report.policeUnit?.name, report.policeUnit?.district].filter(Boolean).some((value) => value!.toLowerCase().includes(query));
    const visibilityMatches = statusFilter === "REJECTED" ? report.status === "REJECTED" : report.status !== "REJECTED";
    return visibilityMatches && statusMatches && searchMatches;
  }, [search, statusFilter, view]);
  const filteredReports = useMemo(() => reports.filter(matches), [matches, reports]);
  const publicReports = useMemo(() => (publicMap?.reports ?? []).filter((report) => report.status !== "REJECTED" && matches(report)), [matches, publicMap?.reports]);
  const mapReports = citizen ? publicReports : filteredReports;
  const mapUnits = useMemo(() => citizen ? (publicMap?.units ?? data?.units ?? []) : (data?.units ?? []), [citizen, data?.units, publicMap?.units]);
  const feedReports = useMemo(() => feedItems.filter(matches), [feedItems, matches]);
  const selectedReport = useMemo(() => [...reports, ...publicReports, ...feedItems].find((report) => report.id === selectedId) ?? null, [feedItems, publicReports, reports, selectedId]);
  const activeFilter = statusFilter !== "ALL" || (view === "feed" && Boolean(search.trim()));

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

  const openReportForm = useCallback(() => { if (!canReport) return; setView("map"); setSelectedId(null); setListOpen(false); setFocusLocation({ latitude: form.latitude, longitude: form.longitude }); setReportOpen(true); setPinMode(true); setError(null); }, [canReport, form.latitude, form.longitude]);
  const selectReport = useCallback((report: IncidentReport) => { setSelectedId(report.id); setListOpen(false); setReportOpen(false); }, []);
  const selectReportFromMap = useCallback((report: IncidentReport) => { setFocusLocation({ latitude: report.latitude, longitude: report.longitude }); selectReport(report); }, [selectReport]);
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
      setNotice(`Menampilkan ${location.label}.`);
      return;
    }
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=id&accept-language=id&q=${encodeURIComponent(query)}`);
      const result = await response.json() as Array<{ lat: string; lon: string; display_name: string }>;
      const location = result[0];
      if (!location) { setNotice("Lokasi belum ditemukan. Coba nama tempat atau wilayah yang lebih spesifik."); return; }
      const parts = location.display_name.split(",").map((part) => part.trim());
      const selected = { id: `place-${location.lat}-${location.lon}`, label: parts.slice(0, 2).join(", "), subtitle: parts.slice(2, 4).join(", ") || "Lokasi", latitude: Number(location.lat), longitude: Number(location.lon) };
      setLocationSearch(selected.label); setLocationSuggestions([]); setSearchedLocation(selected); setFocusLocation({ latitude: selected.latitude, longitude: selected.longitude });
      if (reportOpen) { setForm((current) => ({ ...current, latitude: selected.latitude, longitude: selected.longitude })); setPinMode(false); }
      setSelectedId(null); setSelectedUnit(null); setSelectedZone(null); setNotice(`Menampilkan ${selected.label}.`);
    } catch { setNotice("Pencarian lokasi belum tersedia. Coba lagi sebentar."); }
  }, [locationSearch, locationSuggestions, reportOpen]);
  const selectLocation = useCallback((location: LocationSearchResult) => {
    setLocationSearch(location.label); setLocationSuggestions([]); setSearchedLocation(location); setFocusLocation({ latitude: location.latitude, longitude: location.longitude });
    if (reportOpen) { setForm((current) => ({ ...current, latitude: location.latitude, longitude: location.longitude })); setPinMode(false); }
    setSelectedId(null); setSelectedUnit(null); setSelectedZone(null); setNotice(`Menampilkan ${location.label}.`);
  }, [reportOpen]);
  const clearSearchedLocation = useCallback(() => { setSearchedLocation(null); setFocusLocation(null); setLocationSuggestions([]); setLocationSearch(""); }, []);
  const useLocation = useCallback(() => {
    const geolocation = navigator.geolocation;
    if (!geolocation || typeof geolocation.getCurrentPosition !== "function") { setError("Perangkat ini tidak mendukung lokasi otomatis. Pilih titik langsung di peta."); return; }
    geolocation.getCurrentPosition((position) => { const coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude }; setForm((current) => ({ ...current, ...coordinates })); setFocusLocation(coordinates); setPinMode(false); setNotice("Lokasi perangkat sudah dipilih."); }, () => setError("Lokasi perangkat belum tersedia. Pilih titik langsung di peta."), { timeout: 5000 });
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSubmitting(true); setError(null); setNotice(null);
    try { await createReport(form); setForm((current) => ({ ...current, category: "", description: "" })); setReportOpen(false); setPinMode(false); setNotice("Laporan berhasil dikirim dan masuk ke unit penanganan terdekat."); await load(); }
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
          {notificationOpen && <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(320px,calc(100vw-24px))] rounded-xl border border-gray-100 bg-white p-2 shadow-2xl" role="menu"><div className="flex items-center justify-between border-b border-gray-100 px-3 py-2.5"><strong className="text-xs">Notifikasi</strong>{notificationItems.length > 0 && <button type="button" className="text-[10px] font-bold text-[#e62428]" onClick={() => setNotificationItems([])}>Bersihkan</button>}</div>{notificationItems.length === 0 ? <p className="px-3 py-5 text-center text-xs font-semibold text-slate-400">Belum ada notifikasi.</p> : <div className="max-h-64 overflow-y-auto">{notificationItems.map((item) => <div key={item.id} className="flex gap-2 border-b border-gray-50 px-3 py-3 last:border-0"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-red-50 text-[#e62428]"><NotificationIcon /></span><div className="min-w-0"><strong className="block text-[11px] font-black text-slate-800">{item.title}</strong><p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">{item.body}</p></div></div>)}</div>}</div>}
        </div><div ref={accountRef} className="relative shrink-0">
          <button type="button" onClick={() => setAccountOpen((current) => !current)} className="inline-flex h-8 w-8 items-center justify-center rounded-full p-0 text-left hover:bg-gray-50 sm:h-auto sm:w-auto sm:gap-2 sm:justify-start sm:px-1.5 sm:py-1" aria-haspopup="menu" aria-expanded={accountOpen}>
            <Avatar name={user?.name || "Garda"} image={user?.image} size="h-8 w-8 sm:h-9 sm:w-9" />
            <span className="hidden max-w-[150px] sm:block"><strong className="block truncate text-[11px] font-bold text-gray-900">{user?.name}</strong><small className="mt-0.5 block text-[9px] font-bold text-[#e62428]">{roleLabel(role)}</small></span>
            <span className="hidden sm:block"><Chevron open={accountOpen} /></span>
          </button>
          {accountOpen && <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 rounded-xl border border-gray-100 bg-white p-2 shadow-2xl" role="menu"><div className="border-b border-gray-100 px-3 py-2.5"><strong className="block truncate text-xs">{user?.name}</strong><span className="mt-1 block truncate text-[10px] text-gray-400">{user?.email}</span></div><button type="button" role="menuitem" onClick={() => { setAccountOpen(false); setSignoutOpen(true); }} className="mt-1 flex w-full items-center rounded-lg px-3 py-2.5 text-left text-xs font-bold text-red-700 hover:bg-red-50">Keluar</button></div>}
         </div></div>}
      </div>
      <div className="w-full sm:hidden">
        <DashboardControls mobile view={view} citizen={citizen} showActions={!publicMode} role={role} search={view === "map" ? locationSearch : search} onSearchChange={(value) => { if (view === "map") { setLocationSearch(value); setLocationSuggestions([]); if (searchedLocation) setSearchedLocation(null); } else setSearch(value); }} onSearchSubmit={view === "map" ? searchLocation : undefined} locationSuggestions={locationSuggestions} onSelectLocation={selectLocation} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} listOpen={listOpen} onToggleList={() => { setListOpen((current) => !current); setReportOpen(false); setSelectedId(null); }} onCreateReport={toggleReportForm} onPickLocation={() => { if (!reportOpen) openReportForm(); else setPinMode((current) => !current); }} pinMode={pinMode} activeFilter={activeFilter} reportOpen={reportOpen} />
      </div>
    </header>

    <section className="absolute inset-0" aria-label={view === "map" ? "Dashboard peta keamanan Jakarta" : "Feed laporan keamanan Jakarta"}>
      {view === "map" && <>
         <GardaMap className="!h-full !min-h-0" units={mapUnits} reports={mapReports} userLocation={userLocation} followUser={!focusLocation && !selectedId && !selectedUnit && !selectedZone && !reportOpen} focusLocation={focusLocation} searchedLocation={searchedLocation} onClearSearchedLocation={clearSearchedLocation} draftLocation={form} draftActive={canReport && reportOpen} onDraftLocationChange={handleDraftLocationChange} onMapClick={canReport && reportOpen && pinMode ? mapClick : undefined} onSelectReport={(report) => { setSelectedUnit(null); setSelectedZone(null); selectReportFromMap(report); }} onSelectUnit={(unit) => { setSelectedId(null); setSelectedZone(null); setFocusLocation({ latitude: unit.latitude, longitude: unit.longitude }); setSelectedUnit(unit); }} onSelectSafetyZone={(zone) => { setSelectedId(null); setSelectedUnit(null); setSelectedZone(zone); }} showSafetyZones={!publicMode} />
        {isLoading && <MapLoadingOverlay label="Memeriksa keamanan Jakarta..." />}
        <div className="pointer-events-none absolute bottom-5 left-0 right-0 z-20 hidden items-center justify-center px-4 sm:flex"><div className="pointer-events-auto w-full max-w-[700px]"><DashboardControls view={view} citizen={citizen} showActions={!publicMode} role={role} search={view === "map" ? locationSearch : search} onSearchChange={(value) => { if (view === "map") { setLocationSearch(value); setLocationSuggestions([]); if (searchedLocation) setSearchedLocation(null); } else setSearch(value); }} onSearchSubmit={view === "map" ? searchLocation : undefined} locationSuggestions={locationSuggestions} onSelectLocation={selectLocation} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} listOpen={listOpen} onToggleList={() => { setListOpen((current) => !current); setReportOpen(false); setSelectedId(null); }} onCreateReport={toggleReportForm} onPickLocation={() => { if (!reportOpen) openReportForm(); else setPinMode((current) => !current); }} pinMode={pinMode} activeFilter={activeFilter} reportOpen={reportOpen} /></div></div>
      </>}
      {view === "map" && <>
        {listOpen && <aside className="absolute bottom-[72px] left-3 right-3 z-30 max-h-[68dvh] overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_22px_65px_rgba(15,23,42,0.2)] sm:bottom-auto sm:left-6 sm:right-auto sm:top-24 sm:w-[380px]" aria-label="Daftar laporan"><div className="border-b border-slate-100 px-4 pb-3 pt-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-widest text-[#e62428]">{citizen ? "Riwayat" : "Operasional"}</p><h2 className="mt-1 text-lg font-bold tracking-tight">{citizen ? "Laporan saya" : role === "polisi" ? "Antrian unit" : "Monitoring laporan"}</h2><p className="mt-1 text-[10px] font-bold text-slate-400">{filteredReports.length} laporan sesuai filter</p></div><button type="button" onClick={() => setListOpen(false)} className="grid h-7 w-7 place-items-center rounded-lg text-lg text-slate-400 hover:bg-slate-100" aria-label="Tutup daftar">×</button></div><div className="mt-3 grid grid-cols-4 gap-1 rounded-lg bg-slate-50 p-1 text-center"><div className="rounded-md bg-white py-1.5 shadow-sm"><strong className="block text-sm font-bold">{stats.total}</strong><span className="text-[8px] font-bold uppercase text-slate-400">Total</span></div><div className="py-1.5"><strong className="block text-sm font-bold">{stats.pending}</strong><span className="text-[8px] font-bold uppercase text-slate-400">Masuk</span></div><div className="py-1.5"><strong className="block text-sm font-bold">{stats.inProgress}</strong><span className="text-[8px] font-bold uppercase text-slate-400">Proses</span></div><div className="py-1.5"><strong className="block text-sm font-bold">{stats.resolved}</strong><span className="text-[8px] font-bold uppercase text-slate-400">Selesai</span></div></div></div><div className="max-h-[calc(68dvh-166px)] space-y-2 overflow-y-auto bg-slate-50/70 p-3">{filteredReports.length === 0 ? <p className="px-3 py-10 text-center text-xs font-semibold text-slate-400">Belum ada laporan yang sesuai.</p> : filteredReports.map((report) => <ReportCard key={report.id} report={report} selected={selectedId === report.id} onSelect={() => selectReport(report)} />)}</div></aside>}
        {selectedReport && !reportOpen && <ReportDetail report={selectedReport} role={role} isDesktop={isDesktop} onClose={() => { setSelectedId(null); setFocusLocation(null); }} onStatusChange={(status) => void updateStatus(selectedReport.id, status)} updating={updatingId === selectedReport.id} />}
        {selectedUnit && !reportOpen && <PoliceMapDetail unit={selectedUnit} isDesktop={isDesktop} onClose={() => { setSelectedUnit(null); setFocusLocation(null); }} />}
        {selectedZone && !reportOpen && <SafetyMapDetail zone={selectedZone} isDesktop={isDesktop} onClose={() => { setSelectedZone(null); setFocusLocation(null); }} onSelectReport={(report) => { setSelectedZone(null); setFocusLocation({ latitude: report.latitude, longitude: report.longitude }); selectReport(report); }} />}
        {canReport && <ReportForm open={reportOpen} isDesktop={isDesktop} form={form} setForm={setForm} pinMode={pinMode} setPinMode={setPinMode} submitting={submitting} onSubmit={(event) => void submit(event)} onClose={() => { setReportOpen(false); setPinMode(false); setFocusLocation(null); }} onUseLocation={useLocation} error={error} />}
      </>}
      {notice && <div className="absolute left-1/2 top-[6.5rem] z-30 w-[calc(100%-32px)] max-w-md -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-3 text-center text-xs font-bold text-white shadow-xl sm:top-24" role="status">{notice}<button type="button" onClick={() => setNotice(null)} className="ml-3 rounded-md px-1 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Tutup notifikasi">×</button></div>}
      {error && !reportOpen && <p className="absolute left-1/2 top-[6.5rem] z-30 w-[calc(100%-32px)] max-w-md -translate-x-1/2 rounded-lg bg-red-50 px-4 py-3 text-center text-xs font-bold text-red-700 shadow-lg sm:top-24" role="alert">{error}</p>}
    </section>
    {view === "feed" && <FeedView reports={feedReports} role={role} stats={stats} overview={data?.adminOverview} onSelect={selectReport} selectedId={selectedId} selectedReport={selectedReport} isDesktop={isDesktop} onCloseDetail={() => setSelectedId(null)} onStatusChange={(status) => selectedReport && void updateStatus(selectedReport.id, status)} updating={Boolean(selectedReport && updatingId === selectedReport.id)} hasMore={feedHasMore} loadingMore={loadingMore} onLoadMore={() => void loadMoreFeed()} isLoading={isLoading} />}
    {signoutOpen && <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/35 px-5 backdrop-blur-sm" role="presentation"><section className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="signout-title"><h2 id="signout-title" className="text-xl font-bold tracking-tight">Keluar dari dashboard?</h2><p className="mt-2 text-xs leading-relaxed text-slate-500">Sesi di perangkat ini akan ditutup.</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setSignoutOpen(false)} className="rounded-lg px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100">Batal</button><button type="button" onClick={() => void handleSignOut()} className="rounded-lg bg-[#e62428] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#c91d22]">Keluar</button></div></section></div>}
  </main>;
}
