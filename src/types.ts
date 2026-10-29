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
export type ReportStatus = "PENDING" | "VERIFIED" | "IN_PROGRESS" | "CLARIFICATION" | "RESOLVED" | "REJECTED";
export type ReportActivity = { id: string; type: string; message: string; createdAt: string };

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
  clarificationPrompt?: string | null;
  clarificationResponse?: string | null;
  clarificationRequestedAt?: string | null;
  clarificationRespondedAt?: string | null;
  activities?: ReportActivity[];
  voteCount?: number;
  commentCount?: number;
  hasVoted?: boolean;
}

export interface DashboardData {
  role: AuthPortal;
  reports: IncidentReport[];
  stats: { total: number; pending: number; inProgress: number; resolved: number };
  units: PoliceUnit[];
  adminOverview?: { users: number; units: number; auditLogs: number; categories: Array<{ name: string; count: number }> };
}

export interface ReportInteractions {
 status: ReportStatus; voteCount: number; hasVoted: boolean;
 comments: Array<{id: string; body: string; createdAt: string; evidence: Array<{id: string; url: string}>}>;
 activities: Array<{id: string; type: string; status: ReportStatus | null; message: string; createdAt: string; author: string; evidence: Array<{id: string; url: string}>}>;
 canParticipate: boolean; canManage: boolean; canClarify: boolean; nextStatuses: ReportStatus[];
 clarificationPrompt: string | null; clarificationResponse: string | null;
 page: number; hasMore: boolean;
}
