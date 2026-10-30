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
  notifications?: Array<{ id: string; title: string; body: string; createdAt: number }>;
  role: AuthPortal;
  reports: IncidentReport[];
  stats: { total: number; pending: number; inProgress: number; resolved: number };
  units: PoliceUnit[];
  adminOverview?: {
    users: number;
    units: number;
    publishedUnits: number;
    districts: number;
    categoriesCount: number;
    reports: number;
    assignedPolice: number;
    auditLogs: number;
    categories: Array<{ name: string; count: number }>;
    statuses: Array<{ status: ReportStatus; count: number }>;
    unitsByReport: Array<{ name: string; count: number }>;
    unitDirectory: Array<{ id: string; name: string; district: string; address: string; isPublished: boolean; reports: number; staff: number }>;
  };
}

export interface AdminUsersPage {
  users: Array<{ id: string; name: string; email: string; role: "WARGA" | "POLISI" | "ADMIN"; createdAt: string; policeUnit: { name: string } | null }>;
  total: number;
  page: number;
  hasMore: boolean;
}

export interface AdminUnit {
  id: string; name: string; district: string; address: string; phone: string | null; latitude: number; longitude: number; photoUrl: string | null; isPublished: boolean; reports: number; staff: number;
}
export interface AdminCategory { id: string; name: string; createdAt: string; updatedAt: string; reports: number; }

export interface ReportInteractions {
 status: ReportStatus; voteCount: number; hasVoted: boolean;
 comments: Array<{id: string; body: string; createdAt: string; evidence: Array<{id: string; url: string}>}>;
 activities: Array<{id: string; type: string; status: ReportStatus | null; message: string; createdAt: string; author: string; evidence: Array<{id: string; url: string}>}>;
 canParticipate: boolean; canManage: boolean; canClarify: boolean; nextStatuses: ReportStatus[];
 clarificationPrompt: string | null; clarificationResponse: string | null;
 page: number; hasMore: boolean;
}
