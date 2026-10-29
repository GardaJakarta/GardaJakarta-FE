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
  popupAnchor?: { latitude: number; longitude: number } | null;
  onPopupPosition?: (point: { x: number; y: number } | null) => void;
  onMapClick?: (coordinates: { latitude: number; longitude: number }) => void;
  onSelectReport?: (report: IncidentReport) => void;
  onSelectUnit?: (unit: PoliceUnit) => void;
  onSelectSafetyZone?: (zone: { reports: IncidentReport[]; level: string; score: number }) => void;
  userLocation?: { latitude: number; longitude: number } | null;
  followUser?: boolean;
  focusLocation?: { latitude: number; longitude: number } | null;
  searchedLocation?: { id: string; label: string; latitude: number; longitude: number } | null;
  onClearSearchedLocation?: () => void;
  draftLocation?: { latitude: number; longitude: number };
  draftActive?: boolean;
  onDraftLocationChange?: (coordinates: { latitude: number; longitude: number }) => void;
  interactive?: boolean;
  showSafetyZones?: boolean;
};

const SAFETY_SOURCE_ID = "garda-safety-zones";
const SAFETY_FILL_ID = "garda-safety-zone-fill";
const SAFETY_OUTLINE_ID = "garda-safety-zone-outline";

type SafetyZone = {
  center: [number, number];
  reports: IncidentReport[];
  state: "verified" | "in_progress";
};

type Point = [number, number];

function convexHull(points: Point[]) {
  const sorted = [...points].sort(([leftX, leftY], [rightX, rightY]) => leftX - rightX || leftY - rightY);
  if (sorted.length <= 1) return sorted;
  const cross = (origin: Point, pointA: Point, pointB: Point) => (pointA[0] - origin[0]) * (pointB[1] - origin[1]) - (pointA[1] - origin[1]) * (pointB[0] - origin[0]);
  const lower: Point[] = [];
  sorted.forEach((point) => {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  });
  const upper: Point[] = [];
  [...sorted].reverse().forEach((point) => {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  });
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function zonePolygon(zone: SafetyZone): Point[] {
  // Build an organic boundary from report influence circles instead of a fixed-sided polygon.
  const latitudeScale = 111_320;
  const longitudeScale = latitudeScale * Math.cos(zone.center[1] * Math.PI / 180);
  const bufferedPoints = zone.reports.flatMap((report) =>
    Array.from({ length: 32 }, (_, index): Point => {
      const angle = 2 * Math.PI * index / 32;
      const radius = report.severity === "P0" ? 700 : report.severity === "P1" ? 600 : report.severity === "P2" ? 500 : 420;
      return [report.longitude + Math.cos(angle) * radius / longitudeScale,
        report.latitude + Math.sin(angle) * radius / latitudeScale];
    }),
  );
  const hull = convexHull(bufferedPoints);
  return hull.length ? [...hull, hull[0]] : [];
}

function safetyScore(report: IncidentReport) {
  const severity = { P0: 4, P1: 3, P2: 2, P3: 1 }[report.severity];
  const status = { PENDING: 1, VERIFIED: 1.15, IN_PROGRESS: 0.8, CLARIFICATION: 1.05, RESOLVED: 0.35, REJECTED: 0 }[report.status];
  return Math.min(4, severity * status);
}

function safetyLevel(score: number) {
  if (score >= 3) return "tinggi";
  if (score >= 1.8) return "sedang";
  return "rendah";
}

function buildSafetyZones(reports: IncidentReport[]) {
  const groups: IncidentReport[][] = [];
  const clusterDistance = 0.018;
  [...reports].sort((a, b) => a.longitude - b.longitude || a.latitude - b.latitude || a.id.localeCompare(b.id)).forEach((report) => {
    const group = groups.find((candidate) => {
      const longitude = candidate.reduce((sum, item) => sum + item.longitude, 0) / candidate.length;
      const latitude = candidate.reduce((sum, item) => sum + item.latitude, 0) / candidate.length;
      return Math.hypot((report.longitude - longitude) * 0.99, report.latitude - latitude) <= clusterDistance;
    });
    if (group) group.push(report);
    else groups.push([report]);
  });
  return groups.map((group): SafetyZone => ({
    center: [group.reduce((sum, report) => sum + report.longitude, 0) / group.length, group.reduce((sum, report) => sum + report.latitude, 0) / group.length],
    reports: group,
    state: group.some((report) => report.status === "IN_PROGRESS") ? "in_progress" : "verified",
  }));
}

type SafetyProperties = { level: string; state: SafetyZone["state"]; count: number; score: number; reports: string };

function safetyGeoJson(reports: IncidentReport[]): GeoJSON.FeatureCollection<GeoJSON.Polygon, SafetyProperties> {
  const actionableReports = reports.filter((report) => ["VERIFIED", "IN_PROGRESS"].includes(report.status));
  return {
    type: "FeatureCollection",
    features: buildSafetyZones(actionableReports).map((zone) => {
      const score = zone.reports.reduce((sum, report) => sum + safetyScore(report), 0) / zone.reports.length;
      const coordinates = zonePolygon(zone);
      return {
        type: "Feature",
        properties: {
          level: safetyLevel(score),
          state: zone.state,
          count: zone.reports.length,
          score: Number(score.toFixed(1)),
          reports: JSON.stringify(zone.reports.map((report) => ({ ticketNumber: report.ticketNumber, category: report.category, status: report.status }))),
        },
        geometry: { type: "Polygon", coordinates: [coordinates] },
      };
    }),
  };
}

function markerElement(kind: "police" | "report", severity?: IncidentReport["severity"]) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = `garda-map-marker garda-map-marker-${kind} garda-map-marker-${severity?.toLowerCase() || "default"}`;
  const image = document.createElement("img");
  image.src = kind === "police" ? "/markers/garda-police-mark.svg" : "/markers/garda-report-mark.svg";
  image.alt = "";
  image.setAttribute("aria-hidden", "true");
  element.append(image);
  return element;
}

