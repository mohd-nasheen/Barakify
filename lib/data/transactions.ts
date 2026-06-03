import { createClient } from "@/lib/supabase/server";
import type { Transaction, EntryType } from "@/lib/types";

function isMissingParityColumn(message: string) {
  return message.includes("due_date") || message.includes("is_recurring") || message.includes("is_paid") || message.includes("paid_at");
}

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

export async function listTransactions(): Promise<Transaction[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("transaction_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createTransaction(input: {
  type: EntryType;
  amount: number;
  category: string;
  notes?: string;
  transaction_date: string;
  due_date?: string;
  is_recurring?: boolean;
  is_paid?: boolean;
}) {
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) throw new Error("Unauthorized");

  const payload = {
    user_id: userData.user.id,
    type: input.type,
    amount: input.amount,
    category: input.category,
    notes: input.notes ?? null,
    transaction_date: input.transaction_date,
    due_date: input.due_date ?? null,
    is_recurring: input.is_recurring ?? false,
    is_paid: input.is_paid ?? false
  };

  console.log("TRANSACTION INSERT", payload);

  const { error } = await supabase.from("transactions").insert(payload);
  if (!error) return;
  logDbError("transactions", payload, error);

  // Backward compatibility: if parity columns are not migrated yet,
  // retry with base schema so income/expense entry still works.
  const missingParityColumn = isMissingParityColumn(error.message);
  if (missingParityColumn) {
    const fallbackPayload = {
      user_id: userData.user.id,
      type: input.type,
      amount: input.amount,
      category: input.category,
      notes: input.notes ?? null,
      transaction_date: input.transaction_date
    };
    console.log("TRANSACTION INSERT FALLBACK", fallbackPayload);
    const { error: fallbackError } = await supabase.from("transactions").insert(fallbackPayload);
    if (!fallbackError) return;
    logDbError("transactions", fallbackPayload, fallbackError);
    throw fallbackError;
  }

  throw error;
}

export async function deleteTransaction(id: string) {
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", userData.user.id)
    .select("id");

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Delete failed: row not found or not authorized");
  }
}

export async function togglePaid(id: string, isPaid: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ is_paid: isPaid, paid_at: isPaid ? new Date().toISOString() : null })
    .eq("id", id);
  if (!error) return;
  if (isMissingParityColumn(error.message)) return;
  throw error;
}

export async function updateTransaction(
  id: string,
  input: Partial<Pick<Transaction, "type" | "amount" | "category" | "notes" | "transaction_date" | "due_date" | "is_recurring" | "is_paid">>
) {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").update(input).eq("id", id);
  if (!error) return;
  if (!isMissingParityColumn(error.message)) throw error;

  const fallbackInput = { ...input };
  delete fallbackInput.due_date;
  delete fallbackInput.is_recurring;
  delete fallbackInput.is_paid;
  const { error: fallbackError } = await supabase.from("transactions").update(fallbackInput).eq("id", id);
  if (fallbackError) throw fallbackError;
}
