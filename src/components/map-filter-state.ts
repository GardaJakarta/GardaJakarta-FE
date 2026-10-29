import { defaultReportStatuses } from "../lib/report-status";
import type { ReportSeverity, ReportStatus } from "../types";

export type MapFilterState = {
  category: string;
  status: ReportStatus[];
  severity: ReportSeverity | "";
  showReports: boolean;
  showPoliceUnits: boolean;
  showSafetyZones: boolean;
};

export const defaultMapFilters: MapFilterState = {
  category: "", status: defaultReportStatuses, severity: "",
  showReports: true, showPoliceUnits: true, showSafetyZones: true,
};

export function mapFilterCount(filters: MapFilterState) {
  return Number(Boolean(filters.category)) + Number(Boolean(filters.severity))
    + Number(filters.status.length !== defaultReportStatuses.length || !defaultReportStatuses.every((status) => filters.status.includes(status)))
    + Number(!filters.showReports) + Number(!filters.showPoliceUnits) + Number(!filters.showSafetyZones);
}
