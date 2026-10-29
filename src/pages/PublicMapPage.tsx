import MobileDetailSheet from "../components/MobileDetailSheet";
import type { ReactNode } from "react";
import ReportConversation from "../components/ReportConversation";
import { CurrentLocationButton, CustomStatusSelect, MapFilterMenu } from "../components/MapFilters";
import { defaultMapFilters, type MapFilterState } from "../components/map-filter-state";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AppLogo from "../components/branding/AppLogo";
import ImagePreview from "../components/ImagePreview";
import GardaMap from "../components/GardaMap";
import CloseIcon from "../components/CloseIcon";
import { getPublicMap } from "../lib/api";
import { useAuth } from "../context/useAuth";
import { portalPaths } from "../lib/portals";
import type { IncidentReport, PoliceUnit, ReportSeverity, ReportStatus } from "../types";
import { ReportListSkeleton } from "../components/LoadingSkeleton";

const categories = ["Pelecehan verbal atau catcalling", "Pelecehan atau kekerasan seksual", "Pencurian atau perampasan", "Begal atau perampokan", "Kekerasan fisik", "Tawuran atau kerumunan berbahaya", "Penipuan atau pemerasan", "Gangguan penerangan atau fasilitas yang berdampak pada keamanan", "Lainnya"];
const statusLabels: Record<ReportStatus, string> = { PENDING: "Belum diverifikasi", VERIFIED: "Terverifikasi", IN_PROGRESS: "Sedang diproses", CLARIFICATION: "Butuh klarifikasi", RESOLVED: "Selesai", REJECTED: "Ditolak" };
const severityLabels: Record<ReportSeverity, string> = { P0: "Kritis", P1: "Tinggi", P2: "Sedang", P3: "Rendah" };
const severityColors: Record<ReportSeverity, string> = { P0: "bg-red-50 text-red-700", P1: "bg-orange-50 text-orange-700", P2: "bg-amber-50 text-amber-700", P3: "bg-slate-50 text-slate-600" };
const severityGlyphs: Record<ReportSeverity, string> = { P0: "!", P1: "!", P2: "•", P3: "–" };

