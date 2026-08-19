import { createHash } from "crypto";

export function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanAmount(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const NOISE_PATTERNS = [
  /^(total|grand total|net total|sub ?total)\b/i,
  /^(opening|closing|available)\s*balance/i,
  /balance\s+(b\/f|c\/f|brought|carried)/i,
  /^(statement|summary|account statement|transactions? ?summary)\b/i,
  /^page\s*\d+/i,
  /^(as on|as at|generated (on|at)|date\s*:)/i,
];

export function isNoiseRow(description: string): boolean {
  const d = cleanText(description);
  if (!d) return false;
  return NOISE_PATTERNS.some((re) => re.test(d));
}

export function normalizedDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function dedupKey(
  businessId: string,
  date: Date,
  amount: number,
  direction: string,
  description: string
): string {
  const raw = [
    businessId,
    normalizedDateKey(date),
    cleanAmount(amount).toFixed(2),
    direction,
    cleanText(description).toLowerCase(),
  ].join("|");
  return createHash("md5").update(raw).digest("hex");
}
