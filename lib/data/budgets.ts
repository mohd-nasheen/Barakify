import { createClient } from "@/lib/supabase/server";
import type { Budget } from "@/lib/types";

export async function listBudgets(): Promise<Budget[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("budgets").select("*").order("category", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function upsertBudget(input: { category: string; monthly_limit: number }) {
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) throw new Error("Unauthorized");

  const { error } = await supabase.from("budgets").upsert(
    { user_id: userData.user.id, category: input.category, monthly_limit: input.monthly_limit },
    { onConflict: "user_id,category" }
  );
  if (error) throw error;
}
