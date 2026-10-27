import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppLogo from "../components/branding/AppLogo";
import GardaMap from "../components/GardaMap";
import { getPublicMap } from "../lib/api";
import type { IncidentReport, PoliceUnit, ReportSeverity, ReportStatus } from "../types";

const categories = ["Pelecehan verbal atau catcalling", "Pelecehan atau kekerasan seksual", "Pencurian atau perampasan", "Begal atau perampokan", "Kekerasan fisik", "Tawuran atau kerumunan berbahaya", "Penipuan atau pemerasan", "Gangguan penerangan atau fasilitas yang berdampak pada keamanan", "Lainnya"];
const statusLabels: Record<ReportStatus, string> = { PENDING: "Menunggu", VERIFIED: "Terverifikasi", IN_PROGRESS: "Diproses", RESOLVED: "Selesai", REJECTED: "Ditolak" };
const severityLabels: Record<ReportSeverity, string> = { P0: "Kritis", P1: "Tinggi", P2: "Sedang", P3: "Rendah" };

function PublicStatus({ status }: { status: ReportStatus }) { return <span className={`status-badge status-${status.toLowerCase()}`}>{statusLabels[status]}</span>; }

export default function PublicMapPage() {
  const [units, setUnits] = useState<PoliceUnit[]>([]);
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<IncidentReport | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<PoliceUnit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<{ category: string; status: ReportStatus | ""; severity: ReportSeverity | "" }>({ category: "", status: "", severity: "" });

  const load = useCallback(async () => {
    setIsLoading(true);
    try { const data = await getPublicMap(); setUnits(data.units); setReports(data.reports); setError(null); }
    catch { setError("Peta belum dapat dimuat. Periksa koneksi lalu coba lagi."); }
    finally { setIsLoading(false); }
  }, []);
  // Public map data is synchronized with the public API.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const visibleReports = useMemo(() => reports.filter((report) => report.status !== "REJECTED" && (!filters.category || report.category === filters.category) && (!filters.status || report.status === filters.status) && (!filters.severity || report.severity === filters.severity)), [filters, reports]);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const clearSelection = () => { setSelectedReport(null); setSelectedUnit(null); };

  return <main className="relative h-screen min-h-[560px] overflow-hidden bg-[#eef0ed] text-[#171717]">
    <header className="absolute left-1/2 top-1 z-20 flex h-9 w-[calc(100%-1rem)] -translate-x-1/2 items-center justify-between rounded-lg border border-black/5 bg-white/95 px-1.5 shadow-[0_8px_28px_-10px_rgba(15,23,42,0.22)] backdrop-blur-md sm:top-3 sm:h-12 sm:w-[calc(100%-2rem)] sm:rounded-full sm:px-4 md:top-4 md:h-16 md:w-auto md:max-w-[calc(100%-3.5rem)] md:px-7">
      <Link className="shrink-0" to="https://gardajakarta.my.id" aria-label="Beranda Garda Jakarta"><AppLogo className="h-auto w-[64px] max-w-[42vw] sm:w-[92px] md:h-9 md:w-auto" size={145} aria-label="Garda Jakarta" /></Link>
      <Link className="ml-auto inline-flex h-7 shrink-0 items-center justify-center rounded-lg bg-[#e62428] px-2.5 text-[9px] font-bold leading-none text-white transition-colors hover:bg-[#c91d22] sm:h-8 sm:px-3 sm:text-[10px] md:h-auto md:px-4 md:py-2 md:text-[11px]" to="/login">Masuk untuk melapor</Link>
    </header>
    <section className="absolute inset-0 pt-10 sm:pt-12 md:pt-16" aria-label="Peta publik keamanan Jakarta">
      {error && <p className="absolute left-4 top-[76px] z-10 max-w-[calc(100%-32px)] border-l-4 border-[#e62428] bg-white px-4 py-3 text-xs font-bold text-[#a2191f] shadow-lg md:left-7 md:top-[128px]" role="alert">{error}</p>}
      <GardaMap className="!h-full !min-h-0" units={units} reports={visibleReports} onSelectReport={(report) => { setSelectedReport(report); setSelectedUnit(null); }} onSelectUnit={(unit) => { setSelectedUnit(unit); setSelectedReport(null); }} />
    </section>
    <div className="absolute left-3 top-[43px] z-10 sm:top-[52px] md:left-7 md:top-[80px]">
      <button type="button" className={`inline-flex h-8 items-center gap-2 rounded-md bg-white px-3 text-[11px] font-bold shadow-lg transition-colors hover:bg-[#fff4f4] sm:h-9 sm:rounded-lg sm:text-xs ${activeFilterCount ? "text-[#e62428]" : "text-[#4d4d47]"}`} aria-expanded={filtersOpen} onClick={() => setFiltersOpen((current) => !current)}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 5h16v2H4V5Zm3 6h10v2H7v-2Zm3 6h4v2h-4v-2Z" /></svg>
        Filter
        {activeFilterCount > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[#e62428] px-1 text-[9px] text-white">{activeFilterCount}</span>}
      </button>
      {filtersOpen && <div className="mt-2 w-[min(320px,calc(100vw-24px))] rounded-xl border border-black/5 bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between"><strong className="text-sm">Filter peta</strong><button type="button" className="text-xs font-bold text-[#e62428]" onClick={() => setFilters({ category: "", status: "", severity: "" })}>Reset</button></div>
        <div className="grid gap-3">
          <label className="grid gap-1 text-[11px] font-bold text-[#555]"><span>Kategori</span><select className="rounded-lg border border-[#d9d9d3] bg-white px-2.5 py-2 text-xs outline-none focus:border-[#e62428]" value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}><option value="">Semua kategori</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label className="grid gap-1 text-[11px] font-bold text-[#555]"><span>Status</span><select className="rounded-lg border border-[#d9d9d3] bg-white px-2.5 py-2 text-xs outline-none focus:border-[#e62428]" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as ReportStatus | "" }))}><option value="">Semua status</option>{Object.entries(statusLabels).filter(([status]) => status !== "REJECTED").map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></label>
          <label className="grid gap-1 text-[11px] font-bold text-[#555]"><span>Keparahan</span><select className="rounded-lg border border-[#d9d9d3] bg-white px-2.5 py-2 text-xs outline-none focus:border-[#e62428]" value={filters.severity} onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value as ReportSeverity | "" }))}><option value="">Semua tingkat</option>{Object.entries(severityLabels).map(([severity, label]) => <option key={severity} value={severity}>{label}</option>)}</select></label>
        </div>
        <p className="mt-3 text-[10px] text-[#85857e]">{isLoading ? "Memuat laporan..." : `${visibleReports.length} laporan ditampilkan`}</p>
      </div>}
    </div>
    {(selectedReport || selectedUnit) && <aside className="absolute bottom-3 right-3 z-10 w-[min(340px,calc(100vw-24px))] rounded-xl border border-black/5 bg-white p-5 shadow-2xl sm:bottom-7 sm:right-7" aria-live="polite"><button type="button" className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full text-xl leading-none text-[#777] transition-colors hover:bg-black/5" onClick={clearSelection} aria-label="Tutup detail">×</button>{selectedUnit ? <><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.15em] text-[#e62428]">Kantor polisi</span>{selectedUnit.photoUrl && <img className="mb-4 h-32 w-full rounded-lg object-cover" src={selectedUnit.photoUrl} alt={selectedUnit.name} referrerPolicy="no-referrer" />}<h2 className="pr-5 text-lg font-bold tracking-tight">{selectedUnit.name}</h2><p className="mt-1 text-xs leading-5 text-[#6c6c67]">{selectedUnit.district} · {selectedUnit.address}</p><p className="mt-2 text-xs font-bold text-[#555]">{selectedUnit.phone || "Kontak layanan publik"}</p></> : <><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.15em] text-[#e62428]">Laporan keamanan</span><h2 className="pr-5 text-lg font-bold tracking-tight">{selectedReport?.category}</h2><p className="mt-1 text-xs text-[#6c6c67]">{selectedReport?.ticketNumber} · {selectedReport?.policeUnit?.district || "Jakarta"}</p><div className="mt-3"><PublicStatus status={selectedReport!.status} /></div></>}</aside>}
  </main>;
}
