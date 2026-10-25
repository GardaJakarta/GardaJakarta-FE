import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import type { AuthPortal } from "../types";
import { portalPaths } from "../lib/portals";
import GoogleIcon from "./GoogleIcon";

export default function AuthForm({ mode, portal = "warga" }: { mode: "login" | "register"; portal?: AuthPortal }) {
  const navigate = useNavigate();
  const { signIn, signUp, signInGoogle, isLoading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() => {
    const oauthError = new URLSearchParams(window.location.search).get("error");
    if (!oauthError) return null;
    return oauthError === "account_not_linked"
      ? "Masuk dengan password Anda, lalu tautkan Google dari halaman akun."
      : "Login Google belum berhasil. Silakan coba lagi.";
  });
  const isRegister = mode === "register";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (isRegister && name.trim().length < 2) {
      setError("Nama minimal terdiri dari 2 karakter.");
      return;
    }
    if (password.length < 8) {
      setError("Password minimal terdiri dari 8 karakter.");
      return;
    }
    try {
      if (isRegister) await signUp(name.trim(), email.trim(), password);
      else await signIn(email.trim(), password, portal);
      navigate(portalPaths[portal].home);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Gagal memproses permintaan.");
    }
  };

  const handleGoogle = async () => {
    setError(null);
    try { await signInGoogle(portal); }
    catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Login Google belum berhasil.");
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {isRegister && <label>Nama lengkap<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama Anda" autoComplete="name" required /></label>}
      <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" type="email" autoComplete="email" required /></label>
      <label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimal 8 karakter" type="password" autoComplete={isRegister ? "new-password" : "current-password"} required /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" type="submit" disabled={isLoading}>{isLoading ? "Memproses..." : isRegister ? "Buat Akun" : portal === "warga" ? "Masuk ke Peta" : "Masuk ke Portal"}</button>
      <div className="auth-divider" aria-hidden="true"><span>atau</span></div>
      <button className="google-button" type="button" disabled={isLoading} onClick={() => void handleGoogle()}><GoogleIcon /> <span>Lanjutkan dengan Google</span></button>
      {portal === "warga" && <p className="auth-switch">{isRegister ? "Sudah punya akun?" : "Belum punya akun?"}{" "}<Link to={isRegister ? "/login" : "/register"}>{isRegister ? "Masuk" : "Daftar sekarang"}</Link></p>}
    </form>
  );
}
