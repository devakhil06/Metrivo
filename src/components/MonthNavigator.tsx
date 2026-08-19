"use client";

import { monthLabel } from "@/lib/format";

interface Props {
  months: string[];
  value: string | null;
  onChange: (month: string | null) => void;
  allowAllTime?: boolean;
}

export default function MonthNavigator({ months, value, onChange, allowAllTime }: Props) {
  if (months.length === 0) return null;
  const idx = value ? months.indexOf(value) : -1;
  const canPrev = value && idx > 0;
  const canNext = value && idx >= 0 && idx < months.length - 1;

  return (
    <div className="flex items-center gap-2">
      <button
        className="btn-secondary min-h-9 px-2.5 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!canPrev}
        onClick={() => onChange(months[idx - 1])}
        aria-label="Previous month"
      >
        ‹
      </button>
      <select
        className="input min-h-9 w-auto px-2.5 py-1 text-xs"
        value={value || ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        {allowAllTime && <option value="">All time</option>}
        {months.map((m) => (
          <option key={m} value={m}>
            {monthLabel(m)}
          </option>
        ))}
      </select>
      <button
        className="btn-secondary min-h-9 px-2.5 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!canNext}
        onClick={() => onChange(months[idx + 1])}
        aria-label="Next month"
      >
        ›
      </button>
    </div>
  );
}
