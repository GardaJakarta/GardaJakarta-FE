import { useRef, useState } from "react";
import { MagnifyingGlass, MapPin, NavigationArrow } from "@phosphor-icons/react";
import GardaMap from "../GardaMap";
import { button, field, quietButton } from "./admin-styles";

type Point = { latitude: number; longitude: number };
type Place = Point & { id: string; label: string };
export default function LocationPicker({ value, onChange, disabled }: { value: Point; onChange: (point: Point) => void; disabled: boolean }) {
  const [query, setQuery] = useState(""), [results, setResults] = useState<Place[]>([]), [error, setError] = useState(""), [loading, setLoading] = useState(false);
  const [focus, setFocus] = useState<Point>(value);
  const requestId = useRef(0);
  const select = (point: Point) => {
    if (disabled) return;
    if (point.latitude < -7.2 || point.latitude > -5.8 || point.longitude < 106.4 || point.longitude > 107.2) { setError("Pilih lokasi di wilayah Jakarta dan sekitarnya."); return; }
    setError(""); onChange(point);
  };
  async function search() {
    if (!query.trim() || disabled) return;
    const id = ++requestId.current;
    setLoading(true); setError(""); setResults([]);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=id&accept-language=id&viewbox=106.4,-5.8,107.2,-7.2&bounded=1&q=${encodeURIComponent(query.trim())}`);
      if (!response.ok) throw new Error();
      const rows = await response.json() as Array<{ place_id: number; display_name: string; lat: string; lon: string }>;
      if (id !== requestId.current) return;
      setResults(rows.map((row) => ({ id: String(row.place_id), label: row.display_name, latitude: Number(row.lat), longitude: Number(row.lon) })));
      if (!rows.length) setError("Lokasi belum ditemukan. Coba nama jalan atau tandai langsung pada peta.");
    } catch { if (id === requestId.current) setError("Pencarian belum tersedia. Kamu tetap bisa menandai lokasi pada peta."); }
    finally { if (id === requestId.current) setLoading(false); }
  }
  return <section className="space-y-3" aria-label="Pilih lokasi pada peta">
    <div><h3 className="text-xs font-semibold">Lokasi <span className="text-red-600">*</span></h3><p className="mt-1 text-xs leading-relaxed text-slate-500">Cari alamat, klik peta, atau geser pin untuk menentukan lokasi.</p></div>
    <div className="relative"><div className="flex gap-2"><input aria-label="Cari lokasi" value={query} disabled={disabled} placeholder="Cari nama tempat atau alamat..." className={field} onChange={(event) => { setQuery(event.target.value); setResults([]); requestId.current++; setLoading(false); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void search(); } if (event.key === "Escape") setResults([]); }} /><button type="button" disabled={loading || disabled || !query.trim()} onClick={() => void search()} className={button}><MagnifyingGlass size={18} />Cari</button></div>
      {loading && <div role="status" aria-label="Mencari lokasi" className="absolute inset-x-0 top-full z-30 mt-2 space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"><div className="h-4 animate-pulse rounded bg-slate-100" /><div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" /></div>}
      {results.length > 0 && <div className="absolute inset-x-0 top-full z-30 mt-2 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl" aria-label="Hasil pencarian lokasi">{results.map((place) => <button key={place.id} type="button" className="flex w-full items-start gap-2 rounded-lg p-3 text-left text-xs leading-relaxed hover:bg-red-50" onClick={() => { select(place); setFocus(place); setQuery(place.label); setResults([]); }}><MapPin size={17} className="mt-0.5 shrink-0 text-red-600" />{place.label}</button>)}</div>}
    </div>
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    <div className="relative h-72 overflow-hidden rounded-xl border border-slate-200 sm:h-80"><GardaMap units={[]} reports={[]} draftLocation={value} draftActive focusLocation={focus} onMapClick={select} onDraftLocationChange={select} interactive={!disabled} showSafetyZones={false} showPoliceMarkers={false} showReportMarkers={false} className="h-full w-full" /><button type="button" disabled={disabled} onClick={() => { if (!navigator.geolocation) { setError("Lokasi perangkat tidak tersedia."); return; } navigator.geolocation.getCurrentPosition(({ coords }) => { const point = { latitude: coords.latitude, longitude: coords.longitude }; select(point); setFocus(point); }, () => setError("Akses lokasi ditolak. Cari alamat atau klik peta.")); }} className={quietButton + " absolute bottom-3 left-3 z-10 shadow-md"}><NavigationArrow size={16} />Lokasi saya</button></div>
    <p className="text-[11px] text-slate-500">Titik terpilih: {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}</p>
  </section>;
}
