import AuthForm from "../components/AuthForm";
import AuthShell from "../components/AuthShell";

export default function RegisterPage() {
  return <AuthShell mode="register" portal="warga" eyebrow="Mulai berkontribusi" title="Daftar sebagai warga" description="Satu akun untuk memantau situasi dan berkontribusi pada lingkungan yang lebih aman."><AuthForm mode="register" /></AuthShell>;
}
