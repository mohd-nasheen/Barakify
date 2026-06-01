"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function loginAction(_: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function forgotPasswordAction(_: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`
  });
  if (error) return { error: error.message };
  return { success: "Password reset email sent." };
}

export async function resetPasswordAction(_: unknown, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const isSessionMissing = error.message.toLowerCase().includes("auth session missing");
    return { error: error.message, needsResend: isSessionMissing };
  }
  return { success: "Password updated. You can login now." };
}

export async function resendResetEmailAction(_: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Please enter your email address." };

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`
  });
  if (error) return { error: error.message };
  return { success: "Reset email resent. Please open the latest email link." };
}
