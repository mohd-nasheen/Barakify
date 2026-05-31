"use client";

import { useActionState } from "react";
import { resendResetEmailAction, resetPasswordAction } from "@/app/actions/auth";

export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, undefined);
  const [resendState, resendAction, resendPending] = useActionState(resendResetEmailAction, undefined);
  const showResend = Boolean((state as { needsResend?: boolean } | undefined)?.needsResend);

  return (
    <div className="stack">
      <form action={formAction} className="card stack">
        <h1>Reset Password</h1>
        <input name="password" type="password" required placeholder="New password" />
        <button className="button" type="submit" disabled={pending}>
          {pending ? "Updating..." : "Update password"}
        </button>
        {"error" in (state ?? {}) ? <p className="status error">{state?.error}</p> : null}
        {"success" in (state ?? {}) ? <p className="status success">{state?.success}</p> : null}
      </form>

      {showResend ? (
        <form action={resendAction} className="card stack">
          <h2>Session expired?</h2>
          <p className="muted">Enter your email to receive a fresh password reset link.</p>
          <input name="email" type="email" required placeholder="Email address" autoComplete="email" />
          <button className="button ghost" type="submit" disabled={resendPending}>
            {resendPending ? "Sending..." : "Resend reset email"}
          </button>
          {"error" in (resendState ?? {}) ? <p className="status error">{resendState?.error}</p> : null}
          {"success" in (resendState ?? {}) ? <p className="status success">{resendState?.success}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
