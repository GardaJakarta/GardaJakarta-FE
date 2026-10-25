import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapInstance, Marker } from "maplibre-gl";
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

function markerElement(kind: "police" | "report", severity?: IncidentReport["severity"]) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = `garda-map-marker garda-map-marker-${kind} garda-map-marker-${severity?.toLowerCase() || "default"}`;
  element.setAttribute("aria-label", kind === "police" ? "Kantor polisi" : "Laporan keamanan");
  element.innerHTML = kind === "police"
    ? '<span aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M5 21V6.5L12 3l7 3.5V21h-4v-6H9v6H5Zm3-9h8V8H8v4Z" /></svg></span>'
    : '<span aria-hidden="true">!</span>';
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
  }, [onSelectReport, reports, units]);

  return <div ref={containerRef} className={`garda-map ${className || ""}`} aria-label="Peta informasi keamanan Jakarta" />;
}
