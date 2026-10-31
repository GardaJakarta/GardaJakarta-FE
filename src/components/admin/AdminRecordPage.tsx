import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, PencilSimple } from "@phosphor-icons/react";
import { readAdmin, type AdminRecord, type Resource } from "../../lib/admin-api";
import { refreshReportCategories } from "../../lib/use-report-categories";
import { ReportListSkeleton } from "../LoadingSkeleton";
import { AdminRecordDetail } from "./AdminResourcePage";
import AdminRecordEditor from "./AdminRecordEditor";
import { button, panel, quietButton } from "./admin-styles";

const labels: Record<Resource, string> = { units: "unit polisi", categories: "kategori", users: "pengguna", reports: "laporan" };
export default function AdminRecordPage({ resource, id, edit, onChanged }: { resource: Resource; id: string; edit: boolean; onChanged: () => void }) {
  const navigate = useNavigate();
  const isNew = id === "new";
  const [record, setRecord] = useState<AdminRecord | null>(null);
  const [loading, setLoading] = useState(!isNew), [error, setError] = useState("");
  useEffect(() => {
    if (isNew) return;
    let live = true;
    readAdmin(resource, id).then((row) => { if (live) setRecord(row); })
      .catch((reason: Error) => { if (live) setError(reason.message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [resource, id, isNew]);
  const back = () => navigate(`/dashboard?tab=${resource}`);
  return <div className="space-y-5">
    <button type="button" onClick={back} className={quietButton}><ArrowLeft size={17} />Kembali ke {labels[resource]}</button>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="mb-1 text-xs text-slate-500">Kelola {labels[resource]}</p><h2 className="font-heading text-2xl font-bold">{isNew ? "Tambah" : edit ? "Edit" : "Detail"} {labels[resource]}</h2></div>
      {!isNew && !edit && record && <button className={button} onClick={() => navigate(`/dashboard/${resource}/${encodeURIComponent(id)}/edit`)}><PencilSimple size={17} />Edit data</button>}
    </div>
    {loading ? <ReportListSkeleton count={3} /> : error ? <p role="alert" className="rounded-xl border border-red-200 bg-white p-6 text-sm text-red-700">{error}</p> : isNew || edit ?
      <AdminRecordEditor resource={resource} record={record} onClose={back} onSaved={() => { if (resource === "categories") refreshReportCategories(); onChanged(); back(); }} /> : record && <section className={panel + " max-w-4xl p-5 sm:p-7"}><AdminRecordDetail resource={resource} row={record} /></section>}
  </div>;
}
