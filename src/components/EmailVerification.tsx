import { useEffect, useState, type FormEvent } from "react";
import { EnvelopeSimple } from "@phosphor-icons/react";
import { authClient } from "../lib/auth-client";

export default function EmailVerification({ email, onBack, onVerified }: { email: string; onBack: () => void; onVerified: () => void }) {
  const [otp, setOtp] = useState(""), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false), [seconds, setSeconds] = useState(60);
  useEffect(() => { const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000); return () => clearInterval(timer); }, []);
  async function verify(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    if (!/^\d{6}$/.test(otp)) { setError("Masukkan kode 6 digit dari email."); return; }
    setBusy(true); setError("");
    try {
      const result = await authClient.emailOtp.verifyEmail({ email, otp });
      if (result.error) { setError(result.error.status === 429 ? "Terlalu banyak percobaan. Tunggu sebentar." : "Kode salah, kedaluwarsa, atau sudah dipakai. Periksa kode atau kirim ulang."); return; }
      onVerified();
    } catch { setError("Verifikasi belum berhasil. Periksa koneksi lalu coba lagi."); }
    finally { setBusy(false); }
  }
  async function resend() {
    if (busy || seconds) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
      if (result.error) { setError(result.error.status === 429 ? "Tunggu sebentar sebelum mengirim ulang." : "Kode belum terkirim. Coba lagi sebentar."); setSeconds(60); return; }
      setSeconds(60); setOtp(""); setNotice("Kode baru telah dikirim. Gunakan kode yang paling baru.");
    } catch { setError("Email belum terkirim. Periksa koneksi lalu coba lagi."); }
    finally { setBusy(false); }
  }
  return <form className="auth-form" onSubmit={(event) => void verify(event)}>
    <div className="space-y-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-600"><EnvelopeSimple size={25} weight="duotone" /></span><h2 className="font-heading text-xl font-bold">Verifikasi email</h2><p className="break-words text-sm leading-relaxed text-slate-500">Periksa kode 6 digit yang dikirim ke <strong className="text-slate-800">{email}</strong>. Kode berlaku selama 5 menit. Periksa folder spam jika belum terlihat.</p></div>
    <label>Kode OTP<input autoFocus aria-invalid={Boolean(error)} aria-describedby="otp-message" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" className="text-center text-xl tracking-[.5em]" disabled={busy} /></label>
    <div id="otp-message">{error && <p role="alert" className="text-xs text-red-700">{error}</p>}{notice && <p role="status" className="text-xs text-emerald-700">{notice}</p>}</div>
    <button className="primary-button" disabled={busy || otp.length !== 6} type="submit">{busy ? "Memproses..." : "Verifikasi email"}</button>
    <button type="button" onClick={() => void resend()} disabled={busy || seconds > 0} className="text-xs font-bold text-red-600 disabled:text-slate-400">{seconds ? `Kirim ulang dalam ${seconds} detik` : "Kirim ulang kode"}</button>
    <button type="button" onClick={onBack} disabled={busy} className="text-xs font-semibold text-slate-500">Kembali ke login</button>
  </form>;
}
