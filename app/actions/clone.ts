"use server";

import { revalidatePath } from "next/cache";
import { cloneMonth } from "@/lib/month-engine";

export async function cloneMonthAction(formData: FormData): Promise<{ ok: boolean; error?: string; targetMonth?: string }> {
  const sourceMonth = String(formData.get("source_month") ?? "");
  if (!/^\d{4}-\d{2}$/.test(sourceMonth)) {
    return { ok: false, error: "invalid_month" };
  }
  const result = await cloneMonth(sourceMonth);
  if (result.error) {
    return { ok: false, error: result.error };
  }
  revalidatePath("/dashboard");
  return { ok: true, targetMonth: result.targetMonth };
}
