import { createClient } from "@/lib/supabase/server";
import type { Category, EntryType } from "@/lib/types";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "@/lib/default-data";

function logDbError(table: string, payload: unknown, error: { code?: string; message?: string; details?: string; hint?: string } | null) {
  console.error("INSERT ERROR", {
    table,
    payload,
    code: error?.code ?? null,
    message: error?.message ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
    full: error ?? null
  });
}

export async function listCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").select("*").order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createCategory(input: { name: string; type: EntryType }) {
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) throw new Error("Unauthorized");
  const payload = {
    user_id: userData.user.id,
    name: input.name,
    type: input.type
  };
  console.log("CATEGORY UPSERT", payload);
  const { error } = await supabase.from("categories").upsert(payload, {
    onConflict: "user_id,name,type",
    ignoreDuplicates: true
  });
  if (error) logDbError("categories", payload, error);
  if (error) throw error;
}

export async function ensureDefaultCategories() {
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return;
  const userId = userData.user.id;

  // Seed defaults only for first-time users. Do not recreate categories
  // the user intentionally deleted later.
  const { count, error: countError } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (countError) throw countError;
  if ((count ?? 0) > 0) return;

  const rows = [
    ...DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ user_id: userId, name, type: "expense" as const })),
    ...DEFAULT_INCOME_CATEGORIES.map((name) => ({ user_id: userId, name, type: "income" as const }))
  ];

  const { error } = await supabase.from("categories").upsert(rows, { onConflict: "user_id,name,type", ignoreDuplicates: true });
  if (error) throw error;
}

export async function renameCategory(input: { type: EntryType; from: string; to: string }) {
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) throw new Error("Unauthorized");
  const userId = userData.user.id;

  const from = input.from.trim();
  const to = input.to.trim();
  if (!from || !to || from === to) return;

  // 1) Update ALL transactions that reference the old category metadata.
  const { error: txNotesError } = await supabase
    .from("transactions")
    .update({ notes: to })
    .eq("user_id", userId)
    .eq("type", input.type)
    .eq("notes", from);
  if (txNotesError) throw txNotesError;

  // 2) Also update legacy rows where category itself stored the category value.
  const { error: txCategoryError } = await supabase
    .from("transactions")
    .update({ category: to })
    .eq("user_id", userId)
    .eq("type", input.type)
    .eq("category", from);
  if (txCategoryError) throw txCategoryError;

  // 3) Rename category record in-place when possible (true rename).
  const { data: existingTarget, error: existingTargetError } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("type", input.type)
    .eq("name", to)
    .limit(1);
  if (existingTargetError) throw existingTargetError;

  if ((existingTarget ?? []).length === 0) {
    const { error: renameError } = await supabase
      .from("categories")
      .update({ name: to })
      .eq("user_id", userId)
      .eq("type", input.type)
      .eq("name", from);
    if (renameError) throw renameError;
  } else {
    // Target already exists: remove only the old category record to prevent duplicates.
    const { error: deleteOldError } = await supabase
      .from("categories")
      .delete()
      .eq("user_id", userId)
      .eq("type", input.type)
      .eq("name", from);
    if (deleteOldError) throw deleteOldError;
  }
}

export async function deleteCategoryWithReassign(input: { type: EntryType; name: string; reassignTo: string }) {
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) throw new Error("Unauthorized");
  const userId = userData.user.id;
  if (!input.name.trim()) return;
  const deletingName = input.name.trim();
  const fallbackName = input.reassignTo.trim() || "Uncategorized";
  const target = deletingName.toLowerCase() === "uncategorized" ? null : fallbackName;
  console.log("DELETE CATEGORY", deletingName);
  if (target && target !== deletingName) {
    const { error: upsertError } = await supabase.from("categories").upsert(
      [{ user_id: userId, name: target, type: input.type }],
      { onConflict: "user_id,name,type", ignoreDuplicates: true }
    );
    if (upsertError) throw upsertError;
  }

  const { error: txError } = await supabase
    .from("transactions")
    .update({ notes: target })
    .eq("user_id", userId)
    .eq("type", input.type)
    .eq("notes", deletingName);
  if (txError) throw txError;

  const { data: deletedRows, error: deleteError } = await supabase
    .from("categories")
    .delete()
    .select("id,name")
    .eq("user_id", userId)
    .eq("type", input.type)
    .eq("name", deletingName);
  console.log("DELETE RESULT", {
    category: deletingName,
    affectedRows: deletedRows?.length ?? 0,
    rows: deletedRows ?? null
  });
  if (deleteError) throw deleteError;

  const { data: categoriesAfterDelete, error: verifyError } = await supabase
    .from("categories")
    .select("id,name,type")
    .eq("user_id", userId)
    .eq("type", input.type)
    .eq("name", deletingName);
  if (verifyError) throw verifyError;
  console.log("CATEGORIES AFTER DELETE", categoriesAfterDelete ?? []);
}
