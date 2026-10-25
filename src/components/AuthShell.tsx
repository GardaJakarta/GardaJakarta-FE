import { motion, useReducedMotion } from "motion/react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import AppLogo from "./branding/AppLogo";
import type { AuthPortal } from "../types";

function PortalIcon({ kind }: { kind: "admin" | "police" }) {
  return kind === "admin"
    ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 19 6v5.2c0 4.3-2.8 7.5-7 9.3-4.2-1.8-7-5-7-9.3V6l7-2.5Z" /><path d="M9 11h6M12 8v6" /></svg>
    : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 19 6v5.2c0 4.3-2.8 7.5-7 9.3-4.2-1.8-7-5-7-9.3V6l7-2.5Z" /><path d="M8.5 10h7v5h-7zM7.5 9h9" /></svg>;
}

export default function AuthShell({
  mode,
  eyebrow,
  title,
  description,
  portal = "warga",
  children,
}: {
  mode: "login" | "register";
  eyebrow: string;
  title: string;
  description: string;
  portal?: AuthPortal;
  children: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  if (portal !== "warga") {
    return (
      <main className="auth-staff-page">
        <section className="auth-staff-shell">
          <a className="auth-staff-brand" href="https://gardajakarta.my.id" aria-label="Beranda Garda Jakarta">
            <AppLogo size={156} aria-label="Garda Jakarta" />
          </a>
          <div className="auth-staff-heading">
            <p className="eyebrow">Portal Mitra Garda Jakarta</p>
            <h1>Akses Petugas &amp; Instansi</h1>
            <div className="auth-portal-switch" aria-label="Pilih portal">
              <Link className={portal === "admin" ? "is-active" : ""} to="/admin/login"><span className="portal-switch-icon"><PortalIcon kind="admin" /></span>Admin</Link>
              <Link className={portal === "polisi" ? "is-active" : ""} to="/polisi/login"><span className="portal-switch-icon"><PortalIcon kind="police" /></span>Instansi</Link>
            </div>
          </div>
          <motion.div
            className="auth-staff-form"
            initial={reducedMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </section>
      </main>
    );
  }
  return (
    <main className={`auth-page auth-page-${mode}`}>
      <section className="auth-panel auth-panel-brand">
        <img className="auth-banner" src="/banner.png" alt="Garda Jakarta" />
      </section>
      <motion.section
        className="auth-panel auth-panel-form"
        initial={reducedMotion ? false : { opacity: 0, x: mode === "login" ? 28 : -28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="auth-form-wrap">
          <a className="auth-form-brand" href="https://gardajakarta.my.id" aria-label="Beranda Garda Jakarta">
            <AppLogo size={156} aria-label="Garda Jakarta" />
          </a>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p className="form-description">{description}</p>
          {children}
        </div>
      </motion.section>
    </main>
  );
}
