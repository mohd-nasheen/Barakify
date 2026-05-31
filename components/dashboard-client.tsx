"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  addCategoryAction,
  addTransactionAction,
  deleteCategoryAction,
  ensureMonthStructureAction,
  renameCategoryAction,
  togglePaidAction,
  updateTransactionAction
} from "@/app/actions/finance";
import type { Category, Transaction } from "@/lib/types";
import { AnimatedCurrency, GlassCard, ProgressRing } from "@/components/parity-ui";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const EXPENSE_CATEGORY_DEFAULTS = ["Credit Card", "Rent", "Savings", "Home", "Gold", "Debt", "Clothing", "Others"];

type RowPatch = { category?: string; amount?: number; notes?: string; is_paid?: boolean };

function createTempId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function DashboardClient({ initialTransactions, categories }: { initialTransactions: Transaction[]; categories: Category[] }) {
  const router = useRouter();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(now.getMonth());
  const [showExpenseComposer, setShowExpenseComposer] = useState(false);
  const [showIncomeComposer, setShowIncomeComposer] = useState(false);
  const [showCategorySettings, setShowCategorySettings] = useState(false);
  const [composerCategory, setComposerCategory] = useState(EXPENSE_CATEGORY_DEFAULTS[0]);
  const [composerNewCategory, setComposerNewCategory] = useState("");
  const [hoverSlice, setHoverSlice] = useState<string | null>(null);
  const [optimisticRows, setOptimisticRows] = useState<Record<string, RowPatch>>({});
  const [pendingCreateRows, setPendingCreateRows] = useState<Transaction[]>([]);
  const [pendingRows, setPendingRows] = useState<Record<string, boolean>>({});
  const [_, startTransition] = useTransition();
  const [savingIncome, setSavingIncome] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);
  const [localCategories, setLocalCategories] = useState<string[]>([]);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; category: string; blocked: boolean }>({
    open: false,
    category: "",
    blocked: false
  });
  const [deletingCategory, setDeletingCategory] = useState(false);

  const monthRailRef = useRef<HTMLDivElement | null>(null);
  const ensureFormRef = useRef<HTMLFormElement | null>(null);
  const autosaveTimers = useRef(new Map<string, number>());

  const selectedMonth = `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, "0")}`;
  useEffect(() => {
    ensureFormRef.current?.requestSubmit();
  }, [selectedMonth]);

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
  const remainingExpense = expenseRows.filter((t) => !t.is_paid).reduce((sum, t) => sum + t.amount, 0);

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

  const centerSlice = hoverSlice ? donutSlices.find((slice) => slice.name === hoverSlice) : null;
  const centerValue = centerSlice ? centerSlice.value : expenseRows.reduce((sum, row) => sum + row.amount, 0);
  const centerLabel = centerSlice ? centerSlice.name : "Total Expenses";

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

  return (
    <div className="stack month-workspace">
      <form action={ensureMonthStructureAction} ref={ensureFormRef}>
        <input type="hidden" name="month" value={selectedMonth} />
      </form>

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
                />
              ))}
              <AnimatePresence initial={false}>
                {showIncomeComposer ? (
                  <motion.form
                    action={submitIncomeRow}
                    className="workspace-row income-row add-row composer-row tight-row"
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
                    <input name="category" placeholder="Name" required autoFocus />
                    <input name="amount" type="number" step="0.01" min="0" placeholder="0" required />
                    <button className="button slim add-inline-btn" type="submit" disabled={savingIncome}>{savingIncome ? "Adding..." : "Add"}</button>
                  </motion.form>
                ) : (
                  <motion.button className="add-inline" type="button" onClick={() => setShowIncomeComposer(true)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    + Add Income
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </GlassCard>

          <GlassCard className="section-completion">
            <div className="overview-row">
              <ProgressRing progress={completion} size={106} />
              <div className="stack-sm">
                <p className="muted">Expense Completion</p>
                <p className="metric-line">{paidExpenseCount}/{expenseRows.length} paid</p>
                <p className="metric-line income">Total Income Rs {totalIncome.toLocaleString("en-IN")}</p>
                <p className="metric-line expense">Total Expenses Rs {totalExpense.toLocaleString("en-IN")}</p>
                <p className="metric-line warning">Available Balance</p>
                <AnimatedCurrency value={totalIncome - totalExpense} />
              </div>
            </div>
          </GlassCard>

          <GlassCard className="section-expenses">
            <div className="row">
              <h3 className="section-title">Expenses</h3>
              <button className="button ghost" type="button" onClick={() => setShowCategorySettings(true)}>
                Category Settings
              </button>
            </div>
            <div className="sheet-head"><span>Paid</span><span>Name</span><span>Amount</span><span>Category</span></div>
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
                />
              ))}

              <AnimatePresence initial={false}>
                {showExpenseComposer ? (
                  <motion.form
                    action={submitExpenseRow}
                    className="workspace-row add-row composer-row tight-row"
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
                    <span className="check-placeholder" />
                    <input name="category" placeholder="Name" required autoFocus />
                    <input name="amount" type="number" step="0.01" min="0" placeholder="0" required />
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
                    <button className="button slim add-inline-btn" type="submit" disabled={savingExpense}>{savingExpense ? "Adding..." : "Add"}</button>
                  </motion.form>
                ) : (
                  <motion.button className="add-inline" type="button" onClick={() => setShowExpenseComposer(true)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    + Add Expense
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </GlassCard>

          <GlassCard className="section-breakdown">
            <h3 className="section-title">Expense Breakdown</h3>
            <InteractiveDonut slices={donutSlices} centerValue={centerValue} centerLabel={centerLabel} hoverSlice={hoverSlice} setHoverSlice={setHoverSlice} />
          </GlassCard>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
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
                  <CategoryManagerRow
                    key={cat}
                    category={cat}
                    onDeleteRequest={requestDeleteCategory}
                  />
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
                <p className="muted">
                  "{deleteModal.category}" is currently being used by existing expenses. Please move those expenses to another category before deleting this category.
                </p>
              ) : (
                <p className="muted">Are you sure you want to delete "{deleteModal.category}"? This action cannot be undone.</p>
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
      </AnimatePresence>
    </div>
  );
}

function ExpenseRow({
  row,
  categories,
  pending,
  onToggle,
  onNameChange,
  onAmountChange,
  onMetaChange
}: {
  row: Transaction;
  categories: string[];
  pending: boolean;
  onToggle: () => void;
  onNameChange: (value: string) => void;
  onAmountChange: (value: number) => void;
  onMetaChange: (value: string) => void;
}) {
  return (
    <motion.div className={`workspace-row row-hover ${row.is_paid ? "is-paid" : ""} ${pending ? "row-pending" : ""}`} whileTap={{ scale: 0.998 }}>
      <motion.button className={`check-btn ${row.is_paid ? "done" : ""}`} type="button" onClick={onToggle} whileTap={{ scale: 0.93 }} animate={row.is_paid ? { scale: [1, 0.93, 1], boxShadow: ["0 0 0 rgba(94,161,255,0)", "0 0 16px rgba(94,161,255,.45)", "0 0 0 rgba(94,161,255,0)"] } : {}}>
        {row.is_paid ? "\u2611" : "\u2610"}
      </motion.button>
      <input defaultValue={row.category} aria-label="Name" onChange={(e) => onNameChange(e.target.value)} />
      <input defaultValue={row.amount} type="number" step="0.01" min="0" aria-label="Amount" onChange={(e) => onAmountChange(Number(e.target.value || 0))} />
      <select value={rowCategory(row, "expense")} onChange={(e) => onMetaChange(e.target.value)}>
        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </motion.div>
  );
}

function IncomeRow({
  row,
  pending,
  onNameChange,
  onAmountChange
}: {
  row: Transaction;
  pending: boolean;
  onNameChange: (value: string) => void;
  onAmountChange: (value: number) => void;
}) {
  return (
    <motion.div className={`workspace-row income-row row-hover ${pending ? "row-pending" : ""}`} whileTap={{ scale: 0.998 }}>
      <input defaultValue={row.category} aria-label="Income Name" onChange={(e) => onNameChange(e.target.value)} />
      <input defaultValue={row.amount} type="number" step="0.01" min="0" aria-label="Amount" onChange={(e) => onAmountChange(Number(e.target.value || 0))} />
    </motion.div>
  );
}

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

function InteractiveDonut({
  slices,
  centerValue,
  centerLabel,
  hoverSlice,
  setHoverSlice
}: {
  slices: Array<{ name: string; value: number; pct: number; start: number; end: number; color: string }>;
  centerValue: number;
  centerLabel: string;
  hoverSlice: string | null;
  setHoverSlice: (name: string | null) => void;
}) {
  const size = 196;
  const stroke = 28;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="donut-layout">
      <div className="donut-wrap">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {slices
            .slice()
            .sort((a, b) => {
              if (a.name === hoverSlice) return 1;
              if (b.name === hoverSlice) return -1;
              return 0;
            })
            .map((slice, index) => {
            const length = Math.max(0, slice.pct * circumference);
            const offset = circumference * (1 - slice.start);
            const active = hoverSlice === slice.name;
            const hasHover = hoverSlice !== null;
            return (
              <motion.circle
                key={slice.name}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={slice.color}
                strokeWidth={active ? stroke + 4 : stroke}
                strokeLinecap="round"
                fill="none"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                initial={{ strokeDasharray: `0 ${circumference}` }}
                animate={{
                  strokeDasharray: `${length} ${circumference - length}`,
                  strokeDashoffset: -offset,
                  opacity: hasHover ? (active ? 1 : 0.3) : 0.92
                }}
                transition={{ type: "spring", stiffness: 170, damping: 24, delay: index * 0.03 }}
                style={{
                  filter: active
                    ? `saturate(1.12) drop-shadow(0 0 7px ${slice.color}) drop-shadow(0 0 12px ${slice.color})`
                    : hasHover
                      ? "saturate(0.72)"
                      : undefined
                }}
                onMouseEnter={() => setHoverSlice(slice.name)}
                onMouseLeave={() => setHoverSlice(null)}
              />
            );
          })}
        </svg>
        <div className="donut-center">
          <div className="donut-center-inner">
            <p className="muted">{centerLabel}</p>
            <AnimatedCurrency value={centerValue} />
          </div>
        </div>
      </div>
      <div className="pie-legend">
        {slices.length === 0 ? <p className="muted">No expense rows for this month.</p> : null}
        {slices.map((slice) => (
          <motion.div key={slice.name} className={`row legend-row ${hoverSlice === slice.name ? "active" : ""}`} onMouseEnter={() => setHoverSlice(slice.name)} onMouseLeave={() => setHoverSlice(null)}>
            <span className="row"><span className="legend-dot" style={{ background: slice.color }} />{slice.name}</span>
            <span>Rs {slice.value.toLocaleString("en-IN")} {Math.round(slice.pct * 100)}%</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

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
