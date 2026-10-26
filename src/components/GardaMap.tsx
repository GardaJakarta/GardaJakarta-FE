import { memo, useEffect, useRef, useState } from "react";
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
  onSelectUnit?: (unit: PoliceUnit) => void;
  draftLocation?: { latitude: number; longitude: number };
  draftActive?: boolean;
  onDraftLocationChange?: (coordinates: { latitude: number; longitude: number }) => void;
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
  const glyph = kind === "police"
    ? '<path d="M19.2 13.2c0 5-3.1 8.2-7.2 9.1v-2.6c2.7-.8 4.6-2.9 4.6-6.4V8.4h2.6v4.8ZM12 3.8H4.8v7.8c0 3.5 2 5.7 4.6 6.4v2.6c-4.1-.9-7.2-4.1-7.2-9.1V1.2H12v2.6Zm7.2 2.6H12v8.8c-2.1 0-3.8-1.7-3.8-3.8V6.4H12V3.8h7.2v2.6Z"/>'
    : '<path d="M12 3.5 20 7v5.2c0 4.3-3.2 7.8-8 8.9-4.8-1.1-8-4.6-8-8.9V7l8-3.5Z"/><path d="M12 8v4.5M12 15.5h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
  element.innerHTML = `<span aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">${glyph}</svg></span>`;
  return element;
}

function draftMarkerElement() {
  const element = document.createElement("div");
  element.className = "garda-map-marker garda-map-marker-draft";
  element.style.touchAction = "none";
  element.style.pointerEvents = "auto";
  element.style.userSelect = "none";
  element.style.cursor = "grab";
  element.setAttribute("role", "button");
  element.tabIndex = 0;
  element.setAttribute("aria-label", "Geser lokasi laporan");
  element.setAttribute("aria-grabbed", "false");
  element.innerHTML = '<span aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z"/><circle cx="12" cy="9" r="2.4" fill="white"/></svg></span>';
  element.addEventListener("dragstart", (event) => event.preventDefault());
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
    image.referrerPolicy = "no-referrer";
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

function GardaMap({ units, reports, className, onMapClick, onSelectReport, onSelectUnit, draftLocation, draftActive = false, onDraftLocationChange, interactive = true }: GardaMapProps) {
  const draftLatitude = draftLocation?.latitude;
  const draftLongitude = draftLocation?.longitude;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const draftActiveRef = useRef(false);
  const markersRef = useRef<Marker[]>([]);
  const draftMarkerRef = useRef<Marker | null>(null);
  const onMapClickRef = useRef(onMapClick);
  const onSelectReportRef = useRef(onSelectReport);
  const onSelectUnitRef = useRef(onSelectUnit);
  const onDraftLocationChangeRef = useRef(onDraftLocationChange);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
    onSelectReportRef.current = onSelectReport;
    onSelectUnitRef.current = onSelectUnit;
    onDraftLocationChangeRef.current = onDraftLocationChange;
  }, [onDraftLocationChange, onMapClick, onSelectReport, onSelectUnit]);

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
    map.on("click", (event: maplibregl.MapMouseEvent) => {
      const target = event.originalEvent.target as Element | null;
      if (target?.closest(".garda-map-marker")) return;
      onMapClickRef.current?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
    });
    map.once("load", () => setMapReady(true));
    mapRef.current = map;
    return () => {
      setMapReady(false);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      draftMarkerRef.current?.remove();
      draftMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [interactive]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
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
      element.addEventListener("click", (event) => { event.stopPropagation(); onSelectUnitRef.current?.(unit); });
      const marker = new maplibregl.Marker({ element, anchor: "bottom" })
        .setLngLat([unit.longitude, unit.latitude])
        .setPopup(new maplibregl.Popup({ offset: 18, closeButton: true }).setDOMContent(popupContent(unit.name, `${unit.district} · ${unit.address}`, unit.photoUrl)))
        .addTo(map);
      markersRef.current.push(marker);
    });
    reports.forEach((report) => {
      const element = markerElement("report", report.severity);
      element.addEventListener("click", (event) => { event.stopPropagation(); onSelectReportRef.current?.(report); });
      const marker = new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat([report.longitude, report.latitude])
        .setPopup(new maplibregl.Popup({ offset: 14 }).setDOMContent(popupContent(report.category, `${report.ticketNumber} · ${report.status}`)))
        .addTo(map);
      markersRef.current.push(marker);
    });
    return () => { map.off("load", syncSafetyZones); };
  }, [mapReady, reports, units]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !draftActive || draftLatitude === undefined || draftLongitude === undefined) {
      draftActiveRef.current = draftActive;
      return;
    }
    if (!draftActiveRef.current && window.innerWidth < 768) {
      map.easeTo({
        center: [draftLongitude, draftLatitude],
        padding: { top: 76, right: 24, bottom: Math.round(window.innerHeight * 0.62), left: 24 },
        duration: 300,
      });
    }
    draftActiveRef.current = draftActive;
  }, [draftActive, draftLatitude, draftLongitude, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (!draftActive || draftLatitude === undefined || draftLongitude === undefined) {
      draftMarkerRef.current?.remove();
      draftMarkerRef.current = null;
      return;
    }
    if (!draftMarkerRef.current) {
      const element = draftMarkerElement();
      element.addEventListener("click", (event) => event.stopPropagation());
      const marker = new maplibregl.Marker({ element, anchor: "bottom", draggable: true })
        .setLngLat([draftLongitude, draftLatitude])
        .addTo(map);
      marker.on("dragstart", () => {
        element.style.cursor = "grabbing";
        element.setAttribute("aria-grabbed", "true");
      });
      marker.on("drag", () => {
        const position = marker.getLngLat();
        onDraftLocationChangeRef.current?.({ latitude: position.lat, longitude: position.lng });
      });
      marker.on("dragend", () => {
        element.style.cursor = "grab";
        element.setAttribute("aria-grabbed", "false");
        const position = marker.getLngLat();
        onDraftLocationChangeRef.current?.({ latitude: position.lat, longitude: position.lng });
      });
      draftMarkerRef.current = marker;
    } else {
      draftMarkerRef.current.setLngLat([draftLongitude, draftLatitude]);
    }
  }, [draftActive, draftLatitude, draftLongitude, mapReady]);

  return <div ref={containerRef} className={`garda-map ${className || ""}`} aria-label="Peta informasi keamanan Jakarta" />;
}

function areMapPropsEqual(previous: GardaMapProps, next: GardaMapProps) {
  return previous.units === next.units
    && previous.reports === next.reports
    && previous.className === next.className
    && previous.interactive === next.interactive
    && previous.draftActive === next.draftActive
    && previous.draftLocation?.latitude === next.draftLocation?.latitude
    && previous.draftLocation?.longitude === next.draftLocation?.longitude
    && previous.onMapClick === next.onMapClick
    && previous.onSelectReport === next.onSelectReport
    && previous.onSelectUnit === next.onSelectUnit
    && previous.onDraftLocationChange === next.onDraftLocationChange;
}

export default memo(GardaMap, areMapPropsEqual);
