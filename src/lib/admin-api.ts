import { requestJson } from "./api";
import type { AdminCategory, AdminUnit, IncidentReport } from "../types";

export type AdminRole = "WARGA" | "POLISI" | "ADMIN";
export type AdminUser = { id: string; name: string; email: string; role: AdminRole; policeUnitId: string | null; policeUnit: { id: string; name: string } | null; createdAt: string; updatedAt: string };
export type AdminReport = IncidentReport & { reporterId: string; policeUnitId: string | null; reporter: { id: string; name: string; email: string } };
export type Resource = "units" | "categories" | "users" | "reports";
export type AdminRecord = AdminUnit | AdminCategory | AdminUser | AdminReport;
export type Page<T> = { items: T[]; total: number; page: number; hasMore: boolean };
export type ListQuery = { page?: number; limit?: number; search?: string; status?: string; role?: string };
export function listAdmin<T extends AdminRecord = AdminRecord>(resource: Resource, query: ListQuery = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => { if (value !== undefined && value !== "") params.set(key, String(value)); });
  return requestJson<Page<T>>(`/admin/${resource}?${params}`);
}
export function readAdmin(resource: Resource, id: string) {
  return requestJson<AdminRecord>(`/admin/${resource}/${encodeURIComponent(id)}`);
}
export function saveAdmin(resource: Resource, input: Record<string, unknown>, id?: string) {
  return requestJson<AdminRecord>(`/admin/${resource}${id ? `/${encodeURIComponent(id)}` : ""}`, { method: id ? "PATCH" : "POST", body: JSON.stringify(input) });
}
export function saveAdminCategory(input: { name: string; image?: File }, id?: string) {
  const form = new FormData();
  form.set("name", input.name);
  if (input.image) form.set("image", input.image);
  return requestJson<AdminCategory>(`/admin/categories${id ? `/${encodeURIComponent(id)}` : ""}`, { method: id ? "PATCH" : "POST", body: form });
}
export function removeAdmin(resource: Resource, id: string) {
  return requestJson<{ id: string }>(`/admin/${resource}/${encodeURIComponent(id)}`, { method: "DELETE" });
}
