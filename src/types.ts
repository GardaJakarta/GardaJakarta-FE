export interface User {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: "warga" | "polisi" | "admin";
}

export type AuthPortal = User["role"];

export interface AuthResponse {
  user: User;
}

export interface PoliceUnit {
  id: string;
  name: string;
  district: string;
  address: string;
  phone: string | null;
  latitude: number;
  longitude: number;
  photoUrl: string | null;
}

export type ReportSeverity = "P0" | "P1" | "P2" | "P3";
export type ReportStatus = "PENDING" | "VERIFIED" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";

export interface IncidentReport {
  id: string;
  ticketNumber: string;
  category: string;
  description?: string;
  severity: ReportSeverity;
  status: ReportStatus;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
  policeUnit: { name: string; district: string } | null;
}

export interface DashboardData {
  role: AuthPortal;
  reports: IncidentReport[];
  stats: { total: number; pending: number; inProgress: number; resolved: number };
  units: PoliceUnit[];
  adminOverview?: { users: number; units: number; auditLogs: number; categories: Array<{ name: string; count: number }> };
}
