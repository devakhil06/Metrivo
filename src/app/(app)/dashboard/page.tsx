"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import KpiCard from "@/components/KpiCard";
import MonthNavigator from "@/components/MonthNavigator";
import { TrendChart, BreakdownChart, ForecastChart, WaterfallChart } from "@/components/Charts";
import { monthLabel } from "@/lib/format";
import type { OverviewResponse, MonthPoint, CategorySlice, AnalyticsDoc } from "@/lib/types";
import { apiFetch } from "@/lib/client-fetch";

export default function DashboardPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [trends, setTrends] = useState<MonthPoint[]>([]);
  const [revenue, setRevenue] = useState<CategorySlice[]>([]);
  const [expenses, setExpenses] = useState<CategorySlice[]>([]);
  const [full, setFull] = useState<AnalyticsDoc | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [months, setMonths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const monthRef = useRef<string | null>();

  const load = useCallback(async (selected?: string | null) => {
    setLoading(true);
    const t = await apiFetch("/api/analytics/trends?allTime=true", { cache: "no-store" }).then((r) => r.json());
    const available = (t.months || []).map((point: MonthPoint) => point.period);
    const effectiveMonth =
      selected === undefined
        ? available.at(-1) || null
        : selected === null
          ? null
          : available.includes(selected)
            ? selected
            : available.at(-1) || null;
    const q = effectiveMonth ? `?month=${effectiveMonth}` : "?allTime=true";
    const [o, b, f] = await Promise.all([
      apiFetch(`/api/analytics/overview${q}`, { cache: "no-store" }).then((r) => r.json()),
      apiFetch(`/api/analytics/breakdown${q}`, { cache: "no-store" }).then((r) => r.json()),
      apiFetch("/api/analytics/full", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => d.analytics || null)
        .catch(() => null),
    ]);
    setData(o);
    setTrends(effectiveMonth ? (t.months || []).slice(-12) : t.months || []);
    setMonths(available);
    monthRef.current = effectiveMonth;
    setMonth(effectiveMonth);
    setRevenue(b.revenue || []);
    setExpenses(b.expenses || []);
    setFull(f);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const onFocus = () => {
      if (monthRef.current !== undefined) load(monthRef.current);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load(month);
    setRefreshing(false);
  }

  async function selectMonth(m: string | null) {
    setMonth(m);
    await load(m);
  }

  if (loading) return <div className="empty-state"><span className="auth-kicker">Assembling your data</span><p className="mt-4 text-sm text-neutral-500">Loading your financial picture…</p></div>;

  if (!data?.business) {
    return (
      <div className="empty-state">
        <p className="mb-4 text-sm text-neutral-600">Create your business profile to get started.</p>
        <Link href="/onboarding" className="btn-primary">Set up business</Link>
      </div>
    );
  }

  const o = data.overview;

  if (!o) {
    return (
      <div className="empty-state">
        <p className="mb-4 text-sm text-neutral-600">
          No transactions yet. Upload a statement or load sample data.
        </p>
        <Link href="/upload" className="btn-primary">Upload data</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 lg:flex-row">
        <div>
          <p className="auth-kicker mb-3">Financial overview</p>
          <h1 className="text-[clamp(32px,4vw,48px)]">{data.business.name}</h1>
          <p className="mt-2 text-sm text-neutral-500">
            {o.period === "all-time" ? "All time" : monthLabel(o.period)} · {o.dataMonths} month(s) of data
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthNavigator months={months} value={month} onChange={selectMonth} allowAllTime />
          <button className="btn-secondary" onClick={refresh} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {month && (
        <p className="text-sm text-neutral-500">
          Showing {monthLabel(month)} — KPIs and breakdowns are filtered to this month.
        </p>
      )}
      {!month && (
        <p className="text-sm text-neutral-500">
          Showing all available data — KPIs, breakdowns, and trends cover the full period.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Revenue" value={o.revenue.value} change={o.revenue.change} sparkline={trends.map((point) => point.revenue)} color="#9bff76" />
        <KpiCard label="Expenses" value={o.expenses.value} change={o.expenses.change} sparkline={trends.map((point) => point.expenses)} color="#5af0da" />
        <KpiCard label="Profit" value={o.profit.value} change={o.profit.change} sparkline={trends.map((point) => point.profit)} color="#9bff76" valueTone="profit-loss" />
        <KpiCard label="Margin" value={o.margin.value} change={o.margin.change} suffix="%" sparkline={trends.map((point) => point.margin)} color="#75c779" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="card">
          <div className="mb-1 flex items-center justify-between"><h2>Financial trends</h2><span className="status-success">Live</span></div>
          <p className="mb-4 text-xs text-slate-500">Revenue, expenses and profit over time</p>
          <TrendChart data={trends} />
        </div>
        <div className="card">
          <div className="mb-1 flex items-center justify-between"><h2>Profit bridge</h2><span className="status-info">Evidence</span></div>
          <p className="mb-4 text-xs text-slate-500">How sales, inventory, utilities and other activity produce net profit</p>
          <WaterfallChart
            revenue={o.revenue.value}
            expenses={o.expenses.value}
            profit={o.profit.value}
            revenueBreakdown={revenue}
            expenseBreakdown={expenses}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="card">
          <h2 className="mb-1">Expenses by subcategory</h2>
          <p className="mb-4 text-xs text-slate-500">Inventory, utilities, payroll and other spending areas</p>
          <BreakdownChart data={expenses} groupBy="subcategory" color="#5af0da" />
        </div>
        <div className="card">
          <h2 className="mb-1">Revenue by subcategory</h2>
          <p className="mb-4 text-xs text-slate-500">Sales and other income sources</p>
          <BreakdownChart data={revenue} groupBy="subcategory" color="#9bff76" />
        </div>
      </div>

      {full && full.forecast?.revenue?.length > 0 && (
        <div className="card">
          <h2 className="mb-4">Revenue forecast</h2>
          <ForecastChart history={full.trends.monthly} forecast={full.forecast.revenue} />
        </div>
      )}

      {full && full.anomalies?.length > 0 && (
        <div className="card">
          <h2 className="mb-3">Anomalies</h2>
          <ul className="space-y-2">
            {full.anomalies.map((a, i) => (
              <li key={i} className="flex items-center justify-between rounded-md border border-neutral-200 p-3 text-sm">
                <span className="font-medium capitalize">{a.metric}</span>
                <span className="text-neutral-500">{monthLabel(a.period)}</span>
                <span className="font-medium">
                  {a.value > a.expected ? "▲ high" : "▼ low"} vs expected
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="card">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2>Risks</h2>
            <span className="text-[11px] font-medium text-slate-400">
              {data.insightSource === "nvidia" ? "NVIDIA AI · live KPI analysis" : "Live KPI analysis"}
            </span>
          </div>
          {data.risks.length ? (
            <ul className="space-y-3">
              {data.risks.map((r) => (
                  <li key={r.id} className="rounded-xl border border-[rgba(255,143,107,.14)] bg-[rgba(255,143,107,.045)] p-3">
                  <div className="text-sm font-medium">{r.title}</div>
                  <p className="text-sm text-neutral-600">{r.summary}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-400">No risks detected.</p>
          )}
        </div>
        <div className="card">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2>Opportunities</h2>
            <span className="text-[11px] font-medium text-slate-400">
              {data.insightSource === "nvidia" ? "NVIDIA AI · live KPI analysis" : "Live KPI analysis"}
            </span>
          </div>
          {data.opportunities.length ? (
            <ul className="space-y-3">
              {data.opportunities.map((o) => (
                  <li key={o.id} className="rounded-xl border border-[rgba(155,255,118,.14)] bg-[rgba(155,255,118,.045)] p-3">
                  <div className="text-sm font-medium">{o.title}</div>
                  <p className="text-sm text-neutral-600">{o.summary}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-400">No opportunities detected.</p>
          )}
        </div>
      </div>
    </div>
  );
}
