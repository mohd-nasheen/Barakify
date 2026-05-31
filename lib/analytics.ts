import type { Transaction } from "@/lib/types";

export function calculateAnalytics(transactions: Transaction[]) {
  const monthlyIncome = transactions.filter((t) => t.type === "income").reduce((acc, t) => acc + t.amount, 0);
  const monthlySpending = transactions.filter((t) => t.type === "expense").reduce((acc, t) => acc + t.amount, 0);
  const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlySpending) / monthlyIncome) * 100 : 0;

  const categoryBreakdown = transactions
    .filter((t) => t.type === "expense")
    .reduce<Record<string, number>>((acc, t) => {
      acc[t.category] = (acc[t.category] ?? 0) + t.amount;
      return acc;
    }, {});

  const trendByMonth = transactions.reduce<Record<string, { income: number; expense: number }>>((acc, t) => {
    const d = new Date(t.transaction_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!acc[key]) acc[key] = { income: 0, expense: 0 };
    if (t.type === "income") acc[key].income += t.amount;
    if (t.type === "expense") acc[key].expense += t.amount;
    return acc;
  }, {});

  return {
    monthlyIncome,
    monthlySpending,
    savingsRate,
    categoryBreakdown,
    trendByMonth
  };
}
