"use client";

import { formatCompact, formatChange } from "@/lib/format";

export default function KpiCard({
  label,
  value,
  change,
  suffix,
  sparkline = [],
  color = "#9bff76",
  valueTone = "neutral",
}: {
  label: string;
  value: number;
  change: number | null;
  suffix?: string;
  sparkline?: number[];
  color?: string;
  valueTone?: "neutral" | "profit-loss";
}) {
  const isPercent = suffix === "%";
  const positive = change != null && change > 0;
  const negative = change != null && change < 0;
  const display = isPercent ? `${value.toFixed(2)}%` : formatCompact(value);
  const finitePoints = sparkline.filter(Number.isFinite);
  const min = finitePoints.length ? Math.min(...finitePoints) : 0;
  const max = finitePoints.length ? Math.max(...finitePoints) : 0;
  const range = max - min || 1;
  const coordinates = finitePoints.map((point, index) => {
      const x = finitePoints.length === 1 ? 48 : (index / (finitePoints.length - 1)) * 96;
      const y = 28 - ((point - min) / range) * 24;
      return { x, y, value: point };
    });
  const points = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const semanticColor = valueTone === "profit-loss"
    ? (value >= 0 ? "#9bff76" : "#ff8f6b")
    : value < 0
      ? "#ff8f6b"
      : color;
  const lastPoint = coordinates.at(-1);

  return (
    <div className="card kpi-card relative overflow-hidden">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</div>
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: semanticColor }} aria-hidden="true" />
      </div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="metric-value" style={value < 0 || valueTone === "profit-loss" ? { color: semanticColor } : undefined}>{display}</div>
          <div
            className={`mt-1 text-xs font-medium ${
              positive ? "text-emerald-600" : negative ? "text-red-600" : "text-slate-400"
            }`}
          >
            {change == null ? "—" : `${formatChange(change)}${isPercent ? " pp" : ""}`}
          </div>
        </div>
        {finitePoints.length > 1 && (
          <svg className="h-10 w-24 shrink-0" viewBox="0 0 100 32" role="img" aria-label={`${label} trend`}>
            <line x1="0" y1="28" x2="100" y2="28" stroke="rgba(223,255,230,.1)" strokeWidth="1" />
            {valueTone === "profit-loss" ? (
              coordinates.slice(1).map((point, index) => {
                const previous = coordinates[index];
                const segmentColor = point.value >= 0 && previous.value >= 0 ? "#9bff76" : "#ff8f6b";
                return <line key={index} x1={previous.x} y1={previous.y} x2={point.x} y2={point.y} stroke={segmentColor} strokeLinecap="round" strokeWidth="2.5" />;
              })
            ) : (
              <polyline points={points} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
            )}
            {lastPoint && <circle cx={lastPoint.x} cy={lastPoint.y} r="2.5" fill={lastPoint.value >= 0 ? semanticColor : "#ff8f6b"} />}
          </svg>
        )}
      </div>
    </div>
  );
}
