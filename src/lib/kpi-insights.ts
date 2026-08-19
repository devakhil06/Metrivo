import OpenAI from "openai";
import type { Overview, RiskOrOpportunity } from "./types";

interface InsightInput {
  businessId: string;
  currency: string;
  overview: Overview;
  risks: RiskOrOpportunity[];
  opportunities: RiskOrOpportunity[];
}

export interface InsightResult {
  risks: RiskOrOpportunity[];
  opportunities: RiskOrOpportunity[];
  source: "nvidia" | "deterministic";
}

interface RankedInsight {
  sourceId?: unknown;
  action?: unknown;
}

const cache = new Map<string, { expiresAt: number; value: InsightResult }>();

function cacheKey(input: InsightInput): string {
  const { overview } = input;
  return [
    input.businessId,
    overview.period,
    overview.revenue.value,
    overview.expenses.value,
    overview.profit.value,
    overview.margin.value,
    ...input.risks.map((item) => `${item.id}:${item.summary}`),
    ...input.opportunities.map((item) => `${item.id}:${item.summary}`),
  ].join(":");
}

function fallback(input: InsightInput): InsightResult {
  return {
    risks: input.risks.slice(0, 3),
    opportunities: input.opportunities.slice(0, 3),
    source: "deterministic",
  };
}

function parseObject(content: string): Record<string, unknown> | null {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(content.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function applyRanking(
  ranked: unknown,
  candidates: RiskOrOpportunity[],
  prefix: string
): RiskOrOpportunity[] {
  if (!Array.isArray(ranked)) return [];
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const used = new Set<string>();
  const result: RiskOrOpportunity[] = [];

  for (const item of ranked.slice(0, 3) as RankedInsight[]) {
    if (typeof item?.sourceId !== "string" || used.has(item.sourceId)) continue;
    const source = byId.get(item.sourceId);
    if (!source) continue;
    used.add(item.sourceId);

    const action = typeof item.action === "string" ? item.action.trim().replace(/\s+/g, " ") : "";
    const safeAction = action && action.length <= 160 && !/\d/.test(action) ? action : "";
    result.push({
      ...source,
      id: `${prefix}-${source.id}`,
      summary: safeAction ? `${source.summary} Next: ${safeAction}` : source.summary,
    });
  }
  return result;
}

export async function getNvidiaKpiInsights(input: InsightInput): Promise<InsightResult> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey || (!input.risks.length && !input.opportunities.length)) return fallback(input);

  const key = cacheKey(input);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const client = new OpenAI({
    apiKey,
    baseURL: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
    timeout: 12_000,
    maxRetries: 1,
  });

  const payload = {
    currency: input.currency,
    period: input.overview.period,
    kpis: {
      revenue: input.overview.revenue,
      expenses: input.overview.expenses,
      profit: input.overview.profit,
      margin: input.overview.margin,
      cashflow: input.overview.cashflow,
    },
    riskCandidates: input.risks,
    opportunityCandidates: input.opportunities,
  };

  try {
    const completion = await client.chat.completions.create({
      model: process.env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct",
      temperature: 0.1,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content:
            "You rank grounded small-business KPI insights. Use only the supplied candidates and figures. Return strict JSON with risks and opportunities arrays. Each item must contain sourceId copied exactly from a candidate and a short action with no numbers. Never create a new metric or candidate.",
        },
        {
          role: "user",
          content: JSON.stringify(payload),
        },
      ],
    });

    const parsed = parseObject(completion.choices[0]?.message?.content || "");
    if (!parsed) return fallback(input);
    const risks = applyRanking(parsed.risks, input.risks, "nvidia-risk");
    const opportunities = applyRanking(parsed.opportunities, input.opportunities, "nvidia-opportunity");
    if (!risks.length && !opportunities.length) return fallback(input);
    const value: InsightResult = {
      risks: risks.length ? risks : input.risks.slice(0, 3),
      opportunities: opportunities.length ? opportunities : input.opportunities.slice(0, 3),
      source: "nvidia",
    };
    if (cache.size >= 200) cache.delete(cache.keys().next().value as string);
    cache.set(key, { expiresAt: Date.now() + 30_000, value });
    return value;
  } catch {
    return fallback(input);
  }
}
