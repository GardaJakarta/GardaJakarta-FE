import AuthForm from "../components/AuthForm";
import AuthShell from "../components/AuthShell";
import type { AuthPortal } from "../types";
import { Link } from "react-router-dom";

export default function LoginPage({ portal = "warga" }: { portal?: AuthPortal }) {
  const labels = { warga: ["Masuk sebagai warga", "Gunakan akun Anda untuk melanjutkan ke peta informasi keamanan."], polisi: ["Masuk sebagai instansi", "Kelola laporan yang ditugaskan ke unit Anda."], admin: ["Masuk sebagai admin", "Kelola moderasi, data operasional, dan audit Garda Jakarta."] } as const;
  return <AuthShell mode="login" portal={portal} eyebrow="Selamat datang kembali" title={labels[portal][0]} description={labels[portal][1]}>
    <AuthForm mode="login" portal={portal} />
    {portal === "warga" && <p className="portal-links"><span>Portal khusus petugas?</span><Link to="/polisi/login">Masuk sebagai instansi</Link><Link to="/admin/login">Admin</Link></p>}
  </AuthShell>;
}
