import AuthForm from "../components/AuthForm";
import AuthShell from "../components/AuthShell";
import type { AuthPortal } from "../types";
import { Link } from "react-router-dom";

export default function LoginPage({ portal = "warga" }: { portal?: AuthPortal }) {
  const labels = { warga: ["Masuk sebagai warga", "Gunakan akun Anda untuk melanjutkan ke peta informasi keamanan."], polisi: ["Portal petugas polisi", "Kelola laporan yang ditugaskan ke unit Anda."], admin: ["Portal admin", "Kelola moderasi, data operasional, dan audit Garda Jakarta."] } as const;
  return <AuthShell eyebrow="Selamat datang kembali" title={labels[portal][0]} description={labels[portal][1]}>
    <AuthForm mode="login" portal={portal} />
    {portal === "warga" && <nav className="portal-links" aria-label="Portal login lainnya">
      <span>Masuk sebagai</span>
      <Link to="/polisi/login">Petugas polisi</Link>
      <Link to="/admin/login">Admin</Link>
    </nav>}
  </AuthShell>;
}
