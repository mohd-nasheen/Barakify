import { createClient } from "@/lib/supabase/server";
function isMissingParityColumn(message: string) {
  return message.includes("due_date") || message.includes("is_recurring") || message.includes("is_paid") || message.includes("paid_at");
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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

export async function ensureMonthStructure(month: string) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return;
  if (!/^\d{4}-\d{2}$/.test(month)) return;
  const userId = authData.user.id;

  const { start: targetStart, end: targetEnd } = monthBounds(month);
  const previousMonthStart = firstDay(new Date(targetStart.getFullYear(), targetStart.getMonth() - 1, 1));
  const previousMonthEnd = lastDay(previousMonthStart);

  const { data: targetMonthItems, error: targetError } = await supabase
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .gte("transaction_date", targetStart.toISOString().slice(0, 10))
    .lte("transaction_date", targetEnd.toISOString().slice(0, 10))
    .limit(1);
  if (targetError || (targetMonthItems ?? []).length > 0) return;

  const { data: previousMonthRows, error: prevError } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .gte("transaction_date", previousMonthStart.toISOString().slice(0, 10))
    .lte("transaction_date", previousMonthEnd.toISOString().slice(0, 10));
  if (prevError || !previousMonthRows?.length) return;

  const cloned = previousMonthRows.map((t) => {
    const originalDate = new Date(t.transaction_date);
    const day = originalDate.getDate();
    const monthLast = lastDay(targetStart).getDate();
    const safeDay = Math.min(day, monthLast);
    const clonedDate = new Date(targetStart.getFullYear(), targetStart.getMonth(), safeDay);
    return {
      user_id: userId,
      type: t.type,
      amount: 0,
      category: t.category,
      notes: t.notes,
      transaction_date: clonedDate.toISOString().slice(0, 10),
      due_date: clonedDate.toISOString().slice(0, 10),
      is_paid: false,
      paid_at: null,
      is_recurring: t.is_recurring ?? true
    };
  });

  const dedupeKey = (t: { type: string; category: string; transaction_date: string }) =>
    `${monthKey(new Date(t.transaction_date))}|${t.type}|${t.category}`;

  const seen = new Set<string>();
  const deduped = cloned.filter((t) => {
    const key = dedupeKey(t);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (!deduped.length) return;
  const { error: insertError } = await supabase.from("transactions").insert(deduped);
  if (!insertError) return;
  if (!isMissingParityColumn(insertError.message)) return;

  const baseDeduped = deduped.map((row) => ({
    user_id: row.user_id,
    type: row.type,
    amount: row.amount,
    category: row.category,
    notes: row.notes,
    transaction_date: row.transaction_date
  }));
  await supabase.from("transactions").insert(baseDeduped);
}

export async function ensureCurrentMonthFromRecurring() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return;
  const now = new Date();
  await ensureMonthStructure(monthKey(now));
}

export async function cloneNextMonthFromRecurring(sourceMonth: string) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return;
  const userId = authData.user.id;

  const { start: sourceStart, end: sourceEnd } = monthBounds(sourceMonth);
  const targetStart = firstDay(new Date(sourceStart.getFullYear(), sourceStart.getMonth() + 1, 1));
  const targetEnd = lastDay(targetStart);

  const { data: sourceRecurring, error: sourceError } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .eq("is_recurring", true)
    .gte("transaction_date", sourceStart.toISOString().slice(0, 10))
    .lte("transaction_date", sourceEnd.toISOString().slice(0, 10));
  if (sourceError || !sourceRecurring?.length) return;

  const { data: targetRows, error: targetError } = await supabase
    .from("transactions")
    .select("type, category, amount, transaction_date")
    .eq("user_id", userId)
    .gte("transaction_date", targetStart.toISOString().slice(0, 10))
    .lte("transaction_date", targetEnd.toISOString().slice(0, 10));
  if (targetError) return;

  const existing = new Set(
    (targetRows ?? []).map((t) => `${monthKey(new Date(t.transaction_date))}|${t.type}|${t.category}|${t.amount}`)
  );

  const cloned = sourceRecurring
    .map((t) => {
      const sourceDate = new Date(t.transaction_date);
      const safeDay = Math.min(sourceDate.getDate(), lastDay(targetStart).getDate());
      const clonedDate = new Date(targetStart.getFullYear(), targetStart.getMonth(), safeDay);
      return {
        user_id: userId,
        type: t.type,
        amount: t.amount,
        category: t.category,
        notes: t.notes,
        transaction_date: clonedDate.toISOString().slice(0, 10),
        due_date: clonedDate.toISOString().slice(0, 10),
        is_paid: false,
        paid_at: null,
        is_recurring: true
      };
    })
    .filter((t) => !existing.has(`${monthKey(new Date(t.transaction_date))}|${t.type}|${t.category}|${t.amount}`));

  if (!cloned.length) return;
  await supabase.from("transactions").insert(cloned);
}
