"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatCurrency, formatCompact, formatPercent, monthLabel } from "@/lib/format";
import { TrendChart, CashflowChart, CategoryDonut, ForecastChart } from "@/components/Charts";
import BusinessDataForm from "@/components/BusinessDataForm";
import MonthNavigator from "@/components/MonthNavigator";
import type { AnalyticsDoc } from "@/lib/types";
import { apiFetch } from "@/lib/client-fetch";

type Kind = "money" | "pct" | "num";

function fmt(value: number, kind: Kind) {
  if (kind === "money") return formatCurrency(value);
  if (kind === "pct") return formatPercent(value, 2);
  return new Intl.NumberFormat("en-IN").format(value);
}

function mergeBreakdowns(...groups: Array<Array<{ key: string; total: number; count: number }>>) {
  const totals = new Map<string, { total: number; count: number }>();
  for (const group of groups) {
    for (const item of group) {
      const current = totals.get(item.key) || { total: 0, count: 0 };
      current.total += item.total;
      current.count += item.count;
      totals.set(item.key, current);
    }
  }
  return Array.from(totals, ([key, value]) => ({ key, ...value })).sort((a, b) => b.total - a.total);
}

function Stat({
  label,
  value,
  kind = "money",
  hint,
  tone = "neutral",
}: {
  label: string;
  value: number | null;
  kind?: Kind;
  hint?: string;
  tone?: "neutral" | "profit-loss";
}) {
  const valueColor = tone === "profit-loss" && value != null
    ? value >= 0 ? "text-emerald-600" : "text-red-600"
    : value != null && value < 0 ? "text-red-600" : "text-slate-900";
  return (
    <div className="stat-tile">
      <div className="text-[10px] font-bold uppercase tracking-[.08em] text-neutral-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold tracking-tight tabular-nums ${valueColor}`}>
        {value == null ? <span className="text-sm font-normal text-neutral-400">Needs data</span> : fmt(value, kind)}
      </div>
      {value == null && hint && <div className="mt-1 text-[11px] text-neutral-400">{hint}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h2 className="mb-3">{title}</h2>
      {children}
    </div>
  );
}

function TopList({ data }: { data: Array<{ key: string; total: number; count: number }> }) {
  if (!data.length) return <p className="text-sm text-neutral-400">No data.</p>;
  return (
    <ul className="space-y-1.5">
      {data.map((d) => (
        <li key={d.key} className="flex items-center justify-between text-sm">
          <span className="text-neutral-600">{d.key}</span>
          <span className="font-medium">{formatCurrency(d.total)}</span>
        </li>
      ))}
    </ul>
  );
}

const TABS = [
  { id: "financial", label: "Financial" },
  { id: "sales", label: "Sales" },
  { id: "customer", label: "Customer" },
  { id: "marketing", label: "Marketing" },
  { id: "operations", label: "Operations" },
  { id: "growth", label: "Growth" },
  { id: "trends", label: "Trends" },
  { id: "forecast", label: "Forecast" },
  { id: "anomalies", label: "Anomalies" },
];

export default function MetricsPage() {
  const [doc, setDoc] = useState<AnalyticsDoc | null>(null);
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("financial");
  const [refreshing, setRefreshing] = useState(false);
  const monthRef = useRef<string | null>(null);

  const load = useCallback(async (selected: string | null) => {
    setLoading(true);
    const q = selected ? `?month=${selected}` : "";
    const [fullRes, trendsRes] = await Promise.all([
      apiFetch(`/api/analytics/full${q}`, { cache: "no-store" }).then((r) => r.json()),
      apiFetch("/api/analytics/trends", { cache: "no-store" }).then((r) => r.json()),
    ]);
    setDoc(fullRes.analytics || null);
    const available = (trendsRes.months || []).map((m: { period: string }) => m.period);
    setMonths(available);
    if (selected && !available.includes(selected)) setMonth(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    monthRef.current = month;
  }, [month]);

  useEffect(() => {
    load(null);
    const onFocus = () => load(monthRef.current);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await apiFetch("/api/analytics/full", { method: "POST" });
    await load(month);
    setRefreshing(false);
  }

  async function selectMonth(m: string | null) {
    setMonth(m);
    await load(m);
  }

  if (loading) return <div className="empty-state"><span className="auth-kicker">Calculating intelligence</span><p className="mt-4 text-sm text-neutral-500">Loading your business metrics…</p></div>;

  if (!doc || doc.months === 0) {
    return (
      <div className="empty-state">
        <p className="mb-4 text-sm text-neutral-600">
          {doc ? "No transactions to analyze yet." : "Analytics service is not running. Start the Python backend (see README)."}
        </p>
        <button className="btn-secondary" onClick={refresh} disabled={refreshing}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
    );
  }

  const nd = doc.needsData || {};
  const f = doc.financial;
  const fc = doc.forecast;
  const transactionMix = mergeBreakdowns(f.revenue.byCategory, f.expenses.byCategory);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="auth-kicker mb-3">Deep business intelligence</p>
          <h1 className="text-[clamp(32px,4vw,48px)]">Metrics</h1>
          <p className="mt-2 text-sm text-neutral-500">{doc.months} month(s) of data · {doc.currency}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthNavigator months={months} value={month} onChange={selectMonth} allowAllTime />
          <button className="btn-secondary" onClick={refresh} disabled={refreshing}>
            {refreshing ? "Recalculating…" : "Recalculate"}
          </button>
        </div>
      </div>

      {month && (
        <p className="text-sm text-neutral-500">
          Showing {monthLabel(month)} — all metrics are calculated for this month only. Select &quot;All time&quot; to
          see the full period.
        </p>
      )}

      <BusinessDataForm onSaved={refresh} />

      <div className="metric-tabs flex gap-1 overflow-x-auto p-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition ${tab === t.id ? "bg-[var(--primary)] text-[#07100c]" : "text-slate-500 hover:bg-[rgba(255,255,255,.04)] hover:text-white"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "financial" && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <Section title="Transaction mix by subcategory">
              <p className="mb-2 text-sm text-neutral-500">
                Sales, inventory, utilities, payroll and every other classified transaction area.
              </p>
              <CategoryDonut data={transactionMix} />
            </Section>
          </div>
          <Section title="Revenue">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Total revenue" value={f.revenue.total} />
              <Stat label="This month" value={f.revenue.current} />
              <Stat label="MoM growth" value={f.revenue.growthMom} kind="pct" />
              <Stat label="Avg daily" value={f.revenue.avgDaily} />
            </div>
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-medium">Revenue by subcategory</h3>
              <CategoryDonut data={f.revenue.byCategory} />
            </div>
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-medium">Top sources</h3>
              <TopList data={f.revenue.byMerchant} />
            </div>
          </Section>

          <Section title="Profitability & expenses">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Net profit" value={f.profitability.netProfit} tone="profit-loss" />
              <Stat label="Net margin" value={f.profitability.netMargin} kind="pct" tone="profit-loss" />
              <Stat label="Operating profit" value={f.profitability.operatingProfit} tone="profit-loss" />
              <Stat label="Operating margin" value={f.profitability.operatingMargin} kind="pct" tone="profit-loss" />
              <Stat label="Total expenses" value={f.expenses.total} />
              <Stat label="Expense ratio" value={f.expenses.expenseRatio} kind="pct" />
              <Stat label="Fixed expenses" value={f.expenses.fixed} />
              <Stat label="Variable expenses" value={f.expenses.variable} />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Fixed expenses are payees that appear in every available transaction month.
            </p>
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-medium">Expenses by subcategory</h3>
              <TopList data={f.expenses.byCategory} />
            </div>
          </Section>

          <Section title="Cash flow">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Cash inflow" value={f.cashflow.inflow} />
              <Stat label="Cash outflow" value={f.cashflow.outflow} />
              <Stat label="Net cash flow" value={f.cashflow.net} tone="profit-loss" />
              <Stat label="Operating cash flow" value={f.cashflow.operatingCashflow} tone="profit-loss" />
              <Stat label="Burn rate" value={f.cashflow.burnRate} />
              <Stat label="Runway (months)" value={f.cashflow.runway} hint={nd["financial.cashflow.runway"]} kind="num" />
            </div>
          </Section>

          <Section title="Financial health">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Current ratio" value={f.health.currentRatio ?? null} kind="num" hint={nd["financial.health.currentRatio"]} />
              <Stat label="Quick ratio" value={f.health.quickRatio ?? null} kind="num" hint={nd["financial.health.quickRatio"]} />
              <Stat label="Working capital" value={f.health.workingCapital ?? null} hint={nd["financial.health.workingCapital"]} tone="profit-loss" />
              <Stat label="Debt-to-equity" value={f.health.debtToEquity ?? null} kind="num" hint={nd["financial.health.debtToEquity"]} />
              <Stat label="Return on assets" value={f.health.returnOnAssets ?? null} kind="pct" hint={nd["financial.health.returnOnAssets"]} />
            </div>
          </Section>
        </div>
      )}

      {tab === "sales" && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Section title="Sales">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Units (transactions)" value={doc.sales.unitsSold} kind="num" />
              <Stat label="Average order value" value={doc.sales.aov} />
              <Stat label="MoM growth" value={doc.sales.growthMom ?? null} kind="pct" />
              <Stat label="Sales per employee" value={doc.sales.perEmployee ?? null} hint={nd["sales.perEmployee"]} />
            </div>
          </Section>
          <Section title="Top products / sources">
            <TopList data={doc.sales.byMerchant} />
          </Section>
        </div>
      )}

      {tab === "customer" && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Section title="Customer metrics">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Distinct customers" value={doc.customer.distinctMerchants ?? null} kind="num" />
              <Stat label="Repeat buyers" value={doc.customer.repeatRateProxy ?? null} kind="num" />
              <Stat label="LTV" value={doc.customer.ltv ?? null} hint={nd["customer.ltv"]} />
              <Stat label="CAC" value={doc.customer.cac ?? null} hint={nd["customer.cac"]} />
              <Stat label="Retention rate" value={doc.customer.retention ?? null} kind="pct" hint={nd["customer.retention"]} />
              <Stat label="Churn rate" value={doc.customer.churn ?? null} kind="pct" hint={nd["customer.churn"]} />
            </div>
          </Section>
        </div>
      )}

      {tab === "marketing" && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Section title="Marketing">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Marketing spend" value={doc.marketing.spend ?? null} />
              <Stat label="ROAS" value={doc.marketing.roas ?? null} kind="num" />
              <Stat label="ROI" value={doc.marketing.roi ?? null} kind="pct" hint={nd["marketing.roi"]} tone="profit-loss" />
              <Stat label="CPC" value={doc.marketing.cpc ?? null} hint={nd["marketing.cpc"]} />
              <Stat label="CTR" value={doc.marketing.ctr ?? null} kind="pct" hint={nd["marketing.ctr"]} />
            </div>
          </Section>
        </div>
      )}

      {tab === "operations" && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Section title="Operations">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Inventory expense" value={doc.operational.inventoryExpense ?? null} />
              <Stat label="Inventory turnover" value={doc.operational.inventoryTurnover ?? null} kind="num" hint={nd["operational.inventoryTurnover"]} />
            </div>
          </Section>
        </div>
      )}

      {tab === "growth" && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Section title="Growth">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Month-over-month" value={doc.growth.mom} kind="pct" tone="profit-loss" />
              <Stat label="Year-over-year" value={doc.growth.yoy} kind="pct" tone="profit-loss" />
              <Stat label="CAGR" value={doc.growth.cagr} kind="pct" tone="profit-loss" />
            </div>
          </Section>
          <Section title="Category growth">
            <ul className="space-y-1.5">
              {doc.growth.byCategory.map((c) => (
                <li key={c.category} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600">{c.category}</span>
                  <span className={`font-medium tabular-nums ${c.growth == null ? "text-slate-400" : c.growth >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {c.growth == null ? "—" : `${c.growth > 0 ? "+" : ""}${c.growth.toFixed(1)}%`}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}

      {tab === "trends" && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Section title="Monthly trends">
            <TrendChart data={doc.trends.monthly} />
          </Section>
          <Section title="Cash flow">
            <CashflowChart data={doc.trends.monthly} />
          </Section>
          <Section title="Seasonality (avg revenue by month)">
            <ul className="space-y-1.5">
              {doc.trends.seasonal.map((s) => (
                <li key={s.month} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600">
                    {new Date(2000, s.month - 1, 1).toLocaleString("en-IN", { month: "long" })}
                  </span>
                  <span className="font-medium">{formatCompact(s.average)}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}

      {tab === "forecast" && (
        <div className="space-y-6">
          <Section title="Revenue forecast">
            <ForecastChart history={doc.trends.monthly} forecast={fc.revenue} />
          </Section>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {(["revenue", "expenses", "profit"] as const).map((k) => (
              <Section key={k} title={`${k} (next ${fc[k].length} months)`}>
                <ul className="space-y-1.5">
                  {fc[k].map((p) => (
                    <li key={p.period} className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600">{monthLabel(p.period)}</span>
                      <span className={`font-medium tabular-nums ${k === "profit" ? p.value >= 0 ? "text-emerald-600" : "text-red-600" : ""}`}>
                        {formatCurrency(p.value)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            ))}
          </div>
        </div>
      )}

      {tab === "anomalies" && (
        <Section title="Detected anomalies">
          {doc.anomalies.length ? (
            <ul className="space-y-2">
              {doc.anomalies.map((a, i) => (
                <li key={i} className="flex items-center justify-between rounded-md border border-neutral-200 p-3 text-sm">
                  <div>
                    <span className="font-medium capitalize">{a.metric}</span>
                    <span className="text-neutral-500"> · {monthLabel(a.period)}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatCurrency(a.value)}</div>
                    <div className="text-xs text-neutral-500">expected {formatCurrency(a.expected)} · z={a.zScore}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-400">No anomalies detected.</p>
          )}
        </Section>
      )}
    </div>
  );
}
