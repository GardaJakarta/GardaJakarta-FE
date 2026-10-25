import AuthForm from "../components/AuthForm";
import AuthShell from "../components/AuthShell";

export default function RegisterPage() {
  return <AuthShell mode="register" eyebrow="Mulai berkontribusi" title="Buat akun Garda Jakarta" description="Satu akun untuk memantau situasi dan berkontribusi pada lingkungan yang lebih aman."><AuthForm mode="register" /></AuthShell>;
}