const statusIcons: Record<ReportStatus, string> = { PENDING: "◷", VERIFIED: "✓", IN_PROGRESS: "↗", CLARIFICATION: "?", RESOLVED: "✓", REJECTED: "×" };
type LocationSuggestion = { id: string; label: string; subtitle: string; latitude: number; longitude: number };
type PublicView = "map" | "feed";
function MapModeIcon() { return <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Z" /><path d="M9 3v15M15 6v15" /></svg>; }
function FeedModeIcon() { return <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h9" /></svg>; }
function PublicStatus({ status }: { status: ReportStatus }) { return <span className={`status-badge status-${status.toLowerCase()}`}><span aria-hidden="true">{statusIcons[status]}</span>{statusLabels[status]}</span>; }
function categoryIllustration(category: string) {
  if (category.includes("Tawuran")) return "/illustrations/categories/crowd-generated.png";
  const index = Math.max(0, categories.indexOf(category));
  return `/illustrations/categories/${["harassment", "sexual", "theft", "robbery", "violence", "crowd-generated", "fraud", "facility", "other-generated"][index]}.png`;
}
function PublicReportDetail({ report }: { report: IncidentReport }) {
  return <div className="grid gap-3 text-xs text-[#6c6c67]"><div className="flex flex-wrap items-center gap-2"><PublicStatus status={report.status} /><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ${severityColors[report.severity]}`}><span aria-hidden="true">{severityGlyphs[report.severity]}</span>{severityLabels[report.severity]}</span></div><div><span className="block text-[10px] font-bold uppercase tracking-widest text-[#a0a09a]">Nomor laporan</span><strong className="mt-1 block font-mono text-slate-900">{report.ticketNumber}</strong></div><div><span className="block text-[10px] font-bold uppercase tracking-widest text-[#a0a09a]">Wilayah penanganan</span><strong className="mt-1 block text-slate-900">{report.policeUnit?.name || "Unit terdekat"}</strong><span className="mt-0.5 block">{report.policeUnit?.district || "Jakarta"}</span></div>{report.description && <div><span className="block text-[10px] font-bold uppercase tracking-widest text-[#a0a09a]">Ringkasan</span><p className="mt-1 max-h-24 overflow-y-auto leading-relaxed">{report.description}</p></div>}<div><span className="block text-[10px] font-bold uppercase tracking-widest text-[#a0a09a]">Lokasi</span><span className="mt-1 block">Area laporan dianonimkan pada peta publik · {report.latitude.toFixed(3)}, {report.longitude.toFixed(3)}</span></div></div>;
}

function PublicDetailContainer({ desktop, anchor, position, onClose, children }: { desktop: boolean; anchor: boolean; position: { x: number; y: number } | null; onClose: () => void; children: ReactNode }) {
  if (!desktop) return <MobileDetailSheet onClose={onClose}>{children}</MobileDetailSheet>;
  return <div className={anchor ? "map-anchored-detail" : undefined} style={anchor ? { left: position?.x, top: position?.y, visibility: position ? "visible" : "hidden" } : undefined}>{children}</div>;
}

export default function PublicMapPage() {
  const { user, signOut } = useAuth();
  const [units, setUnits] = useState<PoliceUnit[]>([]);
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [areaQuery, setAreaQuery] = useState("");
  const [areaStatus, setAreaStatus] = useState<ReportStatus | "ALL">("ALL");
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedReport, setSelectedReport] = useState<IncidentReport | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<PoliceUnit | null>(null);
  const [selectedZone, setSelectedZone] = useState<{ reports: IncidentReport[]; level: string; score: number } | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [followingUser, setFollowingUser] = useState(true);
  const [focusLocation, setFocusLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<PublicView>("map");
  const [feedSearch, setFeedSearch] = useState("");
  const [feedVisibleCount, setFeedVisibleCount] = useState(10);
  const [feedSelected, setFeedSelected] = useState<IncidentReport | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [searchedLocation, setSearchedLocation] = useState<LocationSuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MapFilterState>({ ...defaultMapFilters });
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [signoutOpen, setSignoutOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 640);
  const accountRef = useRef<HTMLDivElement>(null);
  const handleSignOut = async () => {
    try { await signOut(); setSignoutOpen(false); window.location.assign(portalPaths[user?.role || "warga"].login); }
    catch { setSignoutOpen(false); }
  };

  useEffect(() => {
    if (!accountOpen) return;
    const close = (event: PointerEvent) => { if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [accountOpen]);
  useEffect(() => { const media = window.matchMedia("(min-width: 640px)"); const update = () => setIsDesktop(media.matches); update(); media.addEventListener("change", update); return () => media.removeEventListener("change", update); }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    try { const data = await getPublicMap(); setUnits(data.units); setReports(data.reports); setError(null); }
    catch { setError("Peta belum dapat dimuat. Periksa koneksi lalu coba lagi."); }
    finally { setIsLoading(false); }
  }, []);
  // Public map data is synchronized with the public API.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!navigator.geolocation) return;
    const geolocation = navigator.geolocation;
    const updateLocation = (position: GeolocationPosition) => setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    if (typeof geolocation.getCurrentPosition === "function") geolocation.getCurrentPosition(updateLocation, () => undefined, { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 });
    if (typeof geolocation.watchPosition !== "function") return;
    const watchId = geolocation.watchPosition(updateLocation, () => undefined, { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 });
    return () => { if (typeof geolocation.clearWatch === "function") geolocation.clearWatch(watchId); };
  }, []);
  useEffect(() => {
    if (!search.trim() || search.trim().length < 2 || (searchedLocation && search === searchedLocation.label)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=id&accept-language=id&q=${encodeURIComponent(search.trim())}`, { signal: controller.signal, headers: { Accept: "application/json" } });
        if (!response.ok) return;
        const results = await response.json() as Array<{ place_id: number; display_name: string; lat: string; lon: string; type?: string }>;
        setLocationSuggestions(results.map((result) => { const parts = result.display_name.split(",").map((part) => part.trim()); return { id: `place-${result.place_id}`, label: parts.slice(0, 2).join(", "), subtitle: parts.slice(2, 4).join(", ") || result.type || "Lokasi", latitude: Number(result.lat), longitude: Number(result.lon) }; }));
      } catch { /* Ignore aborted or unavailable autocomplete requests. */ }
    }, 320);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [search, searchedLocation]);

  const visibleReports = useMemo(() => reports.filter((report) => report.status !== "REJECTED" && (!filters.category || report.category === filters.category) && filters.status.includes(report.status) && (!filters.severity || report.severity === filters.severity)), [filters, reports]);
  const feedReports = useMemo(() => visibleReports.filter((report) => !feedSearch.trim() || [report.category, report.ticketNumber, report.description, report.policeUnit?.name, report.policeUnit?.district].filter(Boolean).some((value) => value!.toLowerCase().includes(feedSearch.trim().toLowerCase()))), [feedSearch, visibleReports]);
  const visibleFeedReports = feedReports.slice(0, feedVisibleCount);

  const popupAnchor = selectedUnit || (selectedZone?.reports.length ? { latitude: selectedZone.reports.reduce((sum, r) => sum + r.latitude, 0) / selectedZone.reports.length, longitude: selectedZone.reports.reduce((sum, r) => sum + r.longitude, 0) / selectedZone.reports.length } : null);
  const clearSelection = () => { setSelectedReport(null); setSelectedUnit(null); setSelectedZone(null); setFocusLocation(null); };
  const chooseLocation = (location: LocationSuggestion) => { setFollowingUser(false); setSearch(location.label); setLocationSuggestions([]); setSearchedLocation(location); setFocusLocation({ latitude: location.latitude, longitude: location.longitude }); setSelectedReport(null); setSelectedUnit(null); setSelectedZone(null); };
  const clearSearchedLocation = () => { setSearch(""); setLocationSuggestions([]); setSearchedLocation(null); setFocusLocation(null); };
  const searchLocation = async () => {
    const query = search.trim();
    if (!query) return;
    if (locationSuggestions[0]) { chooseLocation(locationSuggestions[0]); return; }
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=id&accept-language=id&q=${encodeURIComponent(query)}`);
      const result = await response.json() as Array<{ lat: string; lon: string; display_name: string }>;
      const location = result[0];
      if (location) { const parts = location.display_name.split(",").map((part) => part.trim()); chooseLocation({ id: `place-${location.lat}-${location.lon}`, label: parts.slice(0, 2).join(", "), subtitle: parts.slice(2, 4).join(", ") || "Lokasi", latitude: Number(location.lat), longitude: Number(location.lon) }); }
    } catch { /* Keep the public map usable when geocoding is unavailable. */ }
  };
  const centerOnUser = useCallback(() => {
    if (!navigator.geolocation) { setError("Perangkat ini tidak mendukung lokasi otomatis."); return; }
    navigator.geolocation.getCurrentPosition((position) => {
      const current = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setUserLocation(current);
      setFocusLocation(current);
      setError(null);
    }, () => setError("Lokasi belum tersedia. Izinkan akses lokasi di browser lalu coba lagi."), { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 });
    setFollowingUser(true);
    setSearchedLocation(null);
    setSearch("");
    setSelectedReport(null);
    setSelectedUnit(null);
    setSelectedZone(null);
  }, []);

  return <main className="relative h-screen min-h-[560px] overflow-hidden bg-[#eef0ed] text-[#171717]">
    <header className="absolute left-1/2 top-2 z-50 flex w-[96%] max-w-5xl -translate-x-1/2 items-center justify-between gap-2 rounded-full bg-white px-2.5 py-1.5 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.35)] sm:top-4 sm:gap-3 sm:px-4 sm:py-2.5">
      <div className="flex min-w-0 items-center justify-between gap-2 sm:flex-1 sm:justify-start sm:gap-3"><Link className="shrink-0" to="https://gardajakarta.my.id" aria-label="Beranda Garda Jakarta"><AppLogo className="h-6 w-auto max-w-[76px] object-contain sm:h-9 sm:max-w-none" size={145} aria-label="Garda Jakarta" /></Link><div className="flex shrink-0 rounded-full border border-gray-100 bg-gray-50 p-0.5 shadow-inner sm:p-1"><button type="button" onClick={() => setView("map")} className={`flex h-7 min-w-[48px] items-center justify-center gap-1 rounded-full px-1.5 text-[9px] font-black sm:h-8 sm:min-w-[74px] sm:px-3 sm:text-[11px] ${view === "map" ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:bg-white hover:text-gray-900"}`}><MapModeIcon /><span>Map</span></button><button type="button" onClick={() => setView("feed")} className={`flex h-7 min-w-[48px] items-center justify-center gap-1 rounded-full px-1.5 text-[9px] font-black sm:h-8 sm:min-w-[74px] sm:px-3 sm:text-[11px] ${view === "feed" ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:bg-white hover:text-gray-900"}`}><FeedModeIcon /><span>Feed</span></button></div></div>
      {user ? <div ref={accountRef} className="relative ml-auto shrink-0"><button type="button" onClick={() => setAccountOpen((open) => !open)} aria-expanded={accountOpen} aria-haspopup="menu" className="inline-flex h-8 items-center gap-2 rounded-full px-1.5 py-1 text-left hover:bg-gray-50 sm:h-9"><span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-[#e62428] text-[10px] font-black text-white sm:h-8 sm:w-8">{user.image ? <img className="h-full w-full object-cover" src={user.image} alt={`Foto profil ${user.name}`} referrerPolicy="no-referrer" /> : user.name.slice(0, 1).toUpperCase()}</span><span className="hidden max-w-[130px] sm:block"><strong className="block truncate text-[10px] font-black text-slate-900">{user.name}</strong><small className="block truncate text-[9px] font-bold text-[#e62428]">{user.role === "polisi" ? "Petugas polisi" : user.role === "admin" ? "Admin" : "Warga"}</small></span><span className="hidden text-slate-500 sm:block">⌄</span></button>{accountOpen && <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 rounded-xl border border-gray-100 bg-white p-2 shadow-2xl" role="menu"><div className="border-b border-gray-100 px-3 py-2.5"><strong className="block truncate text-xs">{user.name}</strong><span className="mt-1 block truncate text-[10px] text-gray-400">{user.email}</span></div><a href="/profile" role="menuitem" className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold hover:bg-red-50"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>Profile</a><a href="/dashboard" className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold hover:bg-red-50"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>Dashboard Warga</a><button type="button" onClick={() => { setAccountOpen(false); setSignoutOpen(true); }} className="mt-1 flex w-full items-center rounded-lg px-3 py-2.5 text-left text-xs font-bold text-red-700 hover:bg-red-50">Keluar</button></div>}</div> : <Link className="ml-auto inline-flex h-7 shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-[#e62428] px-2 text-[8px] font-bold leading-none text-white shadow-sm transition-colors hover:bg-[#c91d22] sm:h-8 sm:px-3 sm:text-[10px] md:h-auto md:px-4 md:py-2 md:text-[11px]" to="/login" aria-label="Masuk sebagai pelapor"><span className="sm:hidden">Masuk</span><span className="hidden sm:inline">Masuk sebagai pelapor</span></Link>}
    </header>
    <section className="absolute inset-0" aria-label={view === "map" ? "Peta publik keamanan Jakarta" : "Feed laporan keamanan Jakarta"}>
      {error && <p className="absolute left-4 top-[9.25rem] z-10 max-w-[calc(100%-32px)] border-l-4 border-[#e62428] bg-white px-4 py-3 text-xs font-bold text-[#a2191f] shadow-lg md:left-7 md:top-[128px]" role="alert">{error}</p>}
      {view === "map" ? <GardaMap popupAnchor={popupAnchor} onPopupPosition={setPopupPosition} className="!h-full !min-h-0" units={units} reports={visibleReports} showReportMarkers={filters.showReports} showPoliceMarkers={filters.showPoliceUnits} showSafetyZones={filters.showSafetyZones} userLocation={userLocation} followUser={followingUser && !selectedReport && !selectedUnit && !selectedZone} focusLocation={focusLocation} searchedLocation={searchedLocation} onClearSearchedLocation={clearSearchedLocation} onSelectReport={(report) => { setFollowingUser(false); setFocusLocation({ latitude: report.latitude, longitude: report.longitude }); setSelectedReport(report); setSelectedUnit(null); setSelectedZone(null); }} onSelectUnit={(unit) => { setFollowingUser(false); setFocusLocation({ latitude: unit.latitude, longitude: unit.longitude }); setSelectedUnit(unit); setSelectedReport(null); setSelectedZone(null); }} onSelectSafetyZone={(zone) => { setFollowingUser(false); setSelectedZone(zone); setSelectedReport(null); setSelectedUnit(null); }} /> : <div onScroll={(event) => { const t = event.currentTarget; if (!feedSelected && t.scrollTop + t.clientHeight >= t.scrollHeight - 200) setFeedVisibleCount((n) => Math.min(n + 10, feedReports.length)); }} className="h-full overflow-y-auto bg-[#f3f4f6] px-3 pb-28 pt-28 sm:px-5 sm:pt-24"><div className="mx-auto w-full max-w-2xl space-y-4">{feedSelected ? <article className="rounded-xl border border-slate-100 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)]"><button type="button" onClick={() => setFeedSelected(null)} className="mb-5 text-xs font-black text-[#e62428]">← Kembali ke feed</button><div className="flex items-start gap-3"><img src={categoryIllustration(feedSelected.category)} alt="" className="h-14 w-14 rounded-xl object-cover" /><div className="min-w-0"><h1 className="mt-2 text-2xl font-black leading-tight tracking-tight text-slate-950">{feedSelected.category}</h1><p className="mt-1 text-[10px] font-bold text-slate-400">{feedSelected.ticketNumber} · {feedSelected.policeUnit?.district || "Jakarta"}</p></div></div><div className="mt-5 border-t border-slate-100 pt-5"><PublicReportDetail report={feedSelected} /><ReportConversation key={feedSelected.id} reportId={feedSelected.id} readOnly /></div></article> : <><div><p className="text-[10px] font-black uppercase tracking-widest text-[#e62428]">Feed laporan</p><h1 className="mt-1 text-xl font-black tracking-tight text-slate-950">Isu Terkini</h1><p className="mt-1 text-xs font-semibold text-slate-400">Laporan keamanan warga yang sedang terjadi di sekitar Jakarta.</p></div>{feedReports.length === 0 ? <div className="rounded-xl bg-white px-5 py-16 text-center text-sm font-bold text-slate-400">Belum ada laporan yang sesuai.</div> : <div onScroll={(event) => { const target = event.currentTarget; if (target.scrollTop + target.clientHeight >= target.scrollHeight - 140 && feedVisibleCount < feedReports.length) setFeedVisibleCount((count) => Math.min(count + 10, feedReports.length)); }}>{visibleFeedReports.map((report) => <article key={report.id} className="mb-4 cursor-pointer rounded-xl border border-slate-100 bg-white p-4 shadow-[0_12px_32px_rgba(15,23,42,0.06)] transition hover:border-red-100" onClick={() => setFeedSelected(report)}><div className="flex items-start gap-3"><img src={categoryIllustration(report.category)} alt="" className="h-12 w-12 rounded-xl object-cover" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="truncate text-sm font-black text-slate-900">{report.category}</strong><PublicStatus status={report.status} /></div><p className="mt-1 text-[10px] font-bold text-slate-400">{report.ticketNumber} · {report.policeUnit?.district || "Jakarta"}</p></div></div>{report.description && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">{report.description}</p>}<div className="mt-3 flex items-center justify-between"><span className="text-[10px] font-bold text-slate-400">Tingkat {severityLabels[report.severity]}</span><button type="button" onClick={(event) => { event.stopPropagation(); setFollowingUser(false); setView("map"); setFocusLocation({ latitude: report.latitude, longitude: report.longitude }); setSelectedReport(report); }} className="rounded-full bg-slate-900 px-3 py-2 text-[10px] font-black text-white">Lihat di map</button></div></article>)}{feedVisibleCount < feedReports.length && <p className="py-3 text-center text-[10px] font-bold text-slate-400">Gulir untuk memuat laporan berikutnya...</p>}</div>}</>}</div></div>}
      {isLoading && <div className="pointer-events-none absolute inset-0 z-[15] bg-slate-950/5 p-4 pt-32 backdrop-blur-[1px]" role="status" aria-live="polite"><div className="mx-auto max-w-2xl"><ReportListSkeleton count={4} /></div></div>}
    </section>
    <div className="absolute left-1/2 top-[60px] z-40 flex w-[min(700px,calc(100vw-24px))] -translate-x-1/2 items-center gap-1.5 rounded-xl bg-white/95 p-1.5 shadow-lg backdrop-blur-sm sm:top-auto sm:bottom-6 sm:w-[min(380px,calc(100vw-24px))]">
      <div className="relative flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-black/5 bg-white/95 px-2.5 shadow-lg backdrop-blur-sm"><svg className="h-4 w-4 shrink-0 text-[#e62428]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg><input aria-label={view === "map" ? "Cari lokasi" : "Cari laporan"} value={view === "map" ? search : feedSearch} onChange={(event) => view === "map" ? (setSearch(event.target.value), setSearchedLocation(null), setLocationSuggestions([])) : (setFeedSearch(event.target.value), setFeedVisibleCount(10), setFeedSelected(null))} onKeyDown={(event) => { if (view === "map" && event.key === "Enter") void searchLocation(); }} placeholder={view === "map" ? "Cari lokasi..." : "Cari laporan..."} className="min-w-0 w-full bg-transparent py-2 text-[11px] font-bold text-slate-800 outline-none placeholder:text-slate-400" />{view === "map" && locationSuggestions.length > 0 && <div className="absolute left-0 right-0 top-[calc(100%+8px)] sm:top-auto sm:bottom-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border border-gray-100 bg-white p-1.5 shadow-[0_18px_44px_rgba(15,23,42,0.18)]" role="listbox" aria-label="Hasil lokasi"><p className="px-2.5 pb-1.5 pt-1 text-[9px] font-black uppercase tracking-[.15em] text-slate-400">Lokasi ditemukan</p>{locationSuggestions.map((location) => <button key={location.id} type="button" onClick={() => chooseLocation(location)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-[#fff3f0]"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#e5f7f4] text-[#177b86]">⌖</span><span className="min-w-0"><strong className="block truncate text-[11px] font-black text-slate-800">{location.label}</strong><span className="mt-0.5 block truncate text-[10px] font-medium text-slate-400">{location.subtitle}</span></span></button>)}</div>}</div>
      {<MapFilterMenu mobile alignRight value={filters} onChange={setFilters} categories={categories} publicOnly />}
    </div>
    {view === "map" && <CurrentLocationButton onClick={centerOnUser} className="fixed left-3 bottom-6 z-40 sm:absolute sm:left-4 sm:top-auto sm:bottom-20" />}
    {view === "map" && (selectedReport || selectedUnit || selectedZone) && <PublicDetailContainer desktop={isDesktop} anchor={Boolean(popupAnchor)} position={popupPosition} onClose={clearSelection}><aside className="fixed bottom-0 left-0 right-0 z-[70] max-h-[78dvh] w-full overflow-x-hidden overflow-y-auto rounded-t-2xl rounded-b-none border border-black/5 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-18px_45px_rgba(15,23,42,0.18)] sm:absolute sm:bottom-7 sm:left-auto sm:right-7 sm:max-h-[70dvh] sm:w-[min(340px,calc(100vw-24px))] sm:rounded-xl sm:shadow-2xl" aria-live="polite"><button type="button" className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-[#777] transition-colors hover:bg-black/5" onClick={clearSelection} aria-label="Tutup detail"><CloseIcon /></button>{selectedUnit ? <><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.15em] text-[#e62428]">Kantor polisi</span>{selectedUnit.photoUrl && <button type="button" className="group relative mb-4 block w-full overflow-hidden rounded-lg" onClick={() => setPreviewImage({ src: selectedUnit.photoUrl!, alt: selectedUnit.name })} aria-label={`Lihat foto ${selectedUnit.name}`}><img className="h-36 w-full object-cover transition-transform group-hover:scale-[1.02]" src={selectedUnit.photoUrl} alt={selectedUnit.name} referrerPolicy="no-referrer" /><span className="absolute bottom-2 right-2 rounded-md bg-slate-950/70 px-2 py-1 text-[10px] font-bold text-white">Lihat foto</span></button>}<h2 className="pr-5 text-lg font-bold tracking-tight">{selectedUnit.name}</h2><p className="mt-1 text-xs leading-5 text-[#6c6c67]">{selectedUnit.district} · {selectedUnit.address}</p><p className="mt-2 text-xs font-bold text-[#555]">{selectedUnit.phone || "Kontak layanan publik"}</p><a className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#e62428] px-4 py-2 text-xs font-black text-white" href={`https://www.google.com/maps/dir/?api=1&destination=${selectedUnit.latitude},${selectedUnit.longitude}`} target="_blank" rel="noreferrer">Arahkan ke kantor polisi <span aria-hidden="true">→</span></a></> : selectedZone ? <><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.15em] text-[#e62428]">Area laporan</span><h2 className="pr-5 text-lg font-bold tracking-tight">Indeks keamanan area</h2><p className="mt-1 text-xs text-[#6c6c67]">Perhatian {selectedZone.level} · skor {selectedZone.score}/4</p><div className="mt-3 flex gap-2"><input aria-label="Cari laporan area" placeholder="Cari laporan..." value={areaQuery} onChange={e => setAreaQuery(e.target.value)} className="min-w-0 flex-1 rounded-lg border px-2 py-2 text-xs" /><CustomStatusSelect value={areaStatus} onChange={setAreaStatus} /></div><div className="mt-3 grid min-w-0 grid-cols-1 gap-2">{selectedZone.reports.length ? selectedZone.reports.filter(r => (areaStatus === "ALL" || r.status === areaStatus) && [r.category, r.ticketNumber, r.description].some(value => value?.toLowerCase().includes(areaQuery.toLowerCase()))).map((report) => <button key={report.id} type="button" className="min-w-0 rounded-lg border border-[#eee] px-3 py-2 text-left hover:bg-[#fff4f4]" onClick={() => { setSelectedZone(null); setFocusLocation({ latitude: report.latitude, longitude: report.longitude }); setSelectedReport(report); }}><img src={categoryIllustration(report.category)} alt="" className="mb-2 h-12 w-12 rounded-lg object-cover" /><strong title={report.category} className="block truncate text-xs">{report.category}</strong><span className="mt-1 block font-mono text-[10px] text-[#777]">{report.ticketNumber} · titik laporan</span></button>) : <p className="rounded-lg bg-[#f7f7f4] px-3 py-3 text-xs font-semibold text-[#777]">Belum ada laporan terhubung di area ini.</p>}</div></> : <><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.15em] text-[#e62428]">Laporan keamanan</span><h2 className="pr-5 text-lg font-bold tracking-tight">{selectedReport?.category}</h2><p className="mt-1 text-xs text-[#6c6c67]">{selectedReport?.ticketNumber} · {selectedReport?.policeUnit?.district || "Jakarta"}</p><div className="mt-3"><PublicReportDetail report={selectedReport!} /><ReportConversation key={selectedReport!.id} reportId={selectedReport!.id} readOnly /></div></>}</aside></PublicDetailContainer>}
    {previewImage && <ImagePreview src={previewImage.src} alt={previewImage.alt} onClose={() => setPreviewImage(null)} />}
    {signoutOpen && <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/35 px-5 backdrop-blur-sm"><section className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" role="alertdialog" aria-modal="true"><h2 className="text-lg font-black">Keluar dari akun?</h2><p className="mt-2 text-xs text-slate-500">Sesi di perangkat ini akan ditutup.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setSignoutOpen(false)} className="rounded-lg px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100">Batal</button><button type="button" onClick={() => void handleSignOut()} className="rounded-lg bg-[#e62428] px-4 py-2.5 text-xs font-bold text-white">Keluar</button></div></section></div>}
  </main>;
}





