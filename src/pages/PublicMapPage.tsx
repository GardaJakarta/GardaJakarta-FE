import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppLogo from "../components/branding/AppLogo";
import ImagePreview from "../components/ImagePreview";
import GardaMap from "../components/GardaMap";
import { getPublicMap } from "../lib/api";
import type { IncidentReport, PoliceUnit, ReportSeverity, ReportStatus } from "../types";

const categories = ["Pelecehan verbal atau catcalling", "Pelecehan atau kekerasan seksual", "Pencurian atau perampasan", "Begal atau perampokan", "Kekerasan fisik", "Tawuran atau kerumunan berbahaya", "Penipuan atau pemerasan", "Gangguan penerangan atau fasilitas yang berdampak pada keamanan", "Lainnya"];
const statusLabels: Record<ReportStatus, string> = { PENDING: "Menunggu", VERIFIED: "Terverifikasi", IN_PROGRESS: "Diproses", RESOLVED: "Selesai", REJECTED: "Ditolak" };
const severityLabels: Record<ReportSeverity, string> = { P0: "Kritis", P1: "Tinggi", P2: "Sedang", P3: "Rendah" };
const severityColors: Record<ReportSeverity, string> = { P0: "bg-red-50 text-red-700", P1: "bg-orange-50 text-orange-700", P2: "bg-amber-50 text-amber-700", P3: "bg-slate-50 text-slate-600" };

