"use client";

import { useActionState } from "react";

type ActionState = { error?: string; success?: string } | void;

export function AuthForm({
  title,
  action,
  submitLabel,
  includeName = false,
  includePassword = true
}: {
  title: string;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  includeName?: boolean;
  includePassword?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="card stack">
      <h1>{title}</h1>
      {includeName ? <input name="name" placeholder="Name" autoComplete="name" /> : null}
      <input name="email" type="email" required placeholder="Email" autoComplete="email" />
      {includePassword ? <input name="password" type="password" required placeholder="Password" autoComplete="current-password" /> : null}
      <button className="button" disabled={pending} type="submit">
        {pending ? "Please wait..." : submitLabel}
      </button>
      {"error" in (state ?? {}) ? <p className="status error">{state?.error}</p> : null}
      {"success" in (state ?? {}) ? <p className="status success">{state?.success}</p> : null}
    </form>
  );
}
