import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapInstance, Marker } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import type { IncidentReport, PoliceUnit } from "../types";

const JAKARTA_CENTER: [number, number] = [106.8272, -6.1754];
maplibregl.setWorkerUrl(maplibreWorkerUrl);

type GardaMapProps = {
  units: PoliceUnit[];
  reports: IncidentReport[];
  className?: string;
  onMapClick?: (coordinates: { latitude: number; longitude: number }) => void;
  onSelectReport?: (report: IncidentReport) => void;
  interactive?: boolean;
};

const SAFETY_SOURCE_ID = "garda-safety-zones";
const SAFETY_FILL_ID = "garda-safety-zone-fill";
const SAFETY_OUTLINE_ID = "garda-safety-zone-outline";

type SafetyZone = {
  center: [number, number];
  reports: IncidentReport[];
};

function safetyScore(report: IncidentReport) {
  const severity = { P0: 4, P1: 3, P2: 2, P3: 1 }[report.severity];
  const status = { PENDING: 1, VERIFIED: 1.15, IN_PROGRESS: 0.8, RESOLVED: 0.35, REJECTED: 0 }[report.status];
  return severity * status;
}

function safetyLevel(score: number) {
  if (score >= 3) return "tinggi";
  if (score >= 1.8) return "sedang";
  return "rendah";
}

function buildSafetyZones(reports: IncidentReport[]) {
  const groups = new Map<string, IncidentReport[]>();
  reports.forEach((report) => {
    const key = `${Math.round(report.latitude / 0.02)}:${Math.round(report.longitude / 0.02)}`;
    groups.set(key, [...(groups.get(key) || []), report]);
  });
  return [...groups.values()].map((group): SafetyZone => ({
    center: [group.reduce((sum, report) => sum + report.longitude, 0) / group.length, group.reduce((sum, report) => sum + report.latitude, 0) / group.length],
    reports: group,
  }));
}

function safetyGeoJson(reports: IncidentReport[]): GeoJSON.FeatureCollection<GeoJSON.Polygon, { level: string; count: number; score: number }> {
  return {
    type: "FeatureCollection",
    features: buildSafetyZones(reports).map((zone) => {
      const score = zone.reports.reduce((sum, report) => sum + safetyScore(report), 0) / zone.reports.length;
      const [longitude, latitude] = zone.center;
      const radius = 0.012 + Math.min(zone.reports.length, 4) * 0.002;
      const coordinates = Array.from({ length: 7 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 6;
        return [longitude + Math.cos(angle) * radius, latitude + Math.sin(angle) * radius * 0.82] as [number, number];
      });
      return { type: "Feature", properties: { level: safetyLevel(score), count: zone.reports.length, score: Number(score.toFixed(1)) }, geometry: { type: "Polygon", coordinates: [coordinates] } };
    }),
  };
}

function markerElement(kind: "police" | "report", severity?: IncidentReport["severity"]) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = `garda-map-marker garda-map-marker-${kind} garda-map-marker-${severity?.toLowerCase() || "default"}`;
  element.setAttribute("aria-label", kind === "police" ? "Kantor polisi" : "Laporan keamanan");
  element.innerHTML = kind === "police"
    ? '<span aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M12 2.2 20 5v6.1c0 5.1-3.4 8.9-8 10.7-4.6-1.8-8-5.6-8-10.7V5l8-2.8Z"/><path d="M8.4 9.2h7.2v5.8H8.4zM7.3 8h9.4v1.5H7.3z" fill="white"/></svg></span>'
    : '<span aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M12 2.5a9.5 9.5 0 1 0 9.5 9.5A9.5 9.5 0 0 0 12 2.5Zm1.1 13.6h-2.2v-2.2h2.2Zm0-4.1h-2.2V7.8h2.2Z"/></svg></span>';
  return element;
}

