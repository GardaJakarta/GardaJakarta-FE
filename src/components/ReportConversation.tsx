import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { changeReportStatus, commentOnReport, evidenceUrl, getReportInteractions, submitReportClarification, uploadReportEvidence, voteReport } from "../lib/api";
import { reportStatusLabels } from "../lib/report-status";
import type { ReportInteractions, ReportStatus } from "../types";
import ImagePreview from "./ImagePreview";
import { SkeletonBlock } from "./LoadingSkeleton";

const time = (value: string) => new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
const button = "rounded-full bg-[#e62428] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50 hover:bg-[#c91d22]";
const field = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#e62428]";

export default function ReportConversation({ reportId, readOnly = false, onStatusChanged }: { reportId: string; readOnly?: boolean; onStatusChanged?: (status: ReportStatus) => void }) {
  const [data, setData] = useState<ReportInteractions | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const commentPreviews = useMemo(() => commentFiles.map((file) => ({ file, url: URL.createObjectURL(file) })), [commentFiles]);
  useEffect(() => () => commentPreviews.forEach(({ url }) => URL.revokeObjectURL(url)), [commentPreviews]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<ReportStatus | "">("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadIds, setUploadIds] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [preview, setPreview] = useState<{ src: string; alt: string } | null>(null);
  const filePreviews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => filePreviews.forEach(({ url }) => URL.revokeObjectURL(url)), [filePreviews]);
  const chooseFiles = (selected: File[]) => {
    if (busy) return;
    if (selected.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) { setError("Gunakan foto JPG, PNG, atau WebP."); return; }
    if (selected.length > 3 || selected.some((file) => file.size > 5 * 1024 * 1024)) { setError("Pilih maksimal 3 foto, masing-masing maksimal 5 MB."); return; }
    setFiles(selected); setUploadIds([]); setError("");
  };
  useEffect(() => {
    let active = true;
    getReportInteractions(reportId).then((result) => { if (active) setData(result); }).catch(() => { if (active) setError("Riwayat belum dapat dimuat. Coba lagi."); });
    return () => { active = false; };
  }, [reportId]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); } catch (err) { setError(err instanceof Error ? err.message : "Permintaan belum berhasil. Coba lagi."); }
    finally { setBusy(false); }
  }
  async function refresh() { const next = await getReportInteractions(reportId); setData(next); return next; }
  if (!data) return <section className="mt-5 border-t border-slate-100 pt-4" aria-live="polite">{error ? <><p className="text-xs text-red-700">{error}</p><button type="button" className="mt-2 text-xs font-bold" onClick={() => void run(async () => { await refresh(); })}>Coba lagi</button></> : <div className="grid gap-3"><SkeletonBlock className="h-4 w-32" /><SkeletonBlock className="h-16 w-full" /><SkeletonBlock className="h-16 w-11/12" /></div>}</section>;
  const canAct = !readOnly && (data.canManage || data.canClarify);
  return <section className="mt-5 space-y-5 border-t border-slate-100 pt-5">
    <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-500">Dukungan warga</span><button type="button" aria-pressed={data.hasVoted} disabled={busy || readOnly || !data.canParticipate} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold ${data.hasVoted ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 text-slate-600"}`} onClick={() => void run(async () => { const vote = await voteReport(reportId, !data.hasVoted); setData({ ...data, ...vote }); })}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 13 6-6 6 6M12 7v13" /></svg>{data.voteCount} dukungan</button></div>
    {canAct && <form className="space-y-3 rounded-xl bg-slate-50 p-3" onSubmit={(event) => { event.preventDefault(); void run(async () => {
      const ids = [...uploadIds];
      for (let i = ids.length; i < files.length; i++) { ids.push((await uploadReportEvidence(reportId, files[i])).id); setUploadIds([...ids]); }
      const result = data.canManage ? await changeReportStatus(reportId, status as ReportStatus, message, ids) : await submitReportClarification(reportId, message, ids);
      await refresh(); setMessage(""); setFiles([]); setUploadIds([]); setStatus(""); onStatusChanged?.(result.status); if (!onStatusChanged) window.dispatchEvent(new Event("garda:report-updated"));
    }); }}>
      <h3 className="text-sm font-bold">{data.canManage ? "Perbarui penanganan" : "Berikan klarifikasi"}</h3>
      {data.clarificationPrompt && <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{data.clarificationPrompt}</p>}
      {data.clarificationResponse && <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-600">Balasan pelapor: {data.clarificationResponse}</p>}
      {data.canManage && <div className="relative"><button type="button" disabled={busy} aria-expanded={menuOpen} className={`${field} flex items-center justify-between bg-white text-left`} onClick={() => setMenuOpen(!menuOpen)} onKeyDown={(event) => { if (event.key === "Escape") setMenuOpen(false); }}>{status ? reportStatusLabels[status] : "Pilih status"}<span aria-hidden="true">⌄</span></button>{menuOpen && <div className="mt-1 grid gap-1 rounded-xl border border-slate-200 bg-white p-1" role="group" aria-label="Status penanganan">{data.nextStatuses.map((option) => <button key={option} type="button" className="rounded-lg px-3 py-2 text-left text-xs hover:bg-red-50" disabled={busy} onClick={() => { setStatus(option); setMenuOpen(false); }}>{reportStatusLabels[option]}</button>)}</div>}</div>}
      <label className="grid gap-1 text-xs font-semibold">{status === "CLARIFICATION" ? "Informasi yang perlu dilengkapi" : "Catatan"}<textarea required minLength={4} maxLength={2000} disabled={busy} className={`${field} min-h-24 bg-white`} value={message} onChange={(event) => setMessage(event.target.value)} /></label>
      <div className="grid gap-1 text-xs font-semibold"><span>Bukti foto {status === "RESOLVED" ? "(wajib)" : "(opsional)"}</span><label onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); chooseFiles(Array.from(event.dataTransfer.files)); }} className="grid cursor-copy gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-center hover:border-[#e62428]"><span className="font-bold text-slate-600">Tarik foto ke sini atau pilih file</span><input disabled={busy} type="file" accept="image/jpeg,image/png,image/webp" multiple className="mx-auto max-w-full text-xs file:mr-2 file:rounded-full file:border-0 file:bg-slate-100 file:px-3 file:py-2" onChange={(event) => { chooseFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} /><span className="font-normal text-slate-500">JPG, PNG, WebP. Maksimal 3 foto, 5 MB per foto.</span></label>{filePreviews.length > 0 && <div className="grid grid-cols-3 gap-2">{filePreviews.map(({ file, url }, index) => <div className="relative" key={`${file.name}-${file.lastModified}`}><button key={`${file.name}-${file.lastModified}`} type="button" className="overflow-hidden rounded-lg" onClick={() => setPreview({ src: url, alt: file.name })}><img src={url} alt={`Pratinjau ${file.name}`} className="h-20 w-full object-cover" /></button><button type="button" disabled={busy} aria-label={`Hapus ${file.name}`} onClick={() => { setFiles((current) => current.filter((_, i) => i !== index)); setUploadIds((current) => current.filter((_, i) => i !== index)); }} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-slate-950/80 text-white disabled:opacity-50">&times;</button></div>)}</div>}</div>
      <button className={button} disabled={busy || message.trim().length < 4 || (data.canManage && !status) || (status === "RESOLVED" && !files.length)}>{busy ? "Menyimpan..." : data.canManage ? "Simpan pembaruan" : "Kirim klarifikasi"}</button>
    </form>}
    <div><h3 className="mb-3 text-sm font-bold">Riwayat penanganan</h3>{data.activities.length === 0 && <p className="text-xs text-slate-500">Riwayat belum tersedia untuk laporan ini.</p>}<ol className="space-y-5 border-l-2 border-slate-200 pl-4">{data.activities.map((item) => <li key={item.id} className="relative space-y-1.5"><span aria-hidden="true" className={`absolute -left-[23px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${item.status === "RESOLVED" ? "bg-emerald-500" : item.status === "REJECTED" ? "bg-red-500" : item.status === "IN_PROGRESS" ? "bg-orange-500" : item.status === "VERIFIED" ? "bg-sky-500" : item.status === "CLARIFICATION" ? "bg-amber-500" : "bg-slate-400"}`} /><div className="flex flex-wrap gap-2 text-[11px]"><strong>{item.status ? reportStatusLabels[item.status] : "Pembaruan"}</strong><time className="text-slate-400" dateTime={item.createdAt}>{time(item.createdAt)}</time></div>{item.author !== "Pelapor anonim" && <p className="text-[10px] font-semibold text-slate-500">{item.author}</p>}<p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-600">{item.message}</p>{item.evidence.length > 0 && <div className="flex flex-wrap gap-2">{item.evidence.map((file) => <button key={file.id} type="button" className="overflow-hidden rounded-lg" onClick={() => setPreview({ src: evidenceUrl(file.url), alt: "Bukti penanganan" })}><img crossOrigin="use-credentials" src={evidenceUrl(file.url)} alt="Bukti penanganan" className="h-20 w-24 object-cover" loading="lazy" /></button>)}</div>}</li>)}</ol></div>
    <div className="space-y-3"><h3 className="text-sm font-bold">Komentar warga</h3>{!data.comments.length && <p className="text-xs text-slate-500">Belum ada komentar.</p>}{data.comments.map((item) => <article key={item.id} className="border-b border-slate-100 pb-3"><p className="text-[11px] font-bold">Warga anonim <time dateTime={item.createdAt} className="ml-1 font-normal text-slate-400">{time(item.createdAt)}</time></p><p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-600">{item.body}</p>{item.evidence.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{item.evidence.map((file) => <button key={file.id} type="button" className="overflow-hidden rounded-lg" onClick={() => setPreview({ src: evidenceUrl(file.url), alt: "Foto komentar" })}><img src={evidenceUrl(file.url)} alt="Foto komentar" className="h-16 w-20 object-cover" crossOrigin="use-credentials" loading="lazy" /></button>)}</div>}</article>)}
      {!readOnly && data.canParticipate && <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); void run(async () => { await commentOnReport(reportId, comment, commentFiles); setComment(""); setCommentFiles([]); await refresh(); }); }}><label className="grid gap-1 text-xs font-semibold">Komentar anonim<textarea required minLength={2} maxLength={500} className={`${field} min-h-20`} value={comment} disabled={busy} onChange={(event) => setComment(event.target.value)} /><span className="font-normal text-slate-500">Nama akun disembunyikan. Hindari menulis identitas pribadi.</span></label><div className="grid gap-1 text-xs font-semibold"><span>Foto pendukung (opsional)</span><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:border-[#e62428] hover:bg-red-50"><svg className="h-4 w-4 text-[#e62428]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-4-4L7 20"/></svg>Tambah foto<input disabled={busy} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => { const selected = Array.from(event.target.files ?? []).slice(0, 3); if (selected.every((file) => file.size <= 5 * 1024 * 1024)) setCommentFiles(selected); event.target.value = ""; }} /></label></div>{commentPreviews.length > 0 && <div className="grid grid-cols-3 gap-2">{commentPreviews.map(({ file, url }, index) => <div className="relative" key={`${file.name}-${file.lastModified}`}><img src={url} alt={`Pratinjau ${file.name}`} className="h-16 w-full rounded-lg object-cover" /><button type="button" aria-label={`Hapus ${file.name}`} onClick={() => setCommentFiles((current) => current.filter((_, i) => i !== index))} className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-slate-950/80 text-white">&times;</button></div>)}</div>}<button disabled={busy || comment.trim().length < 2} className={button}>Kirim komentar</button></form>}
      {readOnly && <Link className="inline-block text-xs font-bold text-[#e62428]" to="/login">Masuk untuk memberikan dukungan dan komentar</Link>}
    </div>
    {data.hasMore && <button type="button" disabled={busy} className="text-xs font-bold text-[#e62428]" onClick={() => void run(async () => { const next = await getReportInteractions(reportId, data.page + 1); setData({ ...next, activities: [...data.activities, ...next.activities], comments: [...data.comments, ...next.comments] }); })}>Muat riwayat dan komentar berikutnya</button>}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    {preview && <ImagePreview src={preview.src} alt={preview.alt} onClose={() => setPreview(null)} />}
  </section>;
}




