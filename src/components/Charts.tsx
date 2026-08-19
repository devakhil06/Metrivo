"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
  Area,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
} from "recharts";
import { formatCompact, monthLabel } from "@/lib/format";
import type { MonthPoint, CategorySlice, ForecastPoint, BreakdownSlice } from "@/lib/types";

const axis = { fontSize: 11, fill: "#718579", fontFamily: "Inter, sans-serif" };

interface TooltipEntry {
  dataKey?: string | number;
  name?: string;
  value?: number | string | [number, number];
  payload?: { name?: string; displayValue?: number };
}

function MoneyTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[#102018] px-3 py-2 text-xs text-[#dce8e0] shadow-2xl">
      <div className="mb-1 font-medium">{monthLabel(String(label))}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
          <span className="text-slate-600">{p.name}</span>
          <span className="font-semibold tabular-nums">{formatCompact(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
}

function BarTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[#102018] px-3 py-2 text-xs text-[#dce8e0] shadow-2xl">
      <span className="text-slate-600">{row.payload?.name}: </span>
      <span className="font-semibold tabular-nums">{formatCompact(Number(row.value))}</span>
    </div>
  );
}

function WaterfallTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
  if (!active || !payload?.length) return null;
  const row = payload.find((entry) => entry.payload?.displayValue != null)?.payload;
  if (!row || row.displayValue == null) return null;
  const sign = row.displayValue < 0 ? "−" : "";
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[#102018] px-3 py-2 text-xs text-[#dce8e0] shadow-2xl">
      <span className="text-slate-600">{row.name}: </span>
      <span className="font-semibold tabular-nums">{sign}{formatCompact(Math.abs(row.displayValue))}</span>
    </div>
  );
}

function readableLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function allSubcategories(data: CategorySlice[]) {
  const totals = new Map<string, number>();
  for (const item of data) {
    const key = item.subcategory || item.category || "other";
    totals.set(key, (totals.get(key) || 0) + item.total);
  }
  return Array.from(totals.entries())
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name: readableLabel(name), value }));
}

