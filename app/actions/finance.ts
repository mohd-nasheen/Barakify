"use server";

import { revalidatePath } from "next/cache";
import { createTransaction, deleteTransaction, togglePaid, updateTransaction } from "@/lib/data/transactions";
import { createCategory, deleteCategoryWithReassign, renameCategory } from "@/lib/data/categories";
import { upsertBudget } from "@/lib/data/budgets";
import { ensureMonthStructure } from "@/lib/month-engine";
import type { EntryType } from "@/lib/types";

export async function addTransactionAction(formData: FormData) {
  const today = new Date().toISOString().slice(0, 10);
  const type = (String(formData.get("type") ?? "expense") as EntryType) || "expense";
  const rawMetaCategory = String(formData.get("meta_category") ?? "").trim();
  const selectedMetaCategory = rawMetaCategory === "__new__" ? "" : rawMetaCategory;
  const createdMetaCategory = String(formData.get("meta_category_new") ?? "").trim();
  const explicitNotes = String(formData.get("notes") ?? "").trim();
  const effectiveMetaCategory = createdMetaCategory || selectedMetaCategory || explicitNotes;
  const persistCategory = async (name: string) => {
    if (!name) return;
    try {
      await createCategory({ name, type });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.toLowerCase().includes("duplicate") && !message.toLowerCase().includes("already")) throw error;
    }
  };

  const transactionPayload = {
    type,
    amount: Number(formData.get("amount")),
    category: String(formData.get("category")),
    notes: effectiveMetaCategory,
    transaction_date: String(formData.get("transaction_date") ?? today),
    due_date: String(formData.get("due_date") ?? String(formData.get("transaction_date") ?? today)),
    is_recurring: String(formData.get("is_recurring") ?? "") === "on"
  };

  if (type === "expense") {
    console.log("EXPENSE INSERT", transactionPayload);
  } else {
    console.log("INCOME INSERT", transactionPayload);
  }

  if (type === "expense" && effectiveMetaCategory) {
    await persistCategory(effectiveMetaCategory);
  }

  await createTransaction(transactionPayload);
  revalidatePath("/dashboard");
}

export async function deleteTransactionAction(formData: FormData) {
  await deleteTransaction(String(formData.get("id")));
  revalidatePath("/dashboard");
}

export async function addCategoryAction(formData: FormData) {
  await createCategory({
    name: String(formData.get("name")),
    type: String(formData.get("type")) as EntryType
  });
  revalidatePath("/dashboard");
}

export async function upsertBudgetAction(formData: FormData) {
  await upsertBudget({
    category: String(formData.get("category")),
    monthly_limit: Number(formData.get("monthly_limit"))
  });
  revalidatePath("/dashboard");
}

export async function togglePaidAction(formData: FormData) {
  const id = String(formData.get("id"));
  const isPaid = String(formData.get("is_paid")) === "true";
  await togglePaid(id, isPaid);
  revalidatePath("/dashboard");
}

export async function updateTransactionAction(formData: FormData) {
  const id = String(formData.get("id"));
  const today = new Date().toISOString().slice(0, 10);
  const transactionDate = String(formData.get("transaction_date") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim();
  const updatePayload: Parameters<typeof updateTransaction>[1] = {
    type: String(formData.get("type") ?? "expense") as EntryType,
    amount: Number(formData.get("amount")),
    category: String(formData.get("category")),
    notes: String(formData.get("notes") ?? ""),
    transaction_date: transactionDate || dueDate || today,
    due_date: dueDate || transactionDate || today,
    is_recurring: String(formData.get("is_recurring") ?? "") === "on"
  };
  const paidValue = formData.get("is_paid");
  if (typeof paidValue === "string") {
    updatePayload.is_paid = paidValue === "on" || paidValue === "true";
  }
  await updateTransaction(id, updatePayload);
  revalidatePath("/dashboard");
}

export async function ensureMonthStructureAction(formData: FormData) {
  const month = String(formData.get("month") ?? "");
  if (!/^\d{4}-\d{2}$/.test(month)) return;
  await ensureMonthStructure(month);
  revalidatePath("/dashboard");
}

export async function renameCategoryAction(formData: FormData) {
  await renameCategory({
    type: String(formData.get("type")) as EntryType,
    from: String(formData.get("from")),
    to: String(formData.get("to"))
  });
  revalidatePath("/dashboard");
}

export async function deleteCategoryAction(formData: FormData) {
  await deleteCategoryWithReassign({
    type: String(formData.get("type")) as EntryType,
    name: String(formData.get("name")),
    reassignTo: "Uncategorized"
  });
  revalidatePath("/dashboard");
}
