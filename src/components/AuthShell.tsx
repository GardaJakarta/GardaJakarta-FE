import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import AppLogoWhite from "./branding/AppLogoWhite";

export default function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <main className="auth-page">
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      <section className="auth-panel auth-panel-brand">
        <a className="auth-brand" href="https://gardajakarta.my.id" aria-label="Beranda Garda Jakarta">
          <AppLogoWhite size={186} aria-label="Garda Jakarta" />
        </a>
        <h1>Bersama Wujudkan Jakarta yang <span>Lebih Aman.</span></h1>
        <p className="brand-copy">Kenali situasi di sekitar Anda, pahami konteksnya, dan ikut menjaga Jakarta bersama.</p>
        <img
          className="auth-illustration"
          src="/illustrations/small-village.svg"
          alt="Ilustrasi lingkungan kota"
        />
      </section>
      <motion.section
        className="auth-panel auth-panel-form"
        initial={reducedMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="auth-form-wrap">
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p className="form-description">{description}</p>
          {children}
        </div>
      </motion.section>
    </main>
  );
}
