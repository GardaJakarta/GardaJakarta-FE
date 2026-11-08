import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

export function useMapView(defaultView: "map" | "feed" = "map") {
  const [params, setParams] = useSearchParams();
  const view = params.has("view") ? (params.get("view") === "feed" ? "feed" : "map") : defaultView;
  const changeView = useCallback((next: "map" | "feed") => {
    setParams((current) => {
      const updated = new URLSearchParams(current);
      updated.set("view", next);
      return updated;
    });
  }, [setParams]);
  return [view, changeView] as const;
}
