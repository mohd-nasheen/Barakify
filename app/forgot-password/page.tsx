import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { forgotPasswordAction } from "@/app/actions/auth";

export default function ForgotPasswordPage() {
  return (
    <div className="stack">
      <AuthForm title="Forgot Password" action={forgotPasswordAction} submitLabel="Send Reset Link" includePassword={false} />
      <Link href="/login" className="muted">
        Back to login
      </Link>
    </div>
  );
}
