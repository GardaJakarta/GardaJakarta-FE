import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppLogo from "../components/branding/AppLogo";
import GardaMap from "../components/GardaMap";
import { getPublicMap } from "../lib/api";
import type { IncidentReport, PoliceUnit } from "../types";

export default function PublicMapPage() {
  const [units, setUnits] = useState<PoliceUnit[]>([]);
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [selected, setSelected] = useState<IncidentReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { try { const data = await getPublicMap(); setUnits(data.units); setReports(data.reports); } catch { setError("Peta belum dapat dimuat. Periksa koneksi lalu coba lagi."); } }, []);
  // Public map data is synchronized with the public API.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  return <main className="public-map-page"><header className="dashboard-header"><Link className="map-brand" to="https://gardajakarta.my.id" aria-label="Beranda Garda Jakarta"><AppLogo size={155} aria-label="Garda Jakarta" /></Link><div className="public-map-actions"><span>Mode lihat saja</span><Link className="primary-button" to="/login">Masuk untuk melapor</Link></div></header><section className="public-map-shell"><div className="public-map-heading"><div><p className="eyebrow">Peta interaktif</p><h1>Kenali situasi Jakarta sebelum beraktivitas.</h1><p>Marker laporan ditampilkan sebagai pola informasi publik. Detail sensitif dan identitas pelapor tidak ditampilkan.</p></div><div className="map-legend"><span><i className="legend-dot legend-report" />Laporan</span><span><i className="legend-dot legend-police" />Kantor polisi</span></div></div>{error && <p className="dashboard-error" role="alert">{error}</p>}<div className="public-map-canvas"><GardaMap units={units} reports={reports} interactive={false} onSelectReport={setSelected} />{selected && <aside className="public-map-detail"><button type="button" onClick={() => setSelected(null)} aria-label="Tutup detail">×</button><p className="eyebrow">Laporan publik</p><h2>{selected.category}</h2><p>{selected.ticketNumber} · {selected.policeUnit?.district || "Jakarta"}</p><span className={`status-badge status-${selected.status.toLowerCase()}`}>{selected.status}</span></aside>}</div></section></main>;
}
