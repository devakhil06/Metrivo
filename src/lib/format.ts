export function formatCurrency(value: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompact(value: number): string {
  if (Math.abs(value) >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (Math.abs(value) >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (Math.abs(value) >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value}`;
}

export function formatPercent(value: number, digits = 2): string {
  return `${value.toFixed(digits)}%`;
}

export function formatChange(change: number | null | undefined, digits = 2): string {
  if (change == null || !isFinite(change)) return "—";
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(digits)}%`;
}

export function monthLabel(period: string): string {
  const [y, m] = period.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-IN", {
    month: "short",
    year: "2-digit",
  });
}
