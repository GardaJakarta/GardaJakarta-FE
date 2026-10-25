import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";

export default function AuthToast({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(onDismiss, 6500);
    return () => window.clearTimeout(timeout);
  }, [message, onDismiss]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          className="auth-toast auth-toast-error"
          role="alert"
          aria-live="assertive"
          initial={{ opacity: 0, y: -14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="auth-toast-icon" aria-hidden="true">!</span>
          <div className="auth-toast-copy">
            <strong>Belum berhasil</strong>
            <p>{message}</p>
          </div>
          <button className="auth-toast-close" type="button" onClick={onDismiss} aria-label="Tutup notifikasi">
            <span aria-hidden="true">&times;</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
