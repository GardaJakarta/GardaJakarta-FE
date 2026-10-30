import { useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes } from "react";
import { listAdmin, saveAdmin, type AdminRecord, type AdminReport, type AdminUser, type Resource } from "../../lib/admin-api";
import type { AdminCategory, AdminUnit, ReportStatus } from "../../types";
import { uploadReportEvidence } from "../../lib/api";
import { reportStatusLabels } from "../../lib/report-status";
import EvidenceUploadField from "../EvidenceUploadField";
import { ReportListSkeleton } from "../LoadingSkeleton";
import { AdminSelect, Modal } from "./AdminUi";
import { button, field, quietButton } from "./admin-styles";

const nextStatuses: Record<ReportStatus, ReportStatus[]> = {
  PENDING: ["VERIFIED", "CLARIFICATION", "REJECTED"], VERIFIED: ["IN_PROGRESS", "CLARIFICATION", "REJECTED"],
  IN_PROGRESS: ["RESOLVED", "CLARIFICATION"], CLARIFICATION: ["VERIFIED", "IN_PROGRESS", "REJECTED"], RESOLVED: [], REJECTED: [],
};
const labels: Record<Resource, string> = { units: "unit polisi", categories: "kategori", users: "pengguna", reports: "laporan" };
function initial(resource: Resource, record: AdminRecord | null): Record<string, string> {
  if (resource === "units") {
    const row = record as AdminUnit | null;
    return { name: row?.name || "", district: row?.district || "", address: row?.address || "", phone: row?.phone || "", latitude: String(row?.latitude ?? -6.2), longitude: String(row?.longitude ?? 106.82), photoUrl: row?.photoUrl || "", isPublished: String(row?.isPublished ?? true) };
  }
  if (resource === "categories") return { name: (record as AdminCategory | null)?.name || "" };
  if (resource === "users") {
    const row = record as AdminUser | null;
    return { name: row?.name || "", email: row?.email || "", password: "", role: row?.role || "WARGA", policeUnitId: row?.policeUnitId || "" };
  }
  const row = record as AdminReport | null;
  return { category: row?.category || "", description: row?.description || "", severity: row?.severity || "P2", latitude: String(row?.latitude ?? -6.2), longitude: String(row?.longitude ?? 106.82), reporterId: row?.reporterId || "", policeUnitId: row?.policeUnitId || "", status: row?.status || "PENDING", message: "" };
}
function Input({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="grid min-w-0 gap-1.5 text-xs font-semibold"><span>{label}{props.required && <span className="ml-1 text-red-600">*</span>}</span><input {...props} className={field} /></label>;
}
async function allOptions<T extends AdminRecord>(resource: Resource, role?: string): Promise<T[]> {
  const items: T[] = [];
  let page = 1, more = true;
  while (more) { const result = await listAdmin<T>(resource, { page, limit: 50, role }); items.push(...result.items); more = result.hasMore; page++; }
  return items;
}

export default function AdminRecordEditor({ resource, record, onClose, onSaved }: { resource: Resource; record: AdminRecord | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(() => initial(resource, record));
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [units, setUnits] = useState<AdminUnit[]>([]), [categories, setCategories] = useState<AdminCategory[]>([]), [citizens, setCitizens] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(resource === "users" || resource === "reports");
  const [optionsReady, setOptionsReady] = useState(false), [attempt, setAttempt] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const uploads = useRef(new Map<File, string>());
  useEffect(() => {
    if (resource !== "users" && resource !== "reports") return;
    let active = true;
    Promise.all([allOptions<AdminUnit>("units"), resource === "reports" ? allOptions<AdminCategory>("categories") : Promise.resolve([]), resource === "reports" && !record ? allOptions<AdminUser>("users", "WARGA") : Promise.resolve([])])
      .then(([unitRows, categoryRows, userRows]) => { if (active) { setUnits(unitRows); setCategories(categoryRows); setCitizens(userRows); setOptionsReady(true); setError(""); } })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [resource, record, attempt]);
  const set = (key: string, value: string) => setForm((old) => ({ ...old, [key]: value }));
  const choose = (key: string, label: string, options: Array<{ value: string; label: string }>) => <div className="grid gap-1.5"><span className="text-xs font-semibold">{label}</span><AdminSelect label={label} value={form[key]} options={options} onChange={(value) => { set(key, value); if (key === "role" && value !== "POLISI") set("policeUnitId", ""); }} disabled={busy} /></div>;
  const unitOptions = [{ value: "", label: resource === "users" ? "Pilih unit polisi" : "Belum dirutekan" }, ...units.filter((unit) => unit.isPublished || unit.id === form.policeUnitId).map((unit) => ({ value: unit.id, label: unit.name }))];
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      let input: Record<string, unknown>;
      if (resource === "units") input = { ...form, latitude: Number(form.latitude), longitude: Number(form.longitude), phone: form.phone || null, photoUrl: form.photoUrl || null, isPublished: form.isPublished === "true" };
      else if (resource === "categories") input = { name: form.name };
      else if (resource === "users") {
        if (form.role === "POLISI" && !form.policeUnitId) throw new Error("Pilih unit untuk akun polisi.");
        input = { name: form.name, role: form.role, policeUnitId: form.role === "POLISI" ? form.policeUnitId : null, ...(!record ? { email: form.email, password: form.password } : {}) };
      } else {
        if (!form.category || (!record && !form.reporterId)) throw new Error("Pilih kategori dan pelapor.");
        const evidenceIds: string[] = [];
        if (record) {
          if (form.status === "RESOLVED" && (record as AdminReport).status !== "RESOLVED" && !files.length) throw new Error("Lampirkan foto bukti penyelesaian.");
          for (const file of files) {
            let id = uploads.current.get(file);
            if (!id) { id = (await uploadReportEvidence(record.id, file)).id; uploads.current.set(file, id); }
            evidenceIds.push(id);
          }
        }
        input = { category: form.category, description: form.description, severity: form.severity, latitude: Number(form.latitude), longitude: Number(form.longitude), policeUnitId: form.policeUnitId || null,
          ...(record ? { status: form.status, message: form.message, updatedAt: (record as AdminReport).updatedAt, evidenceIds } : { reporterId: form.reporterId }) };
      }
      await saveAdmin(resource, input, record?.id);
      onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Data belum disimpan."); } finally { setBusy(false); }
  }
  const report = resource === "reports" ? record as AdminReport | null : null;
  const canAttach = report && !["RESOLVED", "REJECTED"].includes(report.status);
  return <Modal title={(record ? "Edit " : "Tambah ") + labels[resource]} onClose={onClose} busy={busy}>
    {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {loading ? <ReportListSkeleton count={2} /> : (resource === "users" || resource === "reports") && !optionsReady ? <button className={quietButton} onClick={() => { setLoading(true); setAttempt((n) => n + 1); }}>Muat ulang pilihan</button> :
      <form onSubmit={(event) => void submit(event)} className="grid gap-4">
        <fieldset disabled={busy} className="grid min-w-0 gap-4">
          {(resource === "units" || resource === "users" || resource === "categories") && <Input label={resource === "categories" ? "Nama kategori" : resource === "units" ? "Nama unit" : "Nama lengkap"} required minLength={2} maxLength={resource === "users" ? 100 : 120} value={form.name} onChange={(event) => set("name", event.target.value)} />}
          {resource === "units" && <>
            <Input label="Wilayah" required minLength={2} maxLength={80} value={form.district} onChange={(event) => set("district", event.target.value)} />
            <Input label="Alamat" required minLength={5} maxLength={240} value={form.address} onChange={(event) => set("address", event.target.value)} />
            <Input label="Telepon" maxLength={40} value={form.phone} onChange={(event) => set("phone", event.target.value)} />
            <Input label="URL foto kantor (opsional)" type="url" value={form.photoUrl} onChange={(event) => set("photoUrl", event.target.value)} />
            {choose("isPublished", "Publikasi unit", [{ value: "true", label: "Tampil di peta dan menerima routing" }, { value: "false", label: "Disembunyikan" }])}
          </>}
          {(resource === "units" || resource === "reports") && <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Latitude" type="number" step="any" min={-7.2} max={-5.8} required value={form.latitude} onChange={(event) => set("latitude", event.target.value)} />
            <Input label="Longitude" type="number" step="any" min={106.4} max={107.2} required value={form.longitude} onChange={(event) => set("longitude", event.target.value)} />
          </div>}
          {resource === "users" && <>
            <Input label="Email" type="email" required disabled={Boolean(record) || busy} value={form.email} onChange={(event) => set("email", event.target.value)} />
            {!record && <Input label="Password awal" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={form.password} onChange={(event) => set("password", event.target.value)} />}
            {choose("role", "Peran akun", [{ value: "WARGA", label: "Warga" }, { value: "POLISI", label: "Polisi" }, { value: "ADMIN", label: "Admin" }])}
            {form.role === "POLISI" && choose("policeUnitId", "Unit polisi (wajib)", unitOptions)}
          </>}
          {resource === "reports" && <>
            {!record && choose("reporterId", "Pelapor (wajib)", [{ value: "", label: "Pilih akun warga" }, ...citizens.map((user) => ({ value: user.id, label: user.name + " - " + user.email }))])}
            {choose("category", "Kategori (wajib)", [{ value: "", label: "Pilih kategori" }, ...categories.map((item) => ({ value: item.name, label: item.name }))])}
            <label className="grid gap-1.5 text-xs font-semibold">Kronologi <textarea className={field + " min-h-28"} required minLength={10} maxLength={2000} value={form.description} onChange={(event) => set("description", event.target.value)} /></label>
            {choose("severity", "Keparahan", [{ value: "P0", label: "Kritis" }, { value: "P1", label: "Tinggi" }, { value: "P2", label: "Sedang" }, { value: "P3", label: "Rendah" }])}
            {choose("policeUnitId", "Unit penanganan", unitOptions)}
            {report ? <>
              {choose("status", "Status laporan", [report.status, ...nextStatuses[report.status]].map((status) => ({ value: status, label: reportStatusLabels[status] })))}
              <label className="grid gap-1.5 text-xs font-semibold">Catatan penanganan (wajib)<textarea className={field + " min-h-24"} required minLength={4} maxLength={2000} value={form.message} onChange={(event) => set("message", event.target.value)} /></label>
              {canAttach && <><p className="text-xs text-slate-500">Foto wajib untuk status Selesai; opsional untuk pembaruan lainnya.</p><EvidenceUploadField files={files} onChange={setFiles} /></>}
            </> : <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Laporan baru berstatus Belum diverifikasi. Admin dicatat sebagai pembuat atas nama pelapor.</p>}
          </>}
        </fieldset>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" disabled={busy} onClick={onClose} className={quietButton}>Batal</button><button type="submit" disabled={busy} className={button}>{busy ? "Menyimpan..." : "Simpan"}</button></div>
      </form>}
  </Modal>;
}
