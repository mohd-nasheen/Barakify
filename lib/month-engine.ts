import { createClient } from "@/lib/supabase/server";

// Pure-JS deterministic hash — avoids node:crypto so this module loads cleanly
// in all Next.js webpack contexts when imported by "use server" action files.
function djb2(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0;
  }
  return h;
}

function isMissingParityColumn(message: string) {
  return message.includes("due_date") || message.includes("is_recurring") || message.includes("is_paid") || message.includes("paid_at");
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function localDateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function firstDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function lastDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function monthBounds(month: string) {
  const [year, mm] = month.split("-").map(Number);
  const start = new Date(year, mm - 1, 1);
  const end = lastDay(start);
  return { start, end };
}

function stableCloneId(sourceId: string, targetMonth: string): string {
  const key = `${sourceId}:${targetMonth}`;
  const h = [key, key + "\x01", key + "\x02", key + "\x03"]
    .map(djb2)
    .map(n => n.toString(16).padStart(8, "0"))
    .join(""); // 32 hex chars
  const variant = ((parseInt(h[15], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(12,15)}-${variant}${h.slice(16,19)}-${h.slice(20,32)}`;
}

function rowSignature(row: { type: string; category: string; notes: string | null; transaction_date: string; due_date: string | null; amount: number }) {
  return [row.type, row.category, row.notes ?? "", row.transaction_date, row.due_date ?? "", String(row.amount)].join("|");
}

// Performs deduplication cleanup only. No longer auto-clones from prior months.
export async function ensureMonthStructure(month: string) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return;
  if (!/^\d{4}-\d{2}$/.test(month)) return;
  const userId = authData.user.id;

  const { start: targetStart, end: targetEnd } = monthBounds(month);

  const { data: targetMonthItems, error: targetError } = await supabase
    .from("transactions")
    .select("id,type,amount,category,notes,transaction_date,due_date,created_at")
    .eq("user_id", userId)
    .gte("transaction_date", localDateStr(targetStart))
    .lte("transaction_date", localDateStr(targetEnd))
    .order("created_at", { ascending: true });
  if (targetError) return;

  // De-duplicate exact duplicates while preserving first-created row.
  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  for (const row of targetMonthItems ?? []) {
    const key = rowSignature(row);
    if (seen.has(key)) duplicateIds.push(row.id);
    else seen.add(key);
  }
  console.log("[ENSURE] month:", month, "total rows:", targetMonthItems?.length, "duplicates:", duplicateIds.length);
  if (duplicateIds.length > 0) {
    console.log("[ENSURE] deleting duplicate IDs:", duplicateIds);
    await supabase.from("transactions").delete().in("id", duplicateIds);
  }
}

// No longer auto-clones on load. Left as no-op for import compatibility.
export async function ensureCurrentMonthFromRecurring() {}

// Clones sourceMonth's income + expense rows to the following month.
// Returns { ok: true } on success, { error: string } on failure.
export async function cloneMonth(sourceMonth: string): Promise<{ ok?: boolean; error?: string; targetMonth?: string }> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return { error: "unauthenticated" };
  if (!/^\d{4}-\d{2}$/.test(sourceMonth)) return { error: "invalid_month" };

  const userId = authData.user.id;
  const { start: sourceStart, end: sourceEnd } = monthBounds(sourceMonth);
  const targetStart = firstDay(new Date(sourceStart.getFullYear(), sourceStart.getMonth() + 1, 1));
  const targetEnd = lastDay(targetStart);
  const targetMonth = monthKey(targetStart);

  // Delete any existing destination month data so clone always succeeds.
  await supabase
    .from("transactions")
    .delete()
    .eq("user_id", userId)
    .gte("transaction_date", localDateStr(targetStart))
    .lte("transaction_date", localDateStr(targetEnd));

  const { data: sourceRows, error: sourceError } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .gte("transaction_date", localDateStr(sourceStart))
    .lte("transaction_date", localDateStr(sourceEnd));

  if (sourceError) return { error: "fetch_error" };
  if (!sourceRows?.length) return { error: "no_source_data" };

  const cloned = sourceRows.map((t) => {
    const day = new Date(t.transaction_date).getDate();
    const safeDay = Math.min(day, lastDay(targetStart).getDate());
    const clonedDate = new Date(targetStart.getFullYear(), targetStart.getMonth(), safeDay);
    return {
      id: stableCloneId(t.id, targetMonth),
      user_id: userId,
      type: t.type,
      amount: t.amount,
      category: t.category,
      notes: t.notes,
      transaction_date: localDateStr(clonedDate),
      due_date: localDateStr(clonedDate),
      is_paid: false,
      paid_at: null,
      is_recurring: t.is_recurring ?? false
    };
  });

  console.log("[CLONE] source:", sourceMonth, "target:", targetMonth);
  console.log("[CLONE] cloned rows:", cloned.length, "sample date:", cloned[0]?.transaction_date);

  const { error: insertError } = await supabase.from("transactions").insert(cloned);
  if (insertError) {
    if (insertError.code === "23505") return { ok: true, targetMonth };
    if (isMissingParityColumn(insertError.message)) {
      const baseRows = cloned.map(({ id, user_id, type, amount, category, notes, transaction_date }) => ({
        id, user_id, type, amount, category, notes, transaction_date
      }));
      const { error: fallback } = await supabase.from("transactions").insert(baseRows);
      if (fallback && fallback.code !== "23505") return { error: fallback.message };
      return { ok: true, targetMonth };
    }
    return { error: insertError.message };
  }
  // Verify rows landed in the target month
  const { data: verifyRows } = await supabase
    .from("transactions")
    .select("id,type,category,amount,transaction_date")
    .eq("user_id", userId)
    .gte("transaction_date", localDateStr(targetStart))
    .lte("transaction_date", localDateStr(targetEnd));
  console.log("[CLONE] verify target month rows:", verifyRows?.length, verifyRows?.map(r => `${r.type}:${r.category}:${r.transaction_date}`));

  return { ok: true, targetMonth };
}
