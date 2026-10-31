import { useEffect, useSyncExternalStore } from "react";
import { requestJson } from "./api";

type Category = { id: string; name: string; imageUrl: string | null };
let catalog: Category[] | null = null;
let pending: Promise<void> | null = null;
let refreshedAt = 0;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function load() {
  if (pending || Date.now() - refreshedAt < 30_000) return;
  pending = requestJson<Category[]>("/public/categories").then((rows) => {
    catalog = rows; refreshedAt = Date.now(); listeners.forEach((listener) => listener());
  }).catch(() => { /* Keep the last available catalog while offline. */ }).finally(() => { pending = null; });
}
export function refreshReportCategories() { refreshedAt = 0; load(); }
export function useReportCatalog() {
  const rows = useSyncExternalStore(subscribe, () => catalog);
  useEffect(() => { load(); window.addEventListener("focus", load); return () => window.removeEventListener("focus", load); }, []);
  return rows;
}
export function useReportCategories(fallback: string[]) {
  const rows = useReportCatalog();
  return rows ? rows.map((row) => row.name) : fallback;
}
export function defaultCategoryImage(name: string) {
  const keys: Array<[string, string]> = [["catcalling", "harassment"], ["seksual", "sexual"], ["Pencurian", "theft"], ["Begal", "robbery"], ["Kekerasan fisik", "violence"], ["Tawuran", "crowd-generated"], ["Penipuan", "fraud"], ["fasilitas", "facility"]];
  return `/illustrations/categories/${keys.find(([key]) => name.includes(key))?.[1] || "other-generated"}.png`;
}
