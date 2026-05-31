import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { loginAction } from "@/app/actions/auth";

export default function LoginPage() {
  return (
    <div className="stack">
      <AuthForm title="Login" action={loginAction} submitLabel="Login" />
      <div className="row">
        <Link href="/signup" className="muted">
          Create account
        </Link>
        <Link href="/forgot-password" className="muted">
          Forgot password
        </Link>
      </div>
    </div>
  );
}