function popupContent(title: string, subtitle: string, photoUrl?: string | null) {
  const wrapper = document.createElement("div");
  wrapper.className = "garda-map-popup";
  if (photoUrl) {
    const image = document.createElement("img");
    image.src = photoUrl;
    image.alt = title;
    image.loading = "lazy";
    image.addEventListener("error", () => image.remove());
    wrapper.appendChild(image);
  }
  const heading = document.createElement("strong");
  heading.textContent = title;
  const copy = document.createElement("span");
  copy.textContent = subtitle;
  wrapper.append(heading, copy);
  return wrapper;
}

export default function GardaMap({ units, reports, className, onMapClick, onSelectReport, interactive = true }: GardaMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: JAKARTA_CENTER,
      zoom: 10.8,
      minZoom: 9,
      maxZoom: 17,
      attributionControl: { compact: true },
      dragRotate: false,
      touchPitch: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    if (!interactive) {
      map.scrollZoom.disable();
      map.dragPan.disable();
      map.doubleClickZoom.disable();
      map.touchZoomRotate.disable();
      map.keyboard.disable();
    }
    map.on("click", (event: maplibregl.MapMouseEvent) => onMapClick?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng }));
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [interactive, onMapClick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const syncSafetyZones = () => {
      if (!map.isStyleLoaded()) return;
      const data = safetyGeoJson(reports);
      const source = map.getSource(SAFETY_SOURCE_ID) as GeoJSONSource | undefined;
      if (source) source.setData(data);
      else {
        map.addSource(SAFETY_SOURCE_ID, { type: "geojson", data });
        map.addLayer({ id: SAFETY_FILL_ID, type: "fill", source: SAFETY_SOURCE_ID, paint: { "fill-color": ["match", ["get", "level"], "tinggi", "#e62428", "sedang", "#d88324", "#3c876c"], "fill-opacity": 0.15 } });
        map.addLayer({ id: SAFETY_OUTLINE_ID, type: "line", source: SAFETY_SOURCE_ID, paint: { "line-color": ["match", ["get", "level"], "tinggi", "#b91c22", "sedang", "#a46018", "#2e6955"], "line-width": 1.5, "line-opacity": 0.55 } });
        map.on("click", SAFETY_FILL_ID, (event) => {
          const feature = event.features?.[0];
          if (!feature) return;
          const properties = feature.properties as { level: string; count: number; score: number };
          new maplibregl.Popup({ offset: 12 }).setLngLat(event.lngLat).setDOMContent(popupContent("Indeks keamanan area", `${properties.count} laporan · perhatian ${properties.level} · skor ${properties.score}/4`)).addTo(map);
        });
        map.on("mouseenter", SAFETY_FILL_ID, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", SAFETY_FILL_ID, () => { map.getCanvas().style.cursor = ""; });
      }
    };
    if (map.isStyleLoaded()) syncSafetyZones();
    else map.once("load", syncSafetyZones);
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    units.forEach((unit) => {
      const element = markerElement("police");
      const marker = new maplibregl.Marker({ element, anchor: "bottom" })
        .setLngLat([unit.longitude, unit.latitude])
        .setPopup(new maplibregl.Popup({ offset: 18, closeButton: true }).setDOMContent(popupContent(unit.name, `${unit.district} · ${unit.address}`, unit.photoUrl)))
        .addTo(map);
      markersRef.current.push(marker);
    });
    reports.forEach((report) => {
      const element = markerElement("report", report.severity);
      element.addEventListener("click", (event) => { event.stopPropagation(); onSelectReport?.(report); });
      const marker = new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat([report.longitude, report.latitude])
        .setPopup(new maplibregl.Popup({ offset: 14 }).setDOMContent(popupContent(report.category, `${report.ticketNumber} · ${report.status}`)))
        .addTo(map);
      markersRef.current.push(marker);
    });
    return () => { map.off("load", syncSafetyZones); };
  }, [onSelectReport, reports, units]);

  return <div ref={containerRef} className={`garda-map ${className || ""}`} aria-label="Peta informasi keamanan Jakarta" />;
}
