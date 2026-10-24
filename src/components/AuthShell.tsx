import { motion } from "motion/react";
import type { ReactNode } from "react";

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
  return (
    <main className="auth-page">
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      <section className="auth-panel auth-panel-brand">
        <div className="brand-mark" aria-hidden="true">G</div>
        <p className="brand-kicker">Garda Jakarta</p>
        <h1>Smart City,<br /><span>Safe City.</span></h1>
        <p className="brand-copy">Kenali situasi di sekitar Anda, pahami konteksnya, dan ikut menjaga Jakarta bersama.</p>
        <img
          className="auth-illustration"
          src="https://cdn.undraw.co/illustration/small-village_2gpn.svg"
          alt="Ilustrasi lingkungan kota"
        />
        <div className="brand-grid" aria-hidden="true"><span>01</span><span>02</span><span>03</span></div>
      </section>
      <motion.section
        className="auth-panel auth-panel-form"
        initial={{ opacity: 0, y: 18 }}
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