function searchedLocationElement(location: { label: string }, onClear?: () => void) {
  const element = document.createElement("div");
  element.className = "garda-search-marker";
  element.innerHTML = '<button type="button" class="garda-search-marker-pin"><img src="/markers/garda-search-mark.svg" alt="" aria-hidden="true" /></button><button type="button" class="garda-search-marker-remove" aria-label="Hapus lokasi terpilih"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>';
  element.querySelector(".garda-search-marker-pin")?.setAttribute("aria-label", `Lokasi terpilih: ${location.label}`);
  element.querySelector(".garda-search-marker-pin")?.addEventListener("click", (event) => event.stopPropagation());
  element.querySelector(".garda-search-marker-remove")?.addEventListener("click", (event) => { event.stopPropagation(); onClear?.(); });
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
  element.innerHTML = '<img src="/markers/garda-draft-mark.svg" alt="" aria-hidden="true" />';
  element.addEventListener("dragstart", (event) => event.preventDefault());
  return element;
}

function userLocationElement() {
  const element = document.createElement("div");
  element.className = "garda-user-location";
  element.setAttribute("aria-label", "Lokasi Anda");
  element.innerHTML = '<span aria-hidden="true"></span>';
  return element;
}

function GardaMap({ units, reports, className, popupAnchor, onPopupPosition, onMapClick, onSelectReport, onSelectUnit, onSelectSafetyZone, userLocation, followUser = true, focusLocation, searchedLocation, onClearSearchedLocation, draftLocation, draftActive = false, onDraftLocationChange, interactive = true, showSafetyZones = true }: GardaMapProps) {
  const draftLatitude = draftLocation?.latitude;
  const draftLongitude = draftLocation?.longitude;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const popupLatitude = popupAnchor?.latitude;
  const popupLongitude = popupAnchor?.longitude;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || popupLatitude === undefined || popupLongitude === undefined || !onPopupPosition) return;
    const update = () => {
      const point = map.project([popupLongitude, popupLatitude]);
      onPopupPosition({ x: point.x, y: point.y });
    };
    update();
    map.on("move", update);
    map.on("resize", update);
    return () => { map.off("move", update); map.off("resize", update); };
  }, [mapReady, popupLatitude, popupLongitude, onPopupPosition]);
  const draftDraggingRef = useRef(false);
  const draftLocationRef = useRef({ latitude: draftLatitude, longitude: draftLongitude });
  const markersRef = useRef<Marker[]>([]);
  const draftMarkerRef = useRef<Marker | null>(null);
  const searchedMarkerRef = useRef<Marker | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  const onMapClickRef = useRef(onMapClick);
  const onSelectReportRef = useRef(onSelectReport);
  const onSelectUnitRef = useRef(onSelectUnit);
  const onSelectSafetyZoneRef = useRef(onSelectSafetyZone);
  const reportsRef = useRef(reports);
  const onDraftLocationChangeRef = useRef(onDraftLocationChange);

  useEffect(() => {
    draftLocationRef.current = { latitude: draftLatitude, longitude: draftLongitude };
  }, [draftLatitude, draftLongitude]);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
    onSelectReportRef.current = onSelectReport;
    onSelectUnitRef.current = onSelectUnit;
    onSelectSafetyZoneRef.current = onSelectSafetyZone;
    reportsRef.current = reports;
    onDraftLocationChangeRef.current = onDraftLocationChange;
  }, [onDraftLocationChange, onMapClick, onSelectReport, onSelectSafetyZone, onSelectUnit, reports]);

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
      if (map.getLayer(SAFETY_FILL_ID) && map.queryRenderedFeatures(event.point, { layers: [SAFETY_FILL_ID] }).length > 0) return;
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
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [interactive]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const syncSafetyZones = () => {
      if (!map.isStyleLoaded()) return;
      if (!showSafetyZones) {
        if (map.getLayer(SAFETY_FILL_ID)) map.removeLayer(SAFETY_FILL_ID);
        if (map.getLayer(SAFETY_OUTLINE_ID)) map.removeLayer(SAFETY_OUTLINE_ID);
        if (map.getSource(SAFETY_SOURCE_ID)) map.removeSource(SAFETY_SOURCE_ID);
        return;
      }
      const data = safetyGeoJson(reports);
      const source = map.getSource(SAFETY_SOURCE_ID) as GeoJSONSource | undefined;
      if (source) source.setData(data);
      else {
        map.addSource(SAFETY_SOURCE_ID, { type: "geojson", data });
        map.addLayer({ id: SAFETY_FILL_ID, type: "fill", source: SAFETY_SOURCE_ID, paint: { "fill-color": ["match", ["get", "state"], "in_progress", "#f59e0b", "resolved", "#22a06b", "#e62428"], "fill-opacity": ["match", ["get", "state"], "resolved", 0.09, 0.16] } });
        map.addLayer({ id: SAFETY_OUTLINE_ID, type: "line", source: SAFETY_SOURCE_ID, paint: { "line-color": ["match", ["get", "state"], "in_progress", "#b45309", "resolved", "#16724b", "#b21e24"], "line-width": 2, "line-opacity": 0.68 } });
        map.on("click", SAFETY_FILL_ID, (event) => {
          const feature = event.features?.[0];
          if (!feature) return;
          const properties = feature.properties as SafetyProperties;
          let zoneReports: IncidentReport[] = [];
          try {
            const raw = properties.reports as unknown;
            const summaries = Array.isArray(raw) ? raw as Array<{ ticketNumber: string }> : JSON.parse(String(raw)) as Array<{ ticketNumber: string }>;
            const tickets = new Set(summaries.map((summary) => summary.ticketNumber));
            zoneReports = reportsRef.current.filter((report) => tickets.has(report.ticketNumber));
          } catch { /* Ignore malformed map properties. */ }
          onSelectSafetyZoneRef.current?.({ reports: zoneReports, level: properties.level, score: properties.score });
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
      const marker = new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat([unit.longitude, unit.latitude])
        .addTo(map);
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelectUnitRef.current?.(unit);
      });
      markersRef.current.push(marker);
    });
    reports.forEach((report) => {
      const element = markerElement("report", report.severity);
      const marker = new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat([report.longitude, report.latitude])
        .addTo(map);
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelectReportRef.current?.(report);
      });
      markersRef.current.push(marker);
    });
    return () => { map.off("load", syncSafetyZones); };
  }, [mapReady, reports, showSafetyZones, units]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !userLocation) return;
    if (followUser) map.easeTo({ center: [userLocation.longitude, userLocation.latitude], duration: 550, essential: true });
    if (!userMarkerRef.current) userMarkerRef.current = new maplibregl.Marker({ element: userLocationElement(), anchor: "center" }).setLngLat([userLocation.longitude, userLocation.latitude]).addTo(map);
    else userMarkerRef.current.setLngLat([userLocation.longitude, userLocation.latitude]);
  }, [followUser, mapReady, userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !focusLocation) return;
    map.flyTo({ center: [focusLocation.longitude, focusLocation.latitude], zoom: Math.max(map.getZoom(), 14), essential: true });
  }, [focusLocation, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !searchedLocation) {
      searchedMarkerRef.current?.remove();
      searchedMarkerRef.current = null;
      return;
    }
    searchedMarkerRef.current?.remove();
    const element = searchedLocationElement(searchedLocation, onClearSearchedLocation);
    searchedMarkerRef.current = new maplibregl.Marker({ element, anchor: "center" })
      .setLngLat([searchedLocation.longitude, searchedLocation.latitude])
      .addTo(map);
    return () => {
      searchedMarkerRef.current?.remove();
      searchedMarkerRef.current = null;
    };
  }, [mapReady, onClearSearchedLocation, searchedLocation]);

  useEffect(() => {
    const map = mapRef.current;
    const location = draftLocationRef.current;
    if (!map || !mapReady || !draftActive || location.latitude === undefined || location.longitude === undefined) {
      draftMarkerRef.current?.remove();
      draftMarkerRef.current = null;
      return;
    }
    if (draftMarkerRef.current) return;

    const element = draftMarkerElement();
    element.addEventListener("click", (event) => event.stopPropagation());
    const marker = new maplibregl.Marker({ element, anchor: "center", draggable: true })
      .setLngLat([location.longitude, location.latitude])
      .addTo(map);
    const handleDragStart = () => {
      element.style.cursor = "grabbing";
      element.setAttribute("aria-grabbed", "true");
    };
    const handleDragEnd = () => {
      draftDraggingRef.current = false;
      element.style.cursor = "grab";
      element.setAttribute("aria-grabbed", "false");
      const position = marker.getLngLat();
      onDraftLocationChangeRef.current?.({ latitude: position.lat, longitude: position.lng });
    };
    const handleDragStartWithState = () => {
      draftDraggingRef.current = true;
      handleDragStart();
    };
    const handleDrag = () => {
      const position = marker.getLngLat();
      onDraftLocationChangeRef.current?.({ latitude: position.lat, longitude: position.lng });
    };
    marker.on("dragstart", handleDragStartWithState);
    marker.on("drag", handleDrag);
    marker.on("dragend", handleDragEnd);
    draftMarkerRef.current = marker;

    return () => {
      draftDraggingRef.current = false;
      marker.off("dragstart", handleDragStartWithState);
      marker.off("drag", handleDrag);
      marker.off("dragend", handleDragEnd);
      marker.remove();
      if (draftMarkerRef.current === marker) draftMarkerRef.current = null;
    };
  }, [draftActive, mapReady]);

  useEffect(() => {
    if (!draftActive || draftDraggingRef.current || !draftMarkerRef.current || draftLatitude === undefined || draftLongitude === undefined) return;
    draftMarkerRef.current.setLngLat([draftLongitude, draftLatitude]);
  }, [draftActive, draftLatitude, draftLongitude]);

  return <div ref={containerRef} className={`garda-map ${className || ""}`} aria-label="Peta informasi keamanan Jakarta" />;
}