const statusIcons: Record<ReportStatus, string> = { PENDING: "◷", VERIFIED: "✓", IN_PROGRESS: "↗", RESOLVED: "✓", REJECTED: "×" };
function PublicStatus({ status }: { status: ReportStatus }) { return <span className={`status-badge status-${status.toLowerCase()}`}><span aria-hidden="true">{statusIcons[status]}</span>{statusLabels[status]}</span>; }
function PublicReportDetail({ report }: { report: IncidentReport }) {
  return <div className="grid gap-3 text-xs text-[#6c6c67]"><div className="flex flex-wrap items-center gap-2"><PublicStatus status={report.status} /><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${severityColors[report.severity]}`}>{severityLabels[report.severity]}</span></div><div><span className="block text-[10px] font-bold uppercase tracking-widest text-[#a0a09a]">Nomor laporan</span><strong className="mt-1 block font-mono text-slate-900">{report.ticketNumber}</strong></div><div><span className="block text-[10px] font-bold uppercase tracking-widest text-[#a0a09a]">Wilayah penanganan</span><strong className="mt-1 block text-slate-900">{report.policeUnit?.name || "Unit terdekat"}</strong><span className="mt-0.5 block">{report.policeUnit?.district || "Jakarta"}</span></div>{report.description && <div><span className="block text-[10px] font-bold uppercase tracking-widest text-[#a0a09a]">Ringkasan</span><p className="mt-1 leading-relaxed">{report.description}</p></div>}<div><span className="block text-[10px] font-bold uppercase tracking-widest text-[#a0a09a]">Lokasi</span><span className="mt-1 block">Area laporan dianonimkan pada peta publik · {report.latitude.toFixed(3)}, {report.longitude.toFixed(3)}</span></div></div>;
}

export default function PublicMapPage() {
  const [units, setUnits] = useState<PoliceUnit[]>([]);
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<IncidentReport | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<PoliceUnit | null>(null);
  const [selectedZone, setSelectedZone] = useState<{ reports: IncidentReport[]; level: string; score: number } | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [focusLocation, setFocusLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<{ category: string; status: ReportStatus | ""; severity: ReportSeverity | "" }>({ category: "", status: "", severity: "" });
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);

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
    const watchId = geolocation.watchPosition(updateLocation, () => undefined, { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 });
    return () => { if (typeof geolocation.clearWatch === "function") geolocation.clearWatch(watchId); };
  }, []);

  const visibleReports = useMemo(() => reports.filter((report) => report.status !== "REJECTED" && (!filters.category || report.category === filters.category) && (!filters.status || report.status === filters.status) && (!filters.severity || report.severity === filters.severity)), [filters, reports]);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const clearSelection = () => { setSelectedReport(null); setSelectedUnit(null); setSelectedZone(null); };
  const searchLocation = async () => {
    const query = search.trim().toLowerCase();
    if (!query) return;
    const unit = units.find((candidate) => [candidate.name, candidate.district, candidate.address].some((value) => value.toLowerCase().includes(query)));
    if (unit) { setFocusLocation({ latitude: unit.latitude, longitude: unit.longitude }); setSelectedUnit(unit); setSelectedReport(null); setSelectedZone(null); return; }
    const report = visibleReports.find((candidate) => [candidate.category, candidate.ticketNumber, candidate.policeUnit?.name, candidate.policeUnit?.district].filter(Boolean).some((value) => value!.toLowerCase().includes(query)));
    if (report) { setFocusLocation({ latitude: report.latitude, longitude: report.longitude }); setSelectedReport(report); setSelectedUnit(null); setSelectedZone(null); return; }
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=id&q=${encodeURIComponent(search.trim())}`);
      const result = await response.json() as Array<{ lat: string; lon: string }>;
      const location = result[0];
      if (location) setFocusLocation({ latitude: Number(location.lat), longitude: Number(location.lon) });
    } catch { /* Keep the public map usable when geocoding is unavailable. */ }
  };

  return <main className="relative h-screen min-h-[560px] overflow-hidden bg-[#eef0ed] text-[#171717]">
    <header className="absolute left-1/2 top-1.5 z-20 flex h-9 w-[calc(100%-1rem)] -translate-x-1/2 items-center justify-between rounded-lg border border-black/5 bg-white/95 px-2 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.35)] backdrop-blur-md sm:top-3 sm:h-12 sm:w-[calc(100%-2rem)] sm:rounded-full sm:px-4 md:top-4 md:h-16 md:w-auto md:max-w-[calc(100%-3.5rem)] md:px-7">
      <Link className="shrink-0" to="https://gardajakarta.my.id" aria-label="Beranda Garda Jakarta"><AppLogo className="h-auto w-[60px] max-w-[42vw] sm:w-[92px] md:h-9 md:w-auto" size={145} aria-label="Garda Jakarta" /></Link>
      <Link className="ml-auto inline-flex h-7 shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-[#e62428] px-2 text-[8px] font-bold leading-none text-white shadow-sm transition-colors hover:bg-[#c91d22] sm:h-8 sm:px-3 sm:text-[10px] md:h-auto md:px-4 md:py-2 md:text-[11px]" to="/login" aria-label="Masuk untuk melapor"><span className="sm:hidden">Masuk</span><span className="hidden sm:inline">Masuk untuk melapor</span></Link>
    </header>
    <section className="absolute inset-0 pt-9 sm:pt-12 md:pt-16" aria-label="Peta publik keamanan Jakarta">
      {error && <p className="absolute left-4 top-[76px] z-10 max-w-[calc(100%-32px)] border-l-4 border-[#e62428] bg-white px-4 py-3 text-xs font-bold text-[#a2191f] shadow-lg md:left-7 md:top-[128px]" role="alert">{error}</p>}
      <GardaMap className="!h-full !min-h-0" units={units} reports={visibleReports} userLocation={userLocation} focusLocation={focusLocation} onSelectReport={(report) => { setFocusLocation({ latitude: report.latitude, longitude: report.longitude }); setSelectedReport(report); setSelectedUnit(null); setSelectedZone(null); }} onSelectUnit={(unit) => { setFocusLocation({ latitude: unit.latitude, longitude: unit.longitude }); setSelectedUnit(unit); setSelectedReport(null); setSelectedZone(null); }} onSelectSafetyZone={(zone) => { setSelectedZone(zone); setSelectedReport(null); setSelectedUnit(null); }} showSafetyZones />
      {isLoading && <div className="pointer-events-none absolute inset-0 z-[15] grid place-items-center bg-white/55 backdrop-blur-[1px]" role="status" aria-live="polite"><div className="grid justify-items-center gap-3 rounded-2xl bg-white/90 px-6 py-5 text-center shadow-[0_18px_48px_rgba(15,23,42,0.14)]"><AppLogo size={96} aria-label="Garda Jakarta" /><span className="garda-loading-mark h-6 w-6" aria-hidden="true" /><p className="text-[10px] font-black tracking-wide text-slate-500">Memeriksa keamanan Jakarta...</p></div></div>}
    </section>
    <div className="absolute left-2 right-2 top-[38px] z-10 flex max-w-[520px] items-center gap-1.5 sm:left-3 sm:right-auto sm:top-[52px] md:left-7 md:top-[80px]">
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-black/5 bg-white/95 px-2.5 shadow-lg backdrop-blur-sm"><svg className="h-4 w-4 shrink-0 text-[#e62428]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg><input aria-label="Cari lokasi atau laporan" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchLocation(); }} placeholder="Cari lokasi atau laporan..." className="min-w-0 w-full bg-transparent py-2 text-[11px] font-bold text-slate-800 outline-none placeholder:text-slate-400" /></div>
      <button type="button" className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-lg bg-white px-3 text-[11px] font-bold shadow-lg transition-colors hover:bg-[#fff4f4] sm:h-9 sm:text-xs ${activeFilterCount ? "text-[#e62428]" : "text-[#4d4d47]"}`} aria-expanded={filtersOpen} onClick={() => setFiltersOpen((current) => !current)}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 5h16v2H4V5Zm3 6h10v2H7v-2Zm3 6h4v2h-4v-2Z" /></svg>
        Filter
        {activeFilterCount > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[#e62428] px-1 text-[9px] text-white">{activeFilterCount}</span>}
      </button>
      {filtersOpen && <div className="absolute left-0 top-10 z-20 max-h-[calc(100dvh-100px)] w-[min(320px,calc(100vw-24px))] overflow-y-auto rounded-xl border border-black/5 bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between"><strong className="text-sm">Filter peta</strong><button type="button" className="text-xs font-bold text-[#e62428]" onClick={() => setFilters({ category: "", status: "", severity: "" })}>Reset</button></div>
        <div className="grid gap-3">
          <label className="grid gap-1 text-[11px] font-bold text-[#555]"><span>Kategori</span><select className="rounded-lg border border-[#d9d9d3] bg-white px-2.5 py-2 text-xs outline-none focus:border-[#e62428]" value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}><option value="">Semua kategori</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label className="grid gap-1 text-[11px] font-bold text-[#555]"><span>Status</span><select className="rounded-lg border border-[#d9d9d3] bg-white px-2.5 py-2 text-xs outline-none focus:border-[#e62428]" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as ReportStatus | "" }))}><option value="">Semua status</option>{Object.entries(statusLabels).filter(([status]) => status !== "REJECTED").map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></label>
          <label className="grid gap-1 text-[11px] font-bold text-[#555]"><span>Keparahan</span><select className="rounded-lg border border-[#d9d9d3] bg-white px-2.5 py-2 text-xs outline-none focus:border-[#e62428]" value={filters.severity} onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value as ReportSeverity | "" }))}><option value="">Semua tingkat</option>{Object.entries(severityLabels).map(([severity, label]) => <option key={severity} value={severity}>{label}</option>)}</select></label>
        </div>
        <p className="mt-3 text-[10px] text-[#85857e]">{isLoading ? "Memuat laporan..." : `${visibleReports.length} laporan ditampilkan`}</p>
      </div>}
    </div>
    {(selectedReport || selectedUnit || selectedZone) && <aside className="fixed bottom-0 left-0 right-0 z-30 max-h-[78dvh] w-full overflow-y-auto rounded-t-2xl rounded-b-none border border-black/5 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-18px_45px_rgba(15,23,42,0.18)] sm:absolute sm:bottom-7 sm:left-auto sm:right-7 sm:max-h-[70dvh] sm:w-[min(340px,calc(100vw-24px))] sm:rounded-xl sm:shadow-2xl" aria-live="polite"><button type="button" className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full text-xl leading-none text-[#777] transition-colors hover:bg-black/5" onClick={clearSelection} aria-label="Tutup detail">×</button>{selectedUnit ? <><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.15em] text-[#e62428]">Kantor polisi</span>{selectedUnit.photoUrl && <button type="button" className="group relative mb-4 block w-full overflow-hidden rounded-lg" onClick={() => setPreviewImage({ src: selectedUnit.photoUrl!, alt: selectedUnit.name })} aria-label={`Lihat foto ${selectedUnit.name}`}><img className="h-36 w-full object-cover transition-transform group-hover:scale-[1.02]" src={selectedUnit.photoUrl} alt={selectedUnit.name} referrerPolicy="no-referrer" /><span className="absolute bottom-2 right-2 rounded-md bg-slate-950/70 px-2 py-1 text-[10px] font-bold text-white">Lihat foto</span></button>}<h2 className="pr-5 text-lg font-bold tracking-tight">{selectedUnit.name}</h2><p className="mt-1 text-xs leading-5 text-[#6c6c67]">{selectedUnit.district} · {selectedUnit.address}</p><p className="mt-2 text-xs font-bold text-[#555]">{selectedUnit.phone || "Kontak layanan publik"}</p><a className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#e62428] px-4 text-xs font-black text-white" href={`https://www.google.com/maps/dir/?api=1&destination=${selectedUnit.latitude},${selectedUnit.longitude}`} target="_blank" rel="noreferrer">Arahkan ke kantor polisi <span aria-hidden="true">→</span></a></> : selectedZone ? <><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.15em] text-[#e62428]">Area laporan</span><h2 className="pr-5 text-lg font-bold tracking-tight">Indeks keamanan area</h2><p className="mt-1 text-xs text-[#6c6c67]">Perhatian {selectedZone.level} · skor {selectedZone.score}/4</p><div className="mt-3 grid gap-2">{selectedZone.reports.length ? selectedZone.reports.map((report) => <button key={report.id} type="button" className="rounded-lg border border-[#eee] px-3 py-2 text-left hover:bg-[#fff4f4]" onClick={() => { setSelectedZone(null); setFocusLocation({ latitude: report.latitude, longitude: report.longitude }); setSelectedReport(report); }}><strong className="block text-xs">{report.category}</strong><span className="mt-1 block font-mono text-[10px] text-[#777]">{report.ticketNumber} · titik laporan</span></button>) : <p className="rounded-lg bg-[#f7f7f4] px-3 py-3 text-xs font-semibold text-[#777]">Belum ada laporan terhubung di area ini.</p>}</div></> : <><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.15em] text-[#e62428]">Laporan keamanan</span><h2 className="pr-5 text-lg font-bold tracking-tight">{selectedReport?.category}</h2><p className="mt-1 text-xs text-[#6c6c67]">{selectedReport?.ticketNumber} · {selectedReport?.policeUnit?.district || "Jakarta"}</p><div className="mt-3"><PublicReportDetail report={selectedReport!} /></div></>}</aside>}
    {previewImage && <ImagePreview src={previewImage.src} alt={previewImage.alt} onClose={() => setPreviewImage(null)} />}
  </main>;
}
