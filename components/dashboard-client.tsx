"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PieChart, Pie, Cell } from "recharts";
import {
  addCategoryAction,
  addTransactionAction,
  deleteCategoryAction,
  deleteTransactionAction,
  ensureMonthStructureAction,
  renameCategoryAction,
  togglePaidAction,
  updateTransactionAction
} from "@/app/actions/finance";
import { cloneMonthAction } from "@/app/actions/clone";
import type { Category, Transaction } from "@/lib/types";
import { AnimatedCurrency, GlassCard, ProgressRing } from "@/components/parity-ui";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const EXPENSE_CATEGORY_DEFAULTS = ["Credit Card", "Rent", "Savings", "Home", "Gold", "Debt", "Clothing", "Others"];

type RowPatch = { category?: string; amount?: number; notes?: string; is_paid?: boolean };

function createTempId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function nextMonthOf(month: string): string {
  const [year, mm] = month.split("-").map(Number);
  const d = new Date(year, mm, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function DashboardClient({ initialTransactions, categories }: { initialTransactions: Transaction[]; categories: Category[] }) {
  const router = useRouter();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(now.getMonth());
  const [showExpenseComposer, setShowExpenseComposer] = useState(false);
  const [showIncomeComposer, setShowIncomeComposer] = useState(false);
  const [showCategorySettings, setShowCategorySettings] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [composerCategory, setComposerCategory] = useState(EXPENSE_CATEGORY_DEFAULTS[0]);
  const [composerNewCategory, setComposerNewCategory] = useState("");
  const [hoverSlice, setHoverSlice] = useState<string | null>(null);
  const [optimisticRows, setOptimisticRows] = useState<Record<string, RowPatch>>({});
  const [pendingCreateRows, setPendingCreateRows] = useState<Transaction[]>([]);
  const [pendingRows, setPendingRows] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();
  const [savingIncome, setSavingIncome] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [incomeDraft, setIncomeDraft] = useState({ category: "", amount: "" });
  const [expenseDraft, setExpenseDraft] = useState({ category: "", amount: "" });
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);
  const [localCategories, setLocalCategories] = useState<string[]>([]);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; category: string; blocked: boolean }>({
    open: false,
    category: "",
    blocked: false
  });
  const [rowDeleteModal, setRowDeleteModal] = useState<{ open: boolean; row: Transaction | null }>({ open: false, row: null });
  const [deletingCategory, setDeletingCategory] = useState(false);
  const [deletingRow, setDeletingRow] = useState(false);

  const monthRailRef = useRef<HTMLDivElement | null>(null);
  const autosaveTimers = useRef(new Map<string, number>());

  const selectedMonth = `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, "0")}`;
  const nextMonth = useMemo(() => nextMonthOf(selectedMonth), [selectedMonth]);
  const nextMonthLabel = useMemo(() => {
    const [y, m] = nextMonth.split("-").map(Number);
    return `${MONTHS[m - 1]} ${y}`;
  }, [nextMonth]);

  useEffect(() => {
    let cancelled = false;
    const fd = new FormData();
    fd.set("month", selectedMonth);
    (async () => {
      await ensureMonthStructureAction(fd);
      if (!cancelled) startTransition(() => router.refresh());
    })();
    return () => { cancelled = true; };
  }, [selectedMonth, startTransition, router]);

  const mergedRows = useMemo(
    () =>
      [...initialTransactions, ...pendingCreateRows].map((row) => ({
        ...row,
        ...(optimisticRows[row.id] ?? {})
      })),
    [initialTransactions, optimisticRows, pendingCreateRows]
  );

  const monthlyTransactions = useMemo(
    () => mergedRows.filter((t) => monthKey(new Date(t.transaction_date)) === selectedMonth),
    [mergedRows, selectedMonth]
  );
  const expenseRows = monthlyTransactions.filter((t) => t.type === "expense").sort(sortRows);
  const incomeRows = monthlyTransactions.filter((t) => t.type === "income").sort(sortRows);
  const paidExpenseCount = expenseRows.filter((t) => t.is_paid).length;
  const completion = expenseRows.length > 0 ? paidExpenseCount / expenseRows.length : 0;
  const totalIncome = incomeRows.reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = expenseRows.reduce((sum, t) => sum + t.amount, 0);

  // Clone button is disabled only when the current month is completely empty.
  const currentMonthIsEmpty = expenseRows.length === 0 && incomeRows.length === 0;

  const runningBalance = useMemo(() => {
    const monthTotals = mergedRows.reduce<Record<string, { income: number; expense: number }>>((acc, row) => {
      const key = monthKey(new Date(row.transaction_date));
      const bucket = acc[key] ?? { income: 0, expense: 0 };
      if (row.type === "income") bucket.income += row.amount;
      else bucket.expense += row.amount;
      acc[key] = bucket;
      return acc;
    }, {});
    const months = Object.keys(monthTotals).sort();
    let balance = 0;
    for (const month of months) {
      const bucket = monthTotals[month];
      balance += bucket.income - bucket.expense;
      if (month === selectedMonth) return balance;
    }
    return balance;
  }, [mergedRows, selectedMonth]);

  const expenseCategories = useMemo(() => {
    const persisted = categories
      .filter((c) => c.type === "expense")
      .map((c) => c.name)
      .filter((name) => !hiddenCategories.includes(name));
    return Array.from(new Set([...persisted, ...localCategories, "Uncategorized"]));
  }, [categories, hiddenCategories, localCategories]);

  useEffect(() => {
    if (expenseCategories.length === 0) return;
    if (!expenseCategories.includes(composerCategory)) {
      setComposerCategory(expenseCategories[0]);
    }
  }, [expenseCategories, composerCategory]);

  const donutSlices = useMemo(() => {
    const grouped = expenseRows.reduce<Record<string, number>>((acc, row) => {
      const group = rowCategory(row, "expense");
      acc[group] = (acc[group] ?? 0) + row.amount;
      return acc;
    }, {});
    const entries = Object.entries(grouped).filter(([, value]) => value > 0);
    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    let cursor = 0;
    const palette = ["#67E6B8", "#6FAFFF", "#FDCB65", "#F98AA0", "#91E2FF", "#C1A6FF", "#72EAA7", "#A6B5CC"];
    return entries.map(([name, value], index) => {
      const pct = total > 0 ? value / total : 0;
      const start = cursor;
      const end = cursor + pct;
      cursor = end;
      return { name, value, pct, start, end, color: palette[index % palette.length] };
    });
  }, [expenseRows]);

  const centerValue = expenseRows.reduce((sum, row) => sum + row.amount, 0);
  const centerLabel = "Total Expenses";

  async function saveRowPatch(row: Transaction, patch: RowPatch) {
    const next = { ...row, ...patch };
    const formData = new FormData();
    formData.set("id", row.id);
    formData.set("type", next.type);
    formData.set("category", next.category);
    formData.set("amount", String(next.amount ?? 0));
    formData.set("notes", next.notes ?? "");
    formData.set("transaction_date", next.transaction_date.slice(0, 10));
    formData.set("due_date", (next.due_date || next.transaction_date).slice(0, 10));
    if (typeof patch.is_paid === "boolean") formData.set("is_paid", patch.is_paid ? "on" : "");
    setPendingRows((prev) => ({ ...prev, [row.id]: true }));
    try {
      await updateTransactionAction(formData);
    } finally {
      setPendingRows((prev) => ({ ...prev, [row.id]: false }));
    }
  }

  function queueAutoSave(row: Transaction, patch: RowPatch) {
    setOptimisticRows((prev) => ({ ...prev, [row.id]: { ...(prev[row.id] ?? {}), ...patch } }));
    const existing = autosaveTimers.current.get(row.id);
    if (existing) window.clearTimeout(existing);
    const timer = window.setTimeout(() => {
      const merged = { ...row, ...(optimisticRows[row.id] ?? {}), ...patch };
      void saveRowPatch(merged as Transaction, patch);
    }, 360);
    autosaveTimers.current.set(row.id, timer);
  }

  function togglePaidOptimistic(row: Transaction) {
    const nextPaid = !row.is_paid;
    setOptimisticRows((prev) => ({ ...prev, [row.id]: { ...(prev[row.id] ?? {}), is_paid: nextPaid } }));
    startTransition(() => {
      const fd = new FormData();
      fd.set("id", row.id);
      fd.set("is_paid", String(nextPaid));
      void togglePaidAction(fd);
    });
  }

  async function submitIncomeRow(formData: FormData) {
    if (savingIncome) return;
    const tempId = createTempId("temp-income");
    const amount = Number(formData.get("amount") ?? 0);
    const name = String(formData.get("category") ?? "").trim();
    const tempRow: Transaction = {
      id: tempId,
      user_id: "pending",
      type: "income",
      amount: Number.isFinite(amount) ? amount : 0,
      category: name || "Income",
      notes: "Income",
      transaction_date: `${selectedMonth}-01`,
      due_date: `${selectedMonth}-01`,
      is_paid: false,
      paid_at: null,
      is_recurring: false,
      created_at: new Date().toISOString()
    };
    setPendingCreateRows((prev) => [tempRow, ...prev]);
    setSavingIncome(true);
    try {
      await addTransactionAction(formData);
      setShowIncomeComposer(false);
      setIncomeDraft({ category: "", amount: "" });
      router.refresh();
    } finally {
      setPendingCreateRows((prev) => prev.filter((row) => row.id !== tempId));
      setSavingIncome(false);
    }
  }

  async function submitExpenseRow(formData: FormData) {
    if (savingExpense) return;
    const tempId = createTempId("temp-expense");
    const amount = Number(formData.get("amount") ?? 0);
    const name = String(formData.get("category") ?? "").trim();
    const metaCategory = String(formData.get("meta_category") ?? "").trim();
    const tempRow: Transaction = {
      id: tempId,
      user_id: "pending",
      type: "expense",
      amount: Number.isFinite(amount) ? amount : 0,
      category: name || "Expense",
      notes: metaCategory || null,
      transaction_date: `${selectedMonth}-01`,
      due_date: `${selectedMonth}-01`,
      is_paid: false,
      paid_at: null,
      is_recurring: true,
      created_at: new Date().toISOString()
    };
    setPendingCreateRows((prev) => [tempRow, ...prev]);
    setSavingExpense(true);
    try {
      await addTransactionAction(formData);
      setShowExpenseComposer(false);
      setExpenseDraft({ category: "", amount: "" });
      setComposerCategory(EXPENSE_CATEGORY_DEFAULTS[0]);
      setComposerNewCategory("");
      router.refresh();
    } finally {
      setPendingCreateRows((prev) => prev.filter((row) => row.id !== tempId));
      setSavingExpense(false);
    }
  }

  function requestDeleteCategory(category: string) {
    const inUse = expenseRows.some((row) => rowCategory(row, "expense") === category);
    setDeleteModal({ open: true, category, blocked: inUse });
  }

  async function confirmDeleteCategory() {
    if (!deleteModal.category || deleteModal.blocked) {
      setDeleteModal({ open: false, category: "", blocked: false });
      return;
    }
    setDeletingCategory(true);
    try {
      const fd = new FormData();
      fd.set("type", "expense");
      fd.set("name", deleteModal.category);
      await deleteCategoryAction(fd);
      setHiddenCategories((prev) => (prev.includes(deleteModal.category) ? prev : [...prev, deleteModal.category]));
      setDeleteModal({ open: false, category: "", blocked: false });
      router.refresh();
    } finally {
      setDeletingCategory(false);
    }
  }

  function requestDeleteRow(row: Transaction) {
    setRowDeleteModal({ open: true, row });
  }

  async function confirmDeleteRow() {
    if (!rowDeleteModal.row) {
      setRowDeleteModal({ open: false, row: null });
      return;
    }
    setDeletingRow(true);
    try {
      const fd = new FormData();
      fd.set("id", rowDeleteModal.row.id);
      await deleteTransactionAction(fd);
      setRowDeleteModal({ open: false, row: null });
      router.refresh();
    } finally {
      setDeletingRow(false);
    }
  }

  async function confirmClone() {
    if (cloning) return;
    setCloneError(null);
    setCloning(true);
    try {
      const fd = new FormData();
      fd.set("source_month", selectedMonth);
      const result = await cloneMonthAction(fd);
      if (result?.error) {
        setCloneError(`Clone failed: ${result.error}`);
      } else {
        setShowCloneModal(false);
        router.refresh();
      }
    } finally {
      setCloning(false);
    }
  }

  function cancelIncomeComposer() {
    setIncomeDraft({ category: "", amount: "" });
    setShowIncomeComposer(false);
  }

  function cancelExpenseComposer() {
    setExpenseDraft({ category: "", amount: "" });
    setComposerCategory(EXPENSE_CATEGORY_DEFAULTS[0]);
    setComposerNewCategory("");
    setShowExpenseComposer(false);
  }

  return (
    <div className="stack month-workspace">
      <GlassCard className="month-hero">
        <div className="year-row">
          <motion.button className="month-nav" type="button" onClick={() => setSelectedYear((year) => year - 1)} whileHover={{ y: -4, scale: 1.03, boxShadow: "0 10px 22px rgba(94,161,255,.32)" }} whileTap={{ scale: 0.94 }}>
            {"<"}
          </motion.button>
          <strong className="year-label">{selectedYear}</strong>
          <motion.button className="month-nav" type="button" onClick={() => setSelectedYear((year) => year + 1)} whileHover={{ y: -4, scale: 1.03, boxShadow: "0 10px 22px rgba(94,161,255,.32)" }} whileTap={{ scale: 0.94 }}>
            {">"}
          </motion.button>
        </div>
        <div
          className="month-rail full-width"
          ref={monthRailRef}
          onWheel={(event) => {
            if (!monthRailRef.current) return;
            monthRailRef.current.scrollLeft += event.deltaY;
          }}
        >
          {MONTHS.map((month, index) => (
            <motion.button key={month} className={`month-chip ${selectedMonthIndex === index ? "active" : ""}`} type="button" onClick={() => setSelectedMonthIndex(index)} whileHover={{ y: -5, scale: 1.03, boxShadow: "0 10px 24px rgba(94,161,255,.30)" }} whileTap={{ scale: 0.94 }}>
              {month}
            </motion.button>
          ))}
        </div>
      </GlassCard>

      <AnimatePresence mode="wait">
        <motion.div key={selectedMonth} className="stack" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ type: "spring", stiffness: 180, damping: 24 }}>
          {/* ── Income ── */}
          <GlassCard className="section-income">
            <div className="row"><h3 className="section-title">Income</h3></div>
            <div className="workspace-table compact">
              {incomeRows.map((row) => (
                <IncomeRow
                  key={row.id}
                  row={row}
                  pending={!!pendingRows[row.id]}
                  onNameChange={(value) => queueAutoSave(row, { category: value })}
                  onAmountChange={(value) => queueAutoSave(row, { amount: value })}
                  onDelete={() => requestDeleteRow(row)}
                />
              ))}
              <AnimatePresence initial={false}>
                {showIncomeComposer ? (
                  <motion.form
                    action={submitIncomeRow}
                    className="workspace-row add-row tight-row income-add-row"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setShowIncomeComposer(false);
                      if (event.key === "Enter" && !(event.target instanceof HTMLTextAreaElement)) {
                        event.preventDefault();
                        event.currentTarget.requestSubmit();
                      }
                    }}
                  >
                    <input type="hidden" name="type" value="income" />
                    <input type="hidden" name="transaction_date" value={`${selectedMonth}-01`} />
                    <input type="hidden" name="due_date" value={`${selectedMonth}-01`} />
                    <input type="hidden" name="notes" value="Income" />
                    <input name="category" placeholder="Name" required autoFocus value={incomeDraft.category} onChange={(e) => setIncomeDraft((d) => ({ ...d, category: e.target.value }))} />
                    <input name="amount" type="number" step="0.01" min="0" placeholder="0" required value={incomeDraft.amount} onChange={(e) => setIncomeDraft((d) => ({ ...d, amount: e.target.value }))} />
                    <button className="button slim add-inline-btn action-btn" type="submit" disabled={savingIncome}>{savingIncome ? "Adding..." : "Add"}</button>
                    <button className="button slim ghost action-btn" type="button" onClick={cancelIncomeComposer}>Cancel</button>
                  </motion.form>
                ) : (
                  <motion.button className="add-inline" type="button" onClick={() => setShowIncomeComposer(true)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    + Add Income
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </GlassCard>

          {/* ── Summary ── */}
          <GlassCard className="section-completion">
            <div className="overview-row">
              <ProgressRing progress={completion} size={106} />
              <div className="stack-sm">
                <p className="muted">Expense Completion</p>
                <p className="metric-line">{paidExpenseCount}/{expenseRows.length} paid</p>
                <p className="metric-line income">Total Income Rs {totalIncome.toLocaleString("en-IN")}</p>
                <p className="metric-line expense">Total Expenses Rs {totalExpense.toLocaleString("en-IN")}</p>
                <p className="metric-line warning">Running Balance</p>
                <AnimatedCurrency value={runningBalance} />
              </div>
            </div>
          </GlassCard>

          {/* ── Expenses ── */}
          <GlassCard className="section-expenses">
            <div className="row">
              <h3 className="section-title">Expenses</h3>
              <div className="row header-actions">
                <button
                  className="button ghost slim"
                  type="button"
                  onClick={() => { setCloneError(null); setShowCloneModal(true); }}
                  disabled={currentMonthIsEmpty}
                  title={currentMonthIsEmpty ? "No data to clone" : `Clone this month to ${nextMonthLabel}`}
                >
                  Clone Month
                </button>
                <button className="button ghost slim" type="button" onClick={() => setShowCategorySettings(true)}>
                  Category Settings
                </button>
              </div>
            </div>
            <div className="sheet-head expense-head"><span>Paid</span><span>Name</span><span>Amount</span><span>Category</span></div>
            <div className="workspace-table compact">
              {expenseRows.map((row) => (
                <ExpenseRow
                  key={row.id}
                  row={row}
                  categories={expenseCategories}
                  pending={!!pendingRows[row.id]}
                  onToggle={() => togglePaidOptimistic(row)}
                  onNameChange={(value) => queueAutoSave(row, { category: value })}
                  onAmountChange={(value) => queueAutoSave(row, { amount: value })}
                  onMetaChange={(value) => queueAutoSave(row, { notes: value })}
                  onDelete={() => requestDeleteRow(row)}
                />
              ))}
              <AnimatePresence initial={false}>
                {showExpenseComposer ? (
                  <motion.form
                    action={submitExpenseRow}
                    className="workspace-row add-row tight-row expense-add-row"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setShowExpenseComposer(false);
                      if (event.key === "Enter" && !(event.target instanceof HTMLTextAreaElement)) {
                        event.preventDefault();
                        event.currentTarget.requestSubmit();
                      }
                    }}
                  >
                    <input type="hidden" name="type" value="expense" />
                    <input type="hidden" name="transaction_date" value={`${selectedMonth}-01`} />
                    <input type="hidden" name="due_date" value={`${selectedMonth}-01`} />
                    <input type="hidden" name="is_recurring" value="on" />
                    <input type="hidden" name="meta_category_new" value={composerNewCategory} />
                    <input name="category" placeholder="Name" required autoFocus value={expenseDraft.category} onChange={(e) => setExpenseDraft((d) => ({ ...d, category: e.target.value }))} />
                    <input name="amount" type="number" step="0.01" min="0" placeholder="0" required value={expenseDraft.amount} onChange={(e) => setExpenseDraft((d) => ({ ...d, amount: e.target.value }))} />
                    <select
                      name="meta_category"
                      value={composerCategory}
                      onChange={(event) => {
                        const value = event.target.value;
                        setComposerCategory(value);
                        setComposerNewCategory("");
                      }}
                    >
                      {expenseCategories.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                    <button className="button slim add-inline-btn action-btn" type="submit" disabled={savingExpense}>{savingExpense ? "Adding..." : "Add"}</button>
                    <button className="button slim ghost action-btn" type="button" onClick={cancelExpenseComposer}>Cancel</button>
                  </motion.form>
                ) : (
                  <motion.button className="add-inline" type="button" onClick={() => setShowExpenseComposer(true)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    + Add Expense
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </GlassCard>

          {/* ── Breakdown ── */}
          <GlassCard className="section-breakdown">
            <h3 className="section-title">Expense Breakdown</h3>
            <InteractiveDonut slices={donutSlices} centerValue={centerValue} centerLabel={centerLabel} hoverSlice={hoverSlice} setHoverSlice={setHoverSlice} />
          </GlassCard>
        </motion.div>
      </AnimatePresence>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showCloneModal ? (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal-card" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}>
              <div className="row">
                <h3>Clone {MONTHS[selectedMonthIndex]} {selectedYear} → {nextMonthLabel}</h3>
                <button className="button ghost slim" type="button" onClick={() => setShowCloneModal(false)}>✕</button>
              </div>
              <div className="clone-checklist">
                <p className="clone-check-item">✓ Copy all income rows</p>
                <p className="clone-check-item">✓ Copy all expense rows</p>
                <p className="clone-check-item">✓ Copy all categories</p>
                <p className="clone-check-item">✓ Reset all expense checkboxes</p>
              </div>
              <p className="muted" style={{ fontSize: 13 }}>The destination month data will be replaced.</p>
              {cloneError ? <p className="status error">{cloneError}</p> : null}
              <div className="row">
                <button className="button ghost slim" type="button" onClick={() => setShowCloneModal(false)}>Cancel</button>
                <button className="button slim clone-confirm-btn" type="button" onClick={confirmClone} disabled={cloning}>
                  {cloning ? "Cloning..." : "Clone"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}

        {showCategorySettings ? (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal-card" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}>
              <div className="row">
                <h3>Category Settings</h3>
                <button className="button ghost slim" type="button" onClick={() => setShowCategorySettings(false)}>Close</button>
              </div>
              <div className="category-settings-body">
                <form action={addCategoryAction} className="row">
                  <input type="hidden" name="type" value="expense" />
                  <input name="name" required placeholder="Add Category" />
                  <button className="button slim" type="submit">Add</button>
                </form>
                <div className="stack">
                  {expenseCategories.map((cat) => (
                    <CategoryManagerRow key={cat} category={cat} onDeleteRequest={requestDeleteCategory} />
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}

        {deleteModal.open ? (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal-card" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}>
              <h3>{deleteModal.blocked ? "Category In Use" : "Delete Category"}</h3>
              {deleteModal.blocked ? (
                <p className="muted">&quot;{deleteModal.category}&quot; is used by existing expenses. Move those expenses to another category first.</p>
              ) : (
                <p className="muted">Delete &quot;{deleteModal.category}&quot;? This cannot be undone.</p>
              )}
              <div className="row">
                <button className="button ghost slim" type="button" onClick={() => setDeleteModal({ open: false, category: "", blocked: false })}>
                  {deleteModal.blocked ? "Close" : "Cancel"}
                </button>
                {!deleteModal.blocked ? (
                  <button className="button slim" type="button" onClick={confirmDeleteCategory} disabled={deletingCategory}>
                    {deletingCategory ? "Deleting..." : "Delete"}
                  </button>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        ) : null}

        {rowDeleteModal.open ? (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal-card" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}>
              <h3>Delete Row</h3>
              <p className="muted">Delete &quot;{rowDeleteModal.row?.category}&quot;? This cannot be undone.</p>
              <div className="row">
                <button className="button ghost slim" type="button" onClick={() => setRowDeleteModal({ open: false, row: null })}>Cancel</button>
                <button className="button slim" type="button" onClick={confirmDeleteRow} disabled={deletingRow}>
                  {deletingRow ? "Deleting..." : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// ── Expense Row ──────────────────────────────────────────────────────────────

function ExpenseRow({
  row, categories, pending, onToggle, onNameChange, onAmountChange, onMetaChange, onDelete
}: {
  row: Transaction; categories: string[]; pending: boolean;
  onToggle: () => void; onNameChange: (v: string) => void;
  onAmountChange: (v: number) => void; onMetaChange: (v: string) => void; onDelete: () => void;
}) {
  const [dragX, setDragX] = useState(0);
  const swipeThreshold = -112;
  return (
    <div className="swipe-shell">
      <motion.div className="swipe-delete-bg" animate={{ opacity: Math.min(1, Math.abs(dragX) / 110) }}>
        <motion.span animate={{ scale: 0.92 + Math.min(0.34, Math.abs(dragX) / 200) }}>✕</motion.span>
      </motion.div>
      <motion.div
        className={`workspace-row row-hover ${row.is_paid ? "is-paid" : ""} ${pending ? "row-pending" : ""}`}
        whileTap={{ scale: 0.998 }}
        drag="x"
        dragConstraints={{ left: -140, right: 0 }}
        dragElastic={0.08}
        dragMomentum={false}
        onDrag={(_, info) => setDragX(Math.min(0, info.offset.x))}
        onDragEnd={(_, info) => { const x = Math.min(0, info.offset.x); setDragX(0); if (x <= swipeThreshold) onDelete(); }}
        transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.6 }}
      >
        <motion.button
          className={`check-btn ${row.is_paid ? "done" : ""}`}
          type="button"
          onClick={onToggle}
          whileTap={{ scale: 0.93 }}
          animate={row.is_paid ? { scale: [0.9, 1.02, 1], boxShadow: ["0 0 0 rgba(94,161,255,0)", "0 0 18px rgba(94,161,255,.45)", "0 0 0 rgba(94,161,255,0)"] } : {}}
        >
          <span className="check-core">
            <motion.span className="check-icon" animate={{ opacity: row.is_paid ? 1 : 0, scale: row.is_paid ? 1 : 0.7 }}>✓</motion.span>
          </span>
        </motion.button>
        <input defaultValue={row.category} aria-label="Name" onChange={(e) => onNameChange(e.target.value)} />
        <input defaultValue={row.amount} type="number" step="0.01" min="0" aria-label="Amount" onChange={(e) => onAmountChange(Number(e.target.value || 0))} />
        <select value={rowCategory(row, "expense")} onChange={(e) => onMetaChange(e.target.value)}>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </motion.div>
    </div>
  );
}

// ── Income Row ───────────────────────────────────────────────────────────────

function IncomeRow({
  row, pending, onNameChange, onAmountChange, onDelete
}: {
  row: Transaction; pending: boolean;
  onNameChange: (v: string) => void; onAmountChange: (v: number) => void; onDelete: () => void;
}) {
  const [dragX, setDragX] = useState(0);
  const swipeThreshold = -112;
  return (
    <div className="swipe-shell">
      <motion.div className="swipe-delete-bg" animate={{ opacity: Math.min(1, Math.abs(dragX) / 110) }}>
        <motion.span animate={{ scale: 0.92 + Math.min(0.34, Math.abs(dragX) / 200) }}>✕</motion.span>
      </motion.div>
      <motion.div
        className={`workspace-row income-row row-hover ${pending ? "row-pending" : ""}`}
        whileTap={{ scale: 0.998 }}
        drag="x"
        dragConstraints={{ left: -140, right: 0 }}
        dragElastic={0.08}
        dragMomentum={false}
        onDrag={(_, info) => setDragX(Math.min(0, info.offset.x))}
        onDragEnd={(_, info) => { const x = Math.min(0, info.offset.x); setDragX(0); if (x <= swipeThreshold) onDelete(); }}
        transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.6 }}
      >
        <input defaultValue={row.category} aria-label="Income Name" onChange={(e) => onNameChange(e.target.value)} />
        <input defaultValue={row.amount} type="number" step="0.01" min="0" aria-label="Amount" onChange={(e) => onAmountChange(Number(e.target.value || 0))} />
      </motion.div>
    </div>
  );
}

// ── Category Manager ─────────────────────────────────────────────────────────

function CategoryManagerRow({ category, onDeleteRequest }: { category: string; onDeleteRequest: (name: string) => void }) {
  const router = useRouter();
  const [renameTo, setRenameTo] = useState(category);
  const [renaming, setRenaming] = useState(false);

  async function handleRenameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = renameTo.trim();
    if (!next || next === category || renaming) return;
    setRenaming(true);
    try {
      const fd = new FormData();
      fd.set("type", "expense");
      fd.set("from", category);
      fd.set("to", next);
      await renameCategoryAction(fd);
      router.refresh();
    } finally {
      setRenaming(false);
    }
  }

  return (
    <div className="category-manager">
      <strong>{category}</strong>
      <form className="row" onSubmit={handleRenameSubmit}>
        <input name="to" value={renameTo} onChange={(e) => setRenameTo(e.target.value)} />
        <button className="button slim" type="submit" disabled={renaming || !renameTo.trim()}>
          {renaming ? "Renaming..." : "Rename"}
        </button>
      </form>
      <div className="row">
        <button className="button ghost slim" type="button" onClick={() => onDeleteRequest(category)}>Delete</button>
      </div>
    </div>
  );
}

// ── Donut Chart ──────────────────────────────────────────────────────────────

function InteractiveDonut({
  slices, centerValue, centerLabel, hoverSlice, setHoverSlice
}: {
  slices: Array<{ name: string; value: number; pct: number; start: number; end: number; color: string }>;
  centerValue: number;
  centerLabel: string;
  hoverSlice: string | null;
  setHoverSlice: (name: string | null) => void;
}) {
  const SIZE = 210;
  const INNER = 70;
  const OUTER = 100;

  const hoveredSlice = hoverSlice ? slices.find(s => s.name === hoverSlice) : null;
  const displayValue = hoveredSlice ? hoveredSlice.value : centerValue;
  const displayLabel = hoveredSlice ? hoveredSlice.name : (centerLabel || "Total Expenses");

  const pieData = slices.map(s => ({ name: s.name, value: s.value, color: s.color }));

  return (
    <div className="donut-layout">
      <div className="donut-wrap">
        <PieChart width={SIZE} height={SIZE}>
          <Pie
            data={pieData}
            dataKey="value"
            cx="50%"
            cy="50%"
            innerRadius={INNER}
            outerRadius={OUTER}
            cornerRadius={12}
            paddingAngle={2}
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive={false}
            onMouseLeave={() => setHoverSlice(null)}
          >
            {pieData.map((entry, i) => {
              const active = hoverSlice === entry.name;
              const hasHover = hoverSlice !== null;
              return (
                <Cell
                  key={entry.name}
                  fill={entry.color}
                  opacity={hasHover ? (active ? 1 : 0.3) : 0.92}
                  style={{
                    filter: active ? `drop-shadow(0 0 8px ${entry.color}cc)` : "none",
                    transition: "opacity 0.18s ease, filter 0.18s ease",
                    cursor: "default",
                  }}
                  onMouseEnter={() => setHoverSlice(entry.name)}
                />
              );
            })}
          </Pie>
        </PieChart>

        <div className="donut-center">
          <div className="donut-center-inner">
            <p className="muted" style={{ fontSize: 11, margin: 0 }}>
              {displayLabel}
            </p>
            <AnimatedCurrency value={displayValue} />
          </div>
        </div>
      </div>

      <div className="pie-legend">
        {slices.length === 0 && <p className="muted">No expense rows for this month.</p>}
        {slices.map(slice => (
          <div
            key={slice.name}
            className={`row legend-row ${hoverSlice === slice.name ? "active" : ""}`}
            onMouseEnter={() => setHoverSlice(slice.name)}
            onMouseLeave={() => setHoverSlice(null)}
          >
            <span className="row">
              <span className="legend-dot" style={{ background: slice.color }} />
              {slice.name}
            </span>
            <span>Rs {slice.value.toLocaleString("en-IN")} · {Math.round(slice.pct * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Utilities ────────────────────────────────────────────────────────────────

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function sortRows(a: Transaction, b: Transaction) {
  return (a.due_date || a.transaction_date).localeCompare(b.due_date || b.transaction_date) || a.category.localeCompare(b.category);
}
function rowCategory(row: Transaction, type: "income" | "expense") {
  if (type === "income") return "Income";
  if (row.notes && row.notes.trim()) return row.notes.trim();
  if (row.category && row.category.trim()) return row.category.trim();
  return "Uncategorized";
}
