import mongoose from "mongoose";
import { Transaction } from "./models";
import { formatCurrency, formatCompact, formatPercent } from "./format";
import type { MonthPoint, Overview, CategorySlice, RiskOrOpportunity } from "./types";

function objectId(id: string) {
  return new mongoose.Types.ObjectId(id);
}

export async function monthlyTotals(
  businessId: string,
  from?: Date,
  to?: Date
): Promise<MonthPoint[]> {
  const match: Record<string, unknown> = { businessId: objectId(businessId) };
  if (from || to) {
    match.date = {};
    if (from) (match.date as Record<string, unknown>).$gte = from;
    if (to) (match.date as Record<string, unknown>).$lte = to;
  }

  const rows = await Transaction.aggregate<{
    _id: string;
    inflow: number;
    outflow: number;
    count: number;
  }>([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
        inflow: { $sum: { $cond: [{ $eq: ["$direction", "credit"] }, "$amount", 0] } },
        outflow: { $sum: { $cond: [{ $eq: ["$direction", "debit"] }, "$amount", 0] } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return rows.map((r) => {
    const profit = r.inflow - r.outflow;
    return {
      period: r._id,
      revenue: r.inflow,
      expenses: r.outflow,
      profit,
      margin: r.inflow ? (profit / r.inflow) * 100 : 0,
      netCashflow: profit,
      count: r.count,
    };
  });
}

function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function trailingStreak<T>(rows: T[], predicate: (row: T) => boolean): number {
  let count = 0;
  for (let i = rows.length - 1; i >= 0 && predicate(rows[i]); i--) count++;
  return count;
}

function periodBounds(period: string): { from: Date; to: Date } {
  const [year, month] = period.split("-").map(Number);
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1) - 1);
  return { from, to };
}

export async function getOverview(businessId: string, month?: string): Promise<Overview | null> {
  const months = await monthlyTotals(businessId);
  if (months.length === 0) return null;
  const idx = month ? months.findIndex((m) => m.period === month) : months.length - 1;
  if (idx < 0) return null;
  const cur = months[idx];
  const prev = idx > 0 ? months[idx - 1] : null;

  return {
    period: cur.period,
    previousPeriod: prev?.period ?? null,
    dataMonths: months.length,
    revenue: { value: cur.revenue, change: prev ? pctChange(cur.revenue, prev.revenue) : null },
    expenses: { value: cur.expenses, change: prev ? pctChange(cur.expenses, prev.expenses) : null },
    profit: { value: cur.profit, change: prev ? pctChange(cur.profit, prev.profit) : null },
    margin: { value: cur.margin, change: prev ? cur.margin - prev.margin : null },
    cashflow: { value: cur.netCashflow, change: prev ? pctChange(cur.netCashflow, prev.netCashflow) : null },
  };
}

export async function getAllTimeOverview(businessId: string): Promise<Overview | null> {
  const months = await monthlyTotals(businessId);
  if (months.length === 0) return null;

  const totals = months.reduce(
    (sum, current) => ({
      revenue: sum.revenue + current.revenue,
      expenses: sum.expenses + current.expenses,
      profit: sum.profit + current.profit,
      cashflow: sum.cashflow + current.netCashflow,
    }),
    { revenue: 0, expenses: 0, profit: 0, cashflow: 0 }
  );

  return {
    period: "all-time",
    previousPeriod: null,
    dataMonths: months.length,
    revenue: { value: totals.revenue, change: null },
    expenses: { value: totals.expenses, change: null },
    profit: { value: totals.profit, change: null },
    margin: { value: totals.revenue ? (totals.profit / totals.revenue) * 100 : 0, change: null },
    cashflow: { value: totals.cashflow, change: null },
  };
}

export async function categoryBreakdown(
  businessId: string,
  direction: "credit" | "debit",
  from?: Date,
  to?: Date
): Promise<CategorySlice[]> {
  const match: Record<string, unknown> = { businessId: objectId(businessId), direction };
  if (from || to) {
    match.date = {};
    if (from) (match.date as Record<string, unknown>).$gte = from;
    if (to) (match.date as Record<string, unknown>).$lte = to;
  }
  return Transaction.aggregate<CategorySlice>([
    { $match: match },
    { $group: { _id: { category: "$category", subcategory: "$subcategory" }, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
    { $project: { _id: 0, category: "$_id.category", subcategory: "$_id.subcategory", total: 1, count: 1 } },
  ]);
}

function throughPeriod(months: MonthPoint[], period?: string): MonthPoint[] {
  if (!period) return months;
  const index = months.findIndex((month) => month.period === period);
  return index >= 0 ? months.slice(0, index + 1) : [];
}

function sliceLabel(slice: CategorySlice): string {
  return slice.subcategory || slice.category || "other";
}

export async function getRisks(businessId: string, period?: string): Promise<RiskOrOpportunity[]> {
  const months = throughPeriod(await monthlyTotals(businessId), period);
  const risks: RiskOrOpportunity[] = [];
  if (months.length < 2) return risks;

  const cur = months[months.length - 1];
  const prev = months[months.length - 2];

  const revenueChanges = months.slice(1).map((m, i) => m.revenue < months[i].revenue);
  const revDecline = trailingStreak(revenueChanges, Boolean);
  if (revDecline >= 2) {
    risks.push({
      id: "revenue-decline",
      type: "revenue_decline",
      title: "Revenue is declining",
      summary: `Revenue has fallen for ${revDecline} consecutive month(s).`,
      severity: "high",
      evidence: [
        { label: "Current revenue", value: formatCurrency(cur.revenue) },
        { label: "Previous revenue", value: formatCurrency(prev.revenue) },
      ],
    });
  }

  const expGrowth = pctChange(cur.expenses, prev.expenses) ?? 0;
  const revGrowth = pctChange(cur.revenue, prev.revenue) ?? 0;
  if (expGrowth - revGrowth > 10) {
    const expensesAreGrowing = expGrowth > 0;
    risks.push({
      id: "expense-acceleration",
      type: "expense_acceleration",
      title: expensesAreGrowing ? "Expense growth is outpacing revenue" : "Revenue is falling faster than expenses",
      summary: `Expenses changed ${expGrowth.toFixed(1)}% while revenue changed ${revGrowth.toFixed(1)}% month-over-month.`,
      severity: "high",
      evidence: [
        { label: "Expense growth", value: formatPercent(expGrowth) },
        { label: "Revenue growth", value: formatPercent(revGrowth) },
      ],
    });
  }

  if (prev && cur.margin < prev.margin - 5) {
    risks.push({
      id: "margin-decline",
      type: "margin_decline",
      title: "Margin is shrinking",
      summary: `Net margin fell from ${prev.margin.toFixed(1)}% to ${cur.margin.toFixed(1)}%.`,
      severity: "medium",
      evidence: [
        { label: "Current margin", value: formatPercent(cur.margin) },
        { label: "Previous margin", value: formatPercent(prev.margin) },
      ],
    });
  }

  const negativeMonths = trailingStreak(months, (month) => month.profit < 0);
  if (negativeMonths >= 2) {
    risks.push({
      id: "cashflow-risk",
      type: "negative_cashflow",
      title: "Sustained negative cash flow",
      summary: `Profit has been negative for ${negativeMonths} month(s) in a row.`,
      severity: "high",
      evidence: [
        { label: "Current profit", value: formatCurrency(cur.profit) },
        { label: "Consecutive negative months", value: String(negativeMonths) },
      ],
    });
  }

  const currentRange = periodBounds(cur.period);
  const expenseSlices = await categoryBreakdown(businessId, "debit", currentRange.from, currentRange.to);
  const totalExpense = expenseSlices.reduce((s, c) => s + c.total, 0);
  const top = expenseSlices[0];
  if (top && totalExpense && top.total / totalExpense > 0.6) {
    risks.push({
      id: "concentration-risk",
      type: "concentration",
      title: "High expense concentration",
      summary: `"${sliceLabel(top)}" makes up ${((top.total / totalExpense) * 100).toFixed(0)}% of expenses.`,
      severity: "medium",
      evidence: [
        { label: "Top subcategory", value: sliceLabel(top) },
        { label: "Share of expenses", value: formatPercent((top.total / totalExpense) * 100) },
      ],
    });
  }

  return risks;
}

export async function getOpportunities(
  businessId: string,
  period?: string
): Promise<RiskOrOpportunity[]> {
  const months = throughPeriod(await monthlyTotals(businessId), period);
  const opportunities: RiskOrOpportunity[] = [];
  if (months.length < 2) return opportunities;

  const cur = months[months.length - 1];
  const prev = months[months.length - 2];
  const previousRange = periodBounds(prev.period);
  const currentRange = periodBounds(cur.period);

  const prevRevenue = await categoryBreakdown(businessId, "credit", previousRange.from, previousRange.to);
  const curRevenue = await categoryBreakdown(businessId, "credit", currentRange.from, currentRange.to);

  const prevMap = new Map(prevRevenue.map((c) => [sliceLabel(c), c.total]));
  let bestGrowth: { category: string; growth: number } | null = null;
  for (const c of curRevenue) {
    const label = sliceLabel(c);
    const before = prevMap.get(label) ?? 0;
    const growth = before ? ((c.total - before) / before) * 100 : null;
    if (growth && (!bestGrowth || growth > bestGrowth.growth)) {
      bestGrowth = { category: label, growth };
    }
  }
  if (bestGrowth && bestGrowth.growth > 0) {
    opportunities.push({
      id: "high-growth-category",
      type: "high_growth_category",
      title: `"${bestGrowth.category}" is growing fast`,
      summary: `${bestGrowth.category} grew ${bestGrowth.growth.toFixed(1)}% month-over-month.`,
      severity: "low",
      evidence: [
        { label: "Category", value: bestGrowth.category },
        { label: "Growth", value: formatPercent(bestGrowth.growth) },
      ],
    });
  }

  const expenseSlices = await categoryBreakdown(businessId, "debit", currentRange.from, currentRange.to);
  const totalExpense = expenseSlices.reduce((s, c) => s + c.total, 0);
  if (totalExpense && cur.margin > prev.margin) {
    opportunities.push({
      id: "improving-margin",
      type: "improving_margin",
      title: "Margin is improving",
      summary: `Net margin improved from ${prev.margin.toFixed(1)}% to ${cur.margin.toFixed(1)}%.`,
      severity: "low",
      evidence: [
        { label: "Previous margin", value: formatPercent(prev.margin) },
        { label: "Current margin", value: formatPercent(cur.margin) },
      ],
    });
  }

  if (expenseSlices[0]) {
    const top = expenseSlices[0];
    const label = sliceLabel(top);
    opportunities.push({
      id: "cost-review",
      type: "cost_reduction",
      title: `Review "${label}" spending`,
      summary: `"${label}" is your largest expense at ${formatCompact(top.total)}.`,
      severity: "medium",
      evidence: [
        { label: "Largest expense", value: label },
        { label: "Amount", value: formatCurrency(top.total) },
      ],
    });
  }

  return opportunities;
}

export async function recentTransactions(businessId: string, limit = 20) {
  return Transaction.find({ businessId }).sort({ date: -1 }).limit(limit).lean();
}

export async function transactionCount(businessId: string): Promise<number> {
  return Transaction.countDocuments({ businessId });
}
