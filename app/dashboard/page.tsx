import { requireUser } from "@/lib/auth";
import { listTransactions } from "@/lib/data/transactions";
import { ensureDefaultCategories, listCategories } from "@/lib/data/categories";
import { DashboardClient } from "@/components/dashboard-client";
import { ensureCurrentMonthFromRecurring } from "@/lib/month-engine";

export default async function DashboardPage() {
  await requireUser();
  let transactions = [] as Awaited<ReturnType<typeof listTransactions>>;
  let categories = [] as Awaited<ReturnType<typeof listCategories>>;
  let loadError: string | null = null;

  try {
    await ensureCurrentMonthFromRecurring();
    await ensureDefaultCategories();
    [transactions, categories] = await Promise.all([listTransactions(), listCategories()]);
    console.log("[DASHBOARD] server fetch: total transactions =", transactions.length,
      "sample dates:", transactions.slice(0, 5).map(t => t.transaction_date));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: string }).message)
          : "Unknown backend error";
    loadError = message;
  }

  return (
    <div className="stack">
      {loadError ? (
        <section className="card stack">
          <h2>Database setup required</h2>
          <p className="muted">
            Supabase responded with an error while loading your finance data. This usually means migrations were not run
            yet in this project.
          </p>
          <p className="status error">{loadError}</p>
          <p className="muted">
            Run the SQL file at <code>supabase/migrations/202605290001_init.sql</code> in Supabase SQL Editor, then
            refresh this page.
          </p>
        </section>
      ) : null}

      {!loadError ? <DashboardClient initialTransactions={transactions} categories={categories} /> : null}
    </div>
  );
}
