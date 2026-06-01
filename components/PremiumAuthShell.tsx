"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useActionState, useState } from "react";

type ActionState = { error?: string; success?: string } | void;

type PremiumAuthShellProps = {
  mode: "login" | "forgot";
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
};

const featureItems = [
  "Expense completion tracking",
  "Monthly financial planning",
  "Secure cloud sync",
  "Private account data",
  "Multi-device access"
];

export function PremiumAuthShell({ mode, action }: PremiumAuthShellProps) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const isLogin = mode === "login";
  const title = isLogin ? "Welcome Back" : "Forgot Password";
  const helper = isLogin ? "Sign in to continue to your workspace." : "Enter your email and we will send you a reset link.";
  const submitLabel = isLogin ? "Login" : "Send Reset Link";
  const success = "success" in (state ?? {}) ? state?.success : undefined;

  return (
    <section
      className="auth-page"
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width;
        const py = (event.clientY - rect.top) / rect.height;
        setTilt({ x: (px - 0.5) * 2, y: (py - 0.5) * 2 });
      }}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
    >
      <motion.div
        className="auth-bg-motion"
        animate={{ x: tilt.x * 12, y: tilt.y * 12 }}
        transition={{ type: "spring", stiffness: 28, damping: 22 }}
      />
      <div className="auth-bg-noise" />
      <div className="auth-layout">
        <motion.aside
          className="auth-hero"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0, x: tilt.x * 4, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="auth-wordmark">Barakify</div>
          <h1>
            Personal finance,
            <br />
            simplified.
          </h1>
          <p>
            Track obligations, income, expenses, and monthly progress from a single source of truth.
          </p>

          <ul className="auth-features" aria-label="Product highlights">
            {featureItems.map((item, idx) => (
              <motion.li
                key={item}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + idx * 0.08 }}
              >
                <span aria-hidden>●</span>
                {item}
              </motion.li>
            ))}
          </ul>
        </motion.aside>

        <motion.div
          className="auth-panel-wrap"
          initial={{ opacity: 0, scale: 0.98, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0, x: tilt.x * 8 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <form action={formAction} className="auth-panel" noValidate>
            <h2>{title}</h2>
            <p className="auth-helper">{helper}</p>

            <label className="auth-field">
              <span>Email</span>
              <input name="email" type="email" required autoComplete="email" placeholder="you@company.com" />
            </label>

            {isLogin ? (
              <label className="auth-field">
                <span>Password</span>
                <input name="password" type="password" required autoComplete="current-password" placeholder="Enter password" />
              </label>
            ) : null}

            {isLogin ? (
              <Link href="/forgot-password" className="auth-link">
                Forgot Password
              </Link>
            ) : (
              <Link href="/login" className="auth-link">
                Back to Login
              </Link>
            )}

            <motion.button
              className={`auth-submit ${success ? "is-success" : ""}`}
              type="submit"
              disabled={pending}
              whileHover={{ y: -2, boxShadow: "0 16px 38px rgba(79,140,255,.46)" }}
              whileTap={{ scale: 0.98, y: 0 }}
            >
              {pending ? "Please wait..." : success ? "Done" : submitLabel}
            </motion.button>

            {"error" in (state ?? {}) ? <p className="status error">{state?.error}</p> : null}
            {"success" in (state ?? {}) ? <p className="status success">{state?.success}</p> : null}
          </form>
        </motion.div>
      </div>
    </section>
  );
}
