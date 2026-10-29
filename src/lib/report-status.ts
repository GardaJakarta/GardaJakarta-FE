import type { ReportStatus } from "../types";
export const reportStatusLabels: Record<ReportStatus, string> = {
  PENDING: "Belum diverifikasi", VERIFIED: "Terverifikasi", IN_PROGRESS: "Ditindaklanjuti",
  CLARIFICATION: "Butuh klarifikasi", RESOLVED: "Selesai", REJECTED: "Ditolak",
};
export const defaultReportStatuses: ReportStatus[] = ["PENDING", "VERIFIED", "IN_PROGRESS", "CLARIFICATION", "REJECTED"];