export function TrendChart({ data }: { data: MonthPoint[] }) {
  const chartData = data.map((point) => ({
    ...point,
    profitGain: point.profit >= 0 ? point.profit : null,
    profitLoss: point.profit < 0 ? point.profit : null,
  }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(223,255,230,.08)" />
        <XAxis dataKey="period" tickFormatter={monthLabel} tick={axis} />
        <YAxis tickFormatter={(v) => formatCompact(Number(v))} tick={axis} width={70} />
        <Tooltip content={<MoneyTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#9bff76" strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#5af0da" strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="profitGain" name="Profit" stroke="#77d96a" strokeWidth={2.5} strokeDasharray="4 4" dot={{ r: 2.5 }} connectNulls={false} />
        <Line type="monotone" dataKey="profitLoss" name="Loss" stroke="#ff8f6b" strokeWidth={2.5} strokeDasharray="4 4" dot={{ r: 2.5 }} connectNulls={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CashflowChart({ data }: { data: MonthPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(223,255,230,.08)" />
        <XAxis dataKey="period" tickFormatter={monthLabel} tick={axis} />
        <YAxis tickFormatter={(v) => formatCompact(Number(v))} tick={axis} width={70} />
        <Tooltip content={<MoneyTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="revenue" name="Inflow" fill="#9bff76" radius={[4, 4, 0, 0]} barSize={16} />
        <Bar dataKey="expenses" name="Outflow" fill="#5af0da" radius={[4, 4, 0, 0]} barSize={16} />
        <Bar dataKey="profit" name="Net" radius={[4, 4, 0, 0]} barSize={16}>
          {data.map((point) => <Cell key={point.period} fill={point.profit >= 0 ? "#9bff76" : "#ff8f6b"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function WaterfallChart({
  revenue,
  expenses,
  profit,
  revenueBreakdown = [],
  expenseBreakdown = [],
}: {
  revenue: number;
  expenses: number;
  profit: number;
  revenueBreakdown?: CategorySlice[];
  expenseBreakdown?: CategorySlice[];
}) {
  const revenueRows = allSubcategories(revenueBreakdown);
  const expenseRows = allSubcategories(expenseBreakdown);
  if (!revenueRows.length && revenue) revenueRows.push({ name: "Revenue", value: revenue });
  if (!expenseRows.length && expenses) expenseRows.push({ name: "Expenses", value: expenses });

  let running = 0;
  const data = revenueRows.map((row, index) => {
    const next = running + row.value;
    const item = { name: row.name, range: [running, next], displayValue: row.value, color: index % 2 ? "#5af0da" : "#9bff76" };
    running = next;
    return item;
  });
  expenseRows.forEach((row, index) => {
    const next = running - row.value;
    data.push({
      name: row.name,
      range: [Math.min(next, running), Math.max(next, running)],
      displayValue: -row.value,
      color: index % 2 ? "#ffb06f" : "#ff8f6b",
    });
    running = next;
  });
  data.push({
    name: profit >= 0 ? "Net profit" : "Net loss",
    range: [Math.min(0, profit), Math.max(0, profit)],
    displayValue: profit,
    color: profit >= 0 ? "#9bff76" : "#ff8f6b",
  });
  const chartWidth = Math.max(760, data.length * 104);

  return (
    <div className="overflow-x-auto pb-2">
      <div style={{ width: chartWidth, height: 330 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 8, left: 8, bottom: 52 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(223,255,230,.08)" vertical={false} />
            <XAxis dataKey="name" tick={{ ...axis, fontSize: 10 }} angle={-24} textAnchor="end" interval={0} height={66} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(value) => formatCompact(Number(value))} tick={axis} width={68} axisLine={false} tickLine={false} />
            <Tooltip content={<WaterfallTooltip />} cursor={{ fill: "rgba(255,255,255,.025)" }} />
            <ReferenceLine y={0} stroke="#718579" />
            <Bar dataKey="range" barSize={48} radius={[5, 5, 5, 5]}>
              {data.map((item, index) => <Cell key={`${item.name}-${index}`} fill={item.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function BreakdownChart({
  data,
  groupBy = "category",
  color = "#9bff76",
}: {
  data: CategorySlice[];
  groupBy?: "category" | "subcategory";
  color?: string;
}) {
  const totals = new Map<string, number>();
  for (const item of data) {
    const key = item[groupBy] || item.category || "other";
    totals.set(key, (totals.get(key) || 0) + item.total);
  }
  const rows = Array.from(totals.entries())
    .map(([name, value]) => ({ name: readableLabel(name), value }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);
  const chartHeight = Math.max(240, rows.length * 34 + 24);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(223,255,230,.08)" horizontal={false} />
        <XAxis type="number" tickFormatter={(v) => formatCompact(Number(v))} tick={axis} />
        <YAxis type="category" dataKey="name" tick={axis} width={110} />
        <Tooltip content={<BarTooltip />} />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const SHADES = ["#9bff76", "#5af0da", "#75c779", "#4da98c", "#d7ea79", "#79b6a7"];

export function CategoryDonut({ data }: { data: BreakdownSlice[] }) {
  const rows = [...data]
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((item) => ({ name: readableLabel(item.key), value: item.total }));
  const chartHeight = Math.max(280, 150 + Math.ceil(rows.length / 3) * 28);
  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <PieChart>
        <Pie data={rows} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2} stroke="#102018">
          {rows.map((_, i) => (
            <Cell key={i} fill={SHADES[i % SHADES.length]} />
          ))}
        </Pie>
        <Tooltip content={<BarTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ForecastChart({ history, forecast }: { history: MonthPoint[]; forecast: ForecastPoint[] }) {
  const lastActual = history.length ? history[history.length - 1].revenue : 0;
  const data: Array<{
    period: string;
    actual: number | null;
    forecast: number | null;
    band: [number | null, number | null];
  }> = [
    ...history.map((m) => ({ period: m.period, actual: m.revenue, forecast: null as number | null, band: [null, null] as [number | null, number | null] })),
    ...forecast.map((f) => ({ period: f.period, actual: null as number | null, forecast: f.value, band: [f.lower, f.upper] as [number | null, number | null] })),
  ];
  if (history.length && forecast.length) {
    data[history.length] = { ...data[history.length], actual: lastActual };
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(223,255,230,.08)" />
        <XAxis dataKey="period" tickFormatter={monthLabel} tick={axis} />
        <YAxis tickFormatter={(v) => formatCompact(Number(v))} tick={axis} width={70} />
        <Tooltip content={<MoneyTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="band" name="Range" stroke="none" fill="rgba(155,255,118,.08)" fillOpacity={1} />
        <Line type="monotone" dataKey="actual" name="Actual" stroke="#9bff76" strokeWidth={2.5} dot={false} connectNulls />
        <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#5af0da" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 2 }} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
