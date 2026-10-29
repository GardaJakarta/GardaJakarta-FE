import type { ReportStatus } from "../types";
import { reportStatusLabels } from "../lib/report-status";

export default function ReportStatusOptions({ value, onChange, publicOnly = false }: { value: ReportStatus[]; onChange: (value: ReportStatus[]) => void; publicOnly?: boolean }) {
  const options = (Object.keys(reportStatusLabels) as ReportStatus[]).filter((status) => !publicOnly || status !== "REJECTED");
  return <fieldset className="grid gap-1"><legend className="mb-2 text-xs font-bold text-slate-700">Status laporan</legend>{options.map((status) => <label key={status} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-red-50"><input className="h-4 w-4 accent-[#e62428]" type="checkbox" checked={value.includes(status)} onChange={() => onChange(value.includes(status) ? value.filter((item) => item !== status) : [...value, status])} />{reportStatusLabels[status]}</label>)}</fieldset>;
}