function areMapPropsEqual(previous: GardaMapProps, next: GardaMapProps) {
  return previous.units === next.units
    && previous.popupAnchor?.latitude === next.popupAnchor?.latitude
    && previous.popupAnchor?.longitude === next.popupAnchor?.longitude
    && previous.onPopupPosition === next.onPopupPosition
    && previous.reports === next.reports
    && previous.className === next.className
    && previous.interactive === next.interactive
    && previous.showSafetyZones === next.showSafetyZones
    && previous.draftActive === next.draftActive
    && previous.draftLocation?.latitude === next.draftLocation?.latitude
    && previous.draftLocation?.longitude === next.draftLocation?.longitude
    && previous.onMapClick === next.onMapClick
    && previous.onSelectReport === next.onSelectReport
    && previous.onSelectUnit === next.onSelectUnit
    && previous.onSelectSafetyZone === next.onSelectSafetyZone
    && previous.userLocation?.latitude === next.userLocation?.latitude
    && previous.userLocation?.longitude === next.userLocation?.longitude
    && previous.followUser === next.followUser
    && previous.focusLocation?.latitude === next.focusLocation?.latitude
    && previous.focusLocation?.longitude === next.focusLocation?.longitude
    && previous.searchedLocation?.id === next.searchedLocation?.id
    && previous.searchedLocation?.latitude === next.searchedLocation?.latitude
    && previous.searchedLocation?.longitude === next.searchedLocation?.longitude
    && previous.onClearSearchedLocation === next.onClearSearchedLocation
    && previous.onDraftLocationChange === next.onDraftLocationChange;
}

export default memo(GardaMap, areMapPropsEqual);
