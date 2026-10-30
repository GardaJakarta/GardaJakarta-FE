import { useEffect, useState } from "react";
import { requestJson } from "./api";

export function useReportCategories(fallback: string[]) {
  const [categories, setCategories] = useState(fallback);
  useEffect(() => {
    let live = true;
    const load = () => {
      requestJson<Array<{ id: string; name: string }>>("/public/categories")
        .then((rows) => { if (live) setCategories(rows.map((row) => row.name)); })
        .catch(() => { /* Keep the last available catalog while offline. */ });
    };
    load();
    window.addEventListener("focus", load);
    return () => { live = false; window.removeEventListener("focus", load); };
  }, []);
  return categories;
}
