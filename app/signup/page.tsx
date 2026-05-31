import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { signUpAction } from "@/app/actions/auth";

export default function SignupPage() {
  return (
    <div className="stack">
      <AuthForm title="Sign up" action={signUpAction} submitLabel="Create Account" />
      <Link href="/login" className="muted">
        Already have an account? Login
      </Link>
    </div>
  );
}
