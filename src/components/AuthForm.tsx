import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { useAuth } from "../context/useAuth";
import type { AuthPortal } from "../types";
import { portalPaths } from "../lib/portals";
import GoogleIcon from "./GoogleIcon";
import AuthToast from "./AuthToast";
import EmailVerification from "./EmailVerification";

type FieldName = "name" | "email" | "password";
type FieldErrors = Partial<Record<FieldName, string>>;

const SAFE_MESSAGES = new Set([
  "Email atau password tidak cocok.",
  "Email sudah terdaftar. Silakan masuk.",
  "Password minimal terdiri dari 8 karakter.",
  "Password maksimal terdiri dari 128 karakter.",
  "Alamat email belum valid.",
  "Terlalu banyak percobaan. Coba lagi dalam 15 menit.",
]);

function safeSubmissionMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  if (SAFE_MESSAGES.has(error.message)) return error.message;
  if (/^Akun ini terdaftar untuk portal (warga|polisi|admin), bukan portal (warga|polisi|admin)\.$/.test(error.message)) {
    return error.message;
  }
  return fallback;
}

function oauthMessage() {
  const oauthError = new URLSearchParams(window.location.search).get("error");
  if (!oauthError) return null;
  if (oauthError === "account_not_linked") return "Masuk dengan password Anda, lalu tautkan Google dari halaman akun.";
  if (oauthError === "access_denied") return "Akses Google dibatalkan. Silakan coba lagi jika ingin melanjutkan.";
  return "Login Google belum berhasil. Silakan coba lagi.";
}

export default function AuthForm({ mode, portal = "warga" }: { mode: "login" | "register"; portal?: AuthPortal }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, signInGoogle, isLoading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verified, setVerified] = useState(location.state?.emailVerified === true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [oauthError, setOauthError] = useState<string | null>(oauthMessage);
  const isRegister = mode === "register";
  const reducedMotion = useReducedMotion();

  const setFieldError = (field: FieldName, message: string) => {
    setFieldErrors((current) => ({ ...current, [field]: message }));
  };

  const clearFieldError = (field: FieldName) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const showSubmissionError = (message: string) => {
    if (isRegister && /terdaftar/i.test(message)) {
      setFieldError("email", "Email sudah terdaftar. Silakan masuk.");
      return;
    }
    if (/alamat email|email/i.test(message)) {
      setFieldError("email", message);
      return;
    }
    setFieldError("password", message);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});
    if (isRegister && name.trim().length < 2) setFieldError("name", "Nama minimal terdiri dari 2 karakter.");
    if (!email.trim()) setFieldError("email", "Email wajib diisi.");
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) setFieldError("email", "Masukkan alamat email yang valid.");
    if (password.length < 8) setFieldError("password", "Password minimal terdiri dari 8 karakter.");
    if ((isRegister && name.trim().length < 2) || !email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim()) || password.length < 8) {
      return;
    }
    try {
      if (isRegister) { const requiresVerification = await signUp(name.trim(), email.trim(), password); if (requiresVerification) { setVerificationEmail(email.trim()); setPassword(""); return; } }
      else await signIn(email.trim(), password, portal);
      navigate(portalPaths[portal].home);
    } catch (submissionError) {
      if (submissionError instanceof Error && submissionError.message === "Verifikasi email diperlukan.") { setVerificationEmail(email.trim()); setPassword(""); return; }
      showSubmissionError(safeSubmissionMessage(submissionError, isRegister ? "Pendaftaran belum berhasil. Periksa data Anda." : "Email atau password tidak cocok."));
    }
  };

  const handleGoogle = async () => {
    setOauthError(null);
    try { await signInGoogle(portal); }
    catch {
      setOauthError("Login Google belum berhasil. Periksa koneksi lalu coba lagi.");
    }
  };

  if (verificationEmail) return <EmailVerification email={verificationEmail} onBack={() => { setVerificationEmail(""); navigate(portalPaths[portal].login); }} onVerified={() => { setVerificationEmail(""); setVerified(true); navigate(portalPaths[portal].login, { replace: true, state: { emailVerified: true } }); }} />;
  return (
    <form className="auth-form" noValidate onSubmit={handleSubmit}>
      {verified && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">Email berhasil diverifikasi. Silakan masuk dengan password kamu.</p>}
      {isRegister && <motion.label animate={fieldErrors.name && !reducedMotion ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }} transition={{ duration: .38 }}>Nama lengkap<input value={name} onChange={(event) => { setName(event.target.value); clearFieldError("name"); }} placeholder="Nama Anda" autoComplete="name" required aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "name-error" : undefined} />{fieldErrors.name && <span id="name-error" className="auth-field-error" role="alert">{fieldErrors.name}</span>}</motion.label>}
      <motion.label animate={fieldErrors.email && !reducedMotion ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }} transition={{ duration: .38 }}>Email<input value={email} onChange={(event) => { setEmail(event.target.value); clearFieldError("email"); }} placeholder="nama@email.com" type="email" autoComplete="email" required aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "email-error" : undefined} />{fieldErrors.email && <span id="email-error" className="auth-field-error" role="alert">{fieldErrors.email}</span>}</motion.label>
      <motion.label animate={fieldErrors.password && !reducedMotion ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }} transition={{ duration: .38 }}>Password<input value={password} onChange={(event) => { setPassword(event.target.value); clearFieldError("password"); }} placeholder="Minimal 8 karakter" type="password" autoComplete={isRegister ? "new-password" : "current-password"} required aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "password-error" : undefined} />{fieldErrors.password && <span id="password-error" className="auth-field-error" role="alert">{fieldErrors.password}</span>}</motion.label>
      <AuthToast message={oauthError} onDismiss={() => setOauthError(null)} />
      <button className="primary-button" type="submit" disabled={isLoading}>{isLoading ? "Memproses..." : isRegister ? "Buat Akun" : "Masuk ke Dashboard"}</button>
      <div className="auth-divider" aria-hidden="true"><span>atau</span></div>
      <button className="google-button" type="button" disabled={isLoading} onClick={() => void handleGoogle()}><GoogleIcon /> <span>{isRegister ? "Daftar dengan Google" : "Lanjutkan dengan Google"}</span></button>
      {portal === "warga" && <p className="auth-switch">{isRegister ? "Sudah punya akun?" : "Belum punya akun?"}{" "}<Link to={isRegister ? "/login" : "/register"}>{isRegister ? "Masuk" : "Daftar sekarang"}</Link></p>}
    </form>
  );
}
