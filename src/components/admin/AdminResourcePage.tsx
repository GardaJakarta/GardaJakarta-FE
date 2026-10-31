import { useEffect, useState, type FormEvent } from "react";
import { Eye, PencilSimple, Plus, Trash, MagnifyingGlass, UserPlus } from "@phosphor-icons/react";
import { AdminSelect, Modal } from "./AdminUi";
import { button, field, panel, quietButton } from "./admin-styles";
import { listAdmin, readAdmin, removeAdmin, type AdminReport, type AdminUser, type Resource } from "../../lib/admin-api";
import { reportStatusLabels } from "../../lib/report-status";
import type { AdminCategory, AdminUnit, ReportStatus } from "../../types";
import { ReportListSkeleton } from "../LoadingSkeleton";
import ReportConversation from "../ReportConversation";
import { useNavigate } from "react-router-dom";
import CategoryImage from "../CategoryImage";

type Row = AdminUnit | AdminCategory | AdminUser | AdminReport;
const statuses = Object.keys(reportStatusLabels) as ReportStatus[];


function Empty({ children }: { children: string }) { return <div className="p-12 text-center text-sm font-semibold text-slate-400">{children}</div>; }

const labels: Record<Resource, string> = { units: "Unit polisi", categories: "Kategori", users: "Pengguna", reports: "Laporan" };
type DialogState = { mode: "detail" | "edit" | "delete"; row: Row | null };
const rowName = (row: Row) => "ticketNumber" in row ? row.ticketNumber : row.name;
export function AdminRecordDetail({ resource, row }: { resource: Resource; row: Row }) {
  let values: Array<[string, string | number]>;
  if (resource === "units") {
    const unit = row as AdminUnit;
    values = [["Nama", unit.name], ["Wilayah", unit.district], ["Alamat", unit.address], ["Telepon", unit.phone || "-"], ["Koordinat", unit.latitude + ", " + unit.longitude], ["Publikasi", unit.isPublished ? "Tampil di peta" : "Disembunyikan"], ["Laporan", unit.reports], ["Petugas", unit.staff]];
  } else if (resource === "categories") {
    const category = row as AdminCategory;
    values = [["Kategori", category.name], ["Jumlah laporan", category.reports], ["Diperbarui", new Date(category.updatedAt).toLocaleString("id-ID")]];
  } else if (resource === "users") {
    const user = row as AdminUser;
    values = [["Nama", user.name], ["Email", user.email], ["Peran", user.role], ["Unit", user.policeUnit?.name || "-"], ["Bergabung", new Date(user.createdAt).toLocaleString("id-ID")]];
  } else {
    const report = row as AdminReport;
    values = [["Nomor laporan", report.ticketNumber], ["Kategori", report.category], ["Status", reportStatusLabels[report.status]], ["Keparahan", { P0: "Kritis", P1: "Tinggi", P2: "Sedang", P3: "Rendah" }[report.severity]], ["Unit", report.policeUnit?.name || "Belum dirutekan"], ["Pelapor", report.reporter.name], ["Koordinat", report.latitude + ", " + report.longitude], ["Kronologi", report.description || "-"]];
  }
  return <>{resource === "categories" && <CategoryImage category={(row as AdminCategory).name} src={(row as AdminCategory).imageUrl} className="mb-6 h-36 w-36 rounded-xl bg-slate-100 object-contain p-3" />}<dl className="grid gap-4 sm:grid-cols-2">{values.map(([label, value]) => <div key={label} className={label === "Kronologi" ? "sm:col-span-2" : ""}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold">{value}</dd></div>)}</dl>
    {resource === "units" && (row as AdminUnit).photoUrl && <img src={(row as AdminUnit).photoUrl!} alt={"Kantor " + (row as AdminUnit).name} className="mt-5 max-h-56 w-full rounded-lg object-cover" />}
    {resource === "reports" && <ReportConversation key={row.id} reportId={row.id} readOnly hideComments />}
  </>;
}

export default function AdminResourcePage({ resource, onChanged }: { resource: Resource; onChanged: () => void }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]), [total, setTotal] = useState(0);
  const [search, setSearch] = useState(""), [filter, setFilter] = useState(""), [page, setPage] = useState(1);
  const [draftSearch, setDraftSearch] = useState(""), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [revision, setRevision] = useState(0), [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<DialogState | null>(null), [detailLoading, setDetailLoading] = useState(false);
  const [dialogError, setDialogError] = useState(""), [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState<{ id: string; mode: DialogState["mode"] } | null>(null);
  const limit = 10;
  useEffect(() => {
    let live = true;
    listAdmin(resource, { search, page, limit, ...(resource === "reports" ? { status: filter || undefined } : resource === "users" ? { role: filter || undefined } : {}) })
      .then((result) => {
        if (!live) return;
        const lastPage = Math.max(1, Math.ceil(result.total / limit));
        if (page > lastPage) { setPage(lastPage); return; }
        setRows(result.items); setTotal(result.total); setError("");
      }).catch((reason: Error) => { if (live) setError(reason.message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [resource, search, filter, page, revision]);
  useEffect(() => {
    if (!requested) return;
    let live = true;
    readAdmin(resource, requested.id).then((row) => { if (live) setDialog({ mode: requested.mode, row }); })
      .catch((reason: Error) => { if (live) setDialogError(reason.message); })
      .finally(() => { if (live) setDetailLoading(false); });
    return () => { live = false; };
  }, [resource, requested]);
  const open = (mode: DialogState["mode"], row: Row) => {
    if (mode !== "delete") { navigate(`/dashboard/${resource}/${encodeURIComponent(row.id)}${mode === "edit" ? "/edit" : ""}`); return; }
    setDialogError(""); setDetailLoading(true); setDialog({ mode, row: null }); setRequested({ id: row.id, mode });
  };
  const close = () => { if (!busy) { setDialog(null); setRequested(null); setDialogError(""); } };
  const changed = (message: string) => {
    setDialog(null); setRequested(null); setDialogError(""); setNotice(message); setLoading(true);
    setRevision((n) => n + 1); onChanged();
  };
  async function remove() {
    if (!dialog?.row || busy) return;
    setBusy(true); setDialogError("");
    try { await removeAdmin(resource, dialog.row.id); changed("Data berhasil dihapus."); }
    catch (reason) { setDialogError(reason instanceof Error ? reason.message : "Data tidak dapat dihapus."); }
    finally { setBusy(false); }
  }
  function submitSearch(event: FormEvent) { event.preventDefault(); setLoading(true); setPage(1); setSearch(draftSearch.trim()); setRevision((n) => n + 1); }
  const options = resource === "reports" ? statuses.map((value) => ({ value, label: reportStatusLabels[value] })) : [{ value: "WARGA", label: "Warga" }, { value: "POLISI", label: "Polisi" }, { value: "ADMIN", label: "Admin" }];
  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-heading text-2xl font-bold">{labels[resource]}</h2><p className="mt-1 text-sm text-slate-500">Lihat detail, tambah, edit, dan kelola data {labels[resource].toLowerCase()}.</p></div>
      <div className="flex flex-wrap gap-2">{resource === "users" && <button type="button" className={quietButton} onClick={() => navigate("/dashboard/users/new?role=POLISI")}><UserPlus size={18} />Daftarkan polisi</button>}<button type="button" className={button} onClick={() => navigate(`/dashboard/${resource}/new`)}><Plus size={18} />Tambah {labels[resource].toLowerCase()}</button></div>
    </div>
    {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <section className={panel + " overflow-hidden"}>
      <div className="flex flex-wrap gap-3 border-b border-slate-200 p-4">
        <form onSubmit={submitSearch} className="flex min-w-0 flex-1 gap-2"><input aria-label={"Cari " + labels[resource].toLowerCase()} maxLength={100} className={field + " min-w-0"} value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} placeholder={"Cari " + labels[resource].toLowerCase() + "..."} /><button className={button + " shrink-0"} type="submit"><MagnifyingGlass size={17} />Cari</button></form>
        {(resource === "reports" || resource === "users") && <div className="w-full sm:w-56"><AdminSelect label={resource === "reports" ? "Filter status" : "Filter peran"} value={filter} onChange={(value) => { setLoading(true); setFilter(value); setPage(1); }} options={[{ value: "", label: resource === "reports" ? "Semua status" : "Semua peran" }, ...options]} /></div>}
      </div>
      {loading ? <div className="p-4"><ReportListSkeleton count={3} /></div> : error ? <div role="alert" className="p-6 text-sm text-red-700">{error}<button className={quietButton + " ml-3"} onClick={() => { setLoading(true); setRevision((n) => n + 1); }}>Coba lagi</button></div> :
        <Table resource={resource} rows={rows} selected={dialog?.row || null} onSelect={(row) => open("detail", row)} onEdit={(row) => open("edit", row)} onDelete={(row) => open("delete", row)} />}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-4 text-xs text-slate-500">
        <span>{total} data / Halaman {page} dari {Math.max(1, Math.ceil(total / limit))}</span>
        <div className="flex gap-2"><button type="button" className={quietButton} disabled={loading || page === 1} onClick={() => { setLoading(true); setPage((n) => n - 1); }}>Sebelumnya</button><button type="button" className={quietButton} disabled={loading || page * limit >= total} onClick={() => { setLoading(true); setPage((n) => n + 1); }}>Berikutnya</button></div>
      </footer>
    </section>
    {dialog && (detailLoading || (requested && !dialog.row)) ? <Modal title="Memuat detail" onClose={close}>{detailLoading ? <ReportListSkeleton count={2} /> : <p role="alert" className="text-sm text-red-700">{dialogError || "Data tidak ditemukan."}</p>}</Modal> :
      dialog?.row && <Modal title={(dialog.mode === "delete" ? "Hapus " : "Detail ") + labels[resource].toLowerCase()} onClose={close} busy={busy}>
        {dialogError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{dialogError}</p>}
        {dialog.mode === "delete" ? <><p className="break-words text-sm leading-relaxed">Hapus <strong>{rowName(dialog.row)}</strong>?</p><p className="mt-2 text-xs leading-relaxed text-slate-500">{resource === "reports" ? "Laporan, komentar, dan riwayat terkait akan dihapus. Tindakan ini tidak dapat dibatalkan." : "Data yang masih memiliki relasi atau aktivitas tidak dapat dihapus."}</p>
          <div className="mt-6 flex justify-end gap-2"><button disabled={busy} className={quietButton} onClick={close}>Batal</button><button disabled={busy} className={button} onClick={() => void remove()}>{busy ? "Menghapus..." : "Ya, hapus"}</button></div></> :
          <><AdminRecordDetail resource={resource} row={dialog.row} /><div className="mt-5 flex justify-end"><button className={button} onClick={() => open("edit", dialog.row!)}><PencilSimple size={17} />Edit data</button></div></>}
      </Modal>}
  </div>;
}
function Table({ resource, rows, selected, onSelect, onEdit, onDelete }: { resource: Resource; rows: Row[]; selected: Row | null; onSelect: (row: Row) => void; onEdit: (row: Row) => void; onDelete: (row: Row) => void }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400"><tr>{resource === "units" && <><th className="px-5 py-3">Unit</th><th className="px-5 py-3">Wilayah</th><th className="px-5 py-3">Laporan</th><th className="px-5 py-3">Petugas</th></>}{resource === "categories" && <><th className="px-5 py-3">Kategori</th><th className="px-5 py-3">Laporan</th></>}{resource === "users" && <><th className="px-5 py-3">Pengguna</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Unit</th></>}{resource === "reports" && <><th className="px-5 py-3">Laporan</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Unit</th></>}<th className="px-5 py-3 text-right">Aksi</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id} className={"cursor-pointer hover:bg-slate-50 " + (selected?.id === row.id ? "bg-red-50/40" : "")} onClick={() => onSelect(row)}>{resource === "units" && (() => { const unit = row as AdminUnit; return <><td className="px-5 py-3.5"><strong className="block font-black">{unit.name}</strong><span className="text-[10px] text-slate-400">{unit.address}</span></td><td className="px-5 py-3.5 font-bold">{unit.district}</td><td className="px-5 py-3.5 font-black">{unit.reports}</td><td className="px-5 py-3.5 font-black">{unit.staff}</td></>; })()}{resource === "categories" && (() => { const category = row as AdminCategory; return <><td className="px-5 py-3.5 font-black"><span className="flex items-center gap-3"><CategoryImage category={category.name} src={category.imageUrl} className="h-10 w-10 shrink-0 rounded-lg bg-slate-50 object-contain" />{category.name}</span></td><td className="px-5 py-3.5 font-black">{category.reports}</td></>; })()}{resource === "users" && (() => { const user = row as AdminUser; return <><td className="px-5 py-3.5"><strong className="block font-black">{user.name}</strong><span className="text-[10px] text-slate-400">{user.email}</span></td><td className="px-5 py-3.5"><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black">{user.role}</span></td><td className="px-5 py-3.5 text-slate-500">{user.policeUnit?.name || "—"}</td></>; })()}{resource === "reports" && (() => { const report = row as AdminReport; return <><td className="max-w-[360px] px-5 py-3.5"><strong className="block truncate font-black">{report.category}</strong><span className="block truncate text-[10px] text-slate-400">{report.ticketNumber} · {report.description}</span></td><td className="px-5 py-3.5"><span className="rounded-full bg-slate-50 px-2.5 py-1 text-[9px] font-black">{reportStatusLabels[report.status]}</span></td><td className="px-5 py-3.5 text-slate-500">{report.policeUnit?.name || "Belum dirutekan"}</td></>; })()}<td className="whitespace-nowrap px-5 py-3.5 text-right"><button type="button" onClick={(event) => { event.stopPropagation(); onSelect(row); }} className="mr-3 text-slate-500 hover:text-red-600" aria-label="Lihat detail"><Eye size={17} /></button><button type="button" onClick={(event) => { event.stopPropagation(); onEdit(row); }} className="mr-3 text-slate-500 hover:text-red-600" aria-label="Edit"><PencilSimple size={17} /></button><button type="button" onClick={(event) => { event.stopPropagation(); onDelete(row); }} className="text-slate-500 hover:text-red-600" aria-label="Hapus"><Trash size={17} /></button></td></tr>)}</tbody></table>{!rows.length && <Empty>Data tidak ditemukan.</Empty>}</div>;
}

