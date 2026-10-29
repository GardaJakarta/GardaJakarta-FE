import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import AppLogo from "../components/branding/AppLogo";
import { useAuth } from "../context/useAuth";

export default function ProfilePage() {
  const { user, updateName } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const valid = name.trim().length >= 2 && name.trim().length <= 100;
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true); setError(""); setNotice("");
    try { await updateName(name); setName(name.trim()); setEditing(false); setNotice("Nama profil berhasil diperbarui."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Profil belum dapat disimpan. Coba lagi."); }
    finally { setSaving(false); }
  }
  return <main className="dashboard-app min-h-dvh bg-[linear-gradient(145deg,#fff1ee_0%,#f3f4f6_38%,#f3f4f6_100%)] px-4 pb-12 pt-4 text-slate-900 sm:px-8">
    <header className="mx-auto flex max-w-5xl items-center justify-between rounded-full bg-white px-5 py-3 shadow-sm">
      <Link to="/dashboard" aria-label="Dashboard Garda Jakarta"><AppLogo size={120} /></Link>
      <Link to="/dashboard" className="rounded-full px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">Kembali ke dashboard</Link>
    </header>
    <div className="mx-auto mt-10 max-w-3xl sm:mt-16">
      <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#e62428]">Akun saya</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Profile</h1>
      <p className="mt-3 text-sm text-slate-500">Kelola informasi akun Garda Jakarta Anda.</p>
      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_16px_48px_rgba(15,23,42,.05)]" aria-label="Informasi profil">
        <div className="flex min-w-0 items-center gap-4 border-b border-slate-100 p-6 sm:p-8">
          <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-red-50 text-2xl font-bold text-[#e62428]">{user?.image ? <img src={user.image} alt="Foto profil" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : user?.name.slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0"><h2 className="break-words text-lg font-bold">{user?.name}</h2><p className="mt-1 text-xs text-slate-500">{user?.role === "admin" ? "Admin" : user?.role === "polisi" ? "Petugas polisi" : "Warga"}</p></div>
        </div>
        <form onSubmit={(event) => void save(event)} className="space-y-6 p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4"><h2 className="text-base font-bold">Informasi pribadi</h2>{!editing && <button type="button" onClick={() => { setName(user?.name || ""); setEditing(true); setNotice(""); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50">Edit profil</button>}</div>
          <label className="grid gap-2 text-xs font-semibold">Nama lengkap<input autoComplete="name" required minLength={2} maxLength={100} readOnly={!editing} disabled={saving} value={name} onChange={(event) => { setName(event.target.value); setError(""); }} aria-invalid={Boolean(error)} aria-describedby={error ? "profile-error" : undefined} className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none read-only:bg-slate-50 focus:border-[#e62428] focus:ring-2 focus:ring-red-50 disabled:opacity-60" /></label>
          <label className="grid gap-2 text-xs font-semibold">Email<input type="email" value={user?.email || ""} readOnly aria-describedby="profile-email-note" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500" /><span id="profile-email-note" className="font-normal text-slate-500">Email akun tidak dapat diubah.</span></label>
          {error && <p id="profile-error" role="alert" className="text-xs text-red-700">{error}</p>}
          {notice && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-xs text-emerald-800">{notice}</p>}
          {editing && <div className="flex justify-end gap-2 border-t border-slate-100 pt-5"><button type="button" disabled={saving} onClick={() => { setName(user?.name || ""); setEditing(false); setError(""); }} className="rounded-lg px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Batal</button><button disabled={saving || !valid || name.trim() === user?.name} className="rounded-lg bg-[#e62428] px-4 py-3 text-xs font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Menyimpan..." : "Simpan perubahan"}</button></div>}
        </form>
      </section>
    </div>
  </main>;
}
