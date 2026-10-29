import { authClient } from "./auth-client";
import { portalPaths } from "./portals";
import type { AuthPortal, DashboardData, IncidentReport, PoliceUnit, ReportSeverity, ReportStatus, User } from "../types";

const apiBase = new URL(import.meta.env.VITE_API_URL || "/api", window.location.origin).href.replace(/\/$/, "");

function normalizeUser(user: { id: string; name: string; email: string; image?: string | null; role?: string }): User {
  const roles = { WARGA: "warga", POLISI: "polisi", ADMIN: "admin" } as const;
  if (!user.role || !(user.role in roles)) throw new Error("Role akun tidak dikenali. Hubungi pengelola.");
  return { id: user.id, name: user.name, email: user.email, image: user.image, role: roles[user.role as keyof typeof roles] };
}

function authError(error: { code?: string; message?: string } | null) {
  const messages: Record<string, string> = {
    INVALID_EMAIL_OR_PASSWORD: "Email atau password tidak cocok.",
    USER_ALREADY_EXISTS: "Email sudah terdaftar. Silakan masuk.",
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Email sudah terdaftar. Silakan masuk.",
    PASSWORD_TOO_SHORT: "Password minimal terdiri dari 8 karakter.",
    PASSWORD_TOO_LONG: "Password maksimal terdiri dari 128 karakter.",
    INVALID_EMAIL: "Alamat email belum valid.",
  };
  return new Error(messages[error?.code || ""] || "Permintaan belum berhasil. Coba lagi.");
}

export async function register(input: { name: string; email: string; password: string }) {
  const { data, error } = await authClient.signUp.email(input);
  if (error || !data) throw authError(error);
  return { user: normalizeUser(data.user) };
}

export async function login(input: { email: string; password: string; portal: AuthPortal }) {
  const { data, error } = await authClient.signIn.email({ email: input.email, password: input.password });
  if (error || !data) throw authError(error);
  return { user: normalizeUser(data.user) };
}

export async function getCurrentUser() {
  const { data, error } = await authClient.getSession();
  if (error) throw authError(error);
  return data?.user ? normalizeUser(data.user) : null;
}

export async function logout() {
  const { error } = await authClient.signOut();
  if (error) throw authError(error);
}

export async function signInGoogle(portal: AuthPortal) {
  const { error } = await authClient.signIn.social({
    provider: "google",
    callbackURL: `${window.location.origin}${portalPaths[portal].home}`,
    errorCallbackURL: `${window.location.origin}${portalPaths[portal].login}`,
  });
  if (error) throw authError(error);
}

export async function linkGoogle() {
  const { error } = await authClient.linkSocial({
    provider: "google",
    callbackURL: window.location.href,
  });
  if (error) throw authError(error);
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  // Public map data changes outside the FE session; never reuse a stale browser response.
  const response = await fetch(`${apiBase}${path}`, { ...init, cache: "no-store", credentials: "include", headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", ...init?.headers } });
  const payload = await response.json().catch(() => null) as { data?: T; error?: string } | null;
  if (!response.ok || !payload?.data) throw new Error(payload?.error || "Permintaan belum berhasil.");
  return payload.data;
}

export function getPublicMap() {
  return requestJson<{ units: PoliceUnit[]; reports: IncidentReport[]; updatedAt: string }>(`/public/map?ts=${Date.now()}`);
}

export function getDashboard() {
  return requestJson<DashboardData>("/dashboard");
}

export function getReportFeed(page = 1, limit = 10) {
  return requestJson<{ reports: IncidentReport[]; page: number; limit: number; hasMore: boolean }>(`/reports/feed?page=${page}&limit=${limit}`);
}

export function createReport(input: { category: string; description: string; severity: ReportSeverity; latitude: number; longitude: number }) {
  return requestJson<IncidentReport>("/reports", { method: "POST", body: JSON.stringify(input) });
}

export function updatePoliceReportStatus(id: string, status: Exclude<ReportStatus, "PENDING">) {
  return requestJson<IncidentReport>(`/police/reports/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export function getReportInteractions(id: string) {
  return requestJson<IncidentReport>(`/reports/${id}/interactions`);
}

export function voteReport(id: string, active: boolean) {
  return requestJson<{ voteCount: number; hasVoted: boolean }>(`/reports/${id}/vote`, { method: active ? "POST" : "DELETE" });
}

export function commentOnReport(id: string, body: string) {
  return requestJson<{ id: string; body: string; createdAt: string }>(`/reports/${id}/comments`, { method: "POST", body: JSON.stringify({ body }) });
}

export function requestReportClarification(id: string, prompt: string) {
  return requestJson<IncidentReport>(`/police/reports/${id}/clarification`, { method: "PATCH", body: JSON.stringify({ prompt }) });
}

export function submitReportClarification(id: string, response: string) {
  return requestJson<IncidentReport>(`/reports/${id}/clarification`, { method: "POST", body: JSON.stringify({ response }) });
}
