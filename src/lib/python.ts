import type { AnalyticsDoc } from "./types";

const BASE = process.env.PYTHON_API_URL || "http://localhost:8000";

function serviceHeaders(headers?: HeadersInit): Headers {
  const result = new Headers(headers);
  const token = process.env.ANALYTICS_SERVICE_TOKEN;
  if (token) result.set("Authorization", `Bearer ${token}`);
  return result;
}

async function call(path: string, init?: RequestInit): Promise<AnalyticsDoc | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: serviceHeaders(init?.headers),
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as AnalyticsDoc;
  } catch {
    return null;
  }
}

export async function getAnalytics(businessId: string, month?: string): Promise<AnalyticsDoc | null> {
  return call(`/analytics/${businessId}${month ? `?month=${month}` : ""}`);
}

export async function analyzeBusiness(businessId: string): Promise<AnalyticsDoc | null> {
  return call(`/analyze/${businessId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export interface PythonParsedTransaction {
  date: string;
  amount: number;
  direction: "credit" | "debit";
  rawType?: string | null;
  description: string;
  paymentMethod: string | null;
}

export interface PythonParseResult {
  structure: {
    columns: string[];
    roles: Record<string, string>;
    headerRow: number;
    sample: PythonParsedTransaction[];
  };
  transactions: PythonParsedTransaction[];
  summary: {
    totalIncome: number;
    totalExpenses: number;
    incomeCount: number;
    expenseCount: number;
    unclassified: number;
    skipped: number;
  };
}

export async function parseCsv(file: File): Promise<PythonParseResult | null> {
  try {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${BASE}/parse`, {
      method: "POST",
      body: fd,
      headers: serviceHeaders(),
      signal: AbortSignal.timeout(60000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as PythonParseResult;
  } catch {
    return null;
  }
}
