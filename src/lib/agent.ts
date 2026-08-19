import OpenAI from "openai";
import { type IBusiness } from "./models";
import {
  getOverview,
  monthlyTotals,
  categoryBreakdown,
  getRisks,
  getOpportunities,
} from "./analytics";
import { formatCurrency } from "./format";

export interface AgentEvent {
  type: "status" | "tool" | "delta" | "done" | "error";
  message?: string;
  name?: string;
  args?: string;
  content?: string;
}

function provider() {
  const baseURL =
    process.env.OPENROUTER_BASE_URL ||
    process.env.DEEPSEEK_BASE_URL ||
    "https://api.deepseek.com";
  const isOpenRouter =
    !!process.env.OPENROUTER_API_KEY || baseURL.includes("openrouter.ai");
  if (isOpenRouter) {
    return {
      apiKey: process.env.OPENROUTER_API_KEY || process.env.DEEPSEEK_API_KEY || "",
      baseURL: baseURL.includes("openrouter.ai") ? baseURL : "https://openrouter.ai/api/v1",
      model: process.env.OPENROUTER_MODEL || process.env.DEEPSEEK_MODEL || "deepseek/deepseek-chat",
      headers: { "HTTP-Referer": "https://metrivo.local", "X-Title": "Metrivo" },
    };
  }
  if (process.env.DEEPSEEK_API_KEY) {
    return {
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: baseURL,
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    };
  }
  return {
    apiKey: process.env.NVIDIA_API_KEY || "",
    baseURL: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
    model: process.env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct",
  };
}

function systemPrompt(business: IBusiness | null): string {
  const profile = business
    ? `\nBusiness profile: ${business.name} (${business.businessType}, ${business.industry}, ${business.country}, currency ${business.currency}).`
    : "";
  return `You are Metrivo, a concise business analyst for a small business.${profile}

Rules:
- Only state numbers that come from the tools you call. Never invent figures, transactions, benchmarks, or forecasts.
- Lead with the answer and the most relevant numbers. Include the period and currency when available.
- Default to 2-4 short sentences, but add necessary caveats or detail when accuracy requires it.
- Use simple language, distinguish facts from suggestions, and be explicit when data is insufficient.
- Use the tools to answer questions about revenue, expenses, profit, cash flow, trends, risks and opportunities.
- End with one practical next step when it is genuinely useful.`;
}

interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

async function latestRange(businessId: string) {
  const months = await monthlyTotals(businessId);
  const last = months[months.length - 1];
  if (!last) return {};
  const [year, month] = last.period.split("-").map(Number);
  return {
    from: new Date(Date.UTC(year, month - 1, 1)),
    to: new Date(Date.UTC(year, month, 1) - 1),
  };
}

function toolsFor(businessId: string, business: IBusiness | null): ToolDef[] {
  return [
    {
      name: "get_overview",
      description: "Get current-month revenue, expenses, profit, margin and cash flow with change vs the previous month.",
      parameters: { type: "object", properties: {} },
      execute: () => getOverview(businessId),
    },
    {
      name: "get_trends",
      description: "Get month-by-month revenue, expenses, profit and margin for the recent months.",
      parameters: { type: "object", properties: { months: { type: "number" } } },
      execute: async (args) => {
        const months = await monthlyTotals(businessId);
        const n = typeof args.months === "number" ? args.months : 12;
        return months.slice(-n);
      },
    },
    {
      name: "get_expense_breakdown",
      description: "Get expenses grouped by category for the latest month.",
      parameters: { type: "object", properties: {} },
      execute: async () => {
        const { from, to } = await latestRange(businessId);
        return categoryBreakdown(businessId, "debit", from, to);
      },
    },
    {
      name: "get_revenue_breakdown",
      description: "Get revenue grouped by category for the latest month.",
      parameters: { type: "object", properties: {} },
      execute: async () => {
        const { from, to } = await latestRange(businessId);
        return categoryBreakdown(businessId, "credit", from, to);
      },
    },
    {
      name: "get_risks",
      description: "Get currently detected business risks with evidence.",
      parameters: { type: "object", properties: {} },
      execute: () => getRisks(businessId),
    },
    {
      name: "get_opportunities",
      description: "Get currently detected business opportunities with evidence.",
      parameters: { type: "object", properties: {} },
      execute: () => getOpportunities(businessId),
    },
    {
      name: "get_business_profile",
      description: "Get the business onboarding profile.",
      parameters: { type: "object", properties: {} },
      execute: () => Promise.resolve(business),
    },
  ];
}

const TOOL_STATUS: Record<string, string> = {
  get_overview: "Reviewing your latest numbers…",
  get_trends: "Looking at monthly trends…",
  get_expense_breakdown: "Breaking down expenses…",
  get_revenue_breakdown: "Breaking down revenue…",
  get_risks: "Checking for risks…",
  get_opportunities: "Looking for opportunities…",
  get_business_profile: "Reading your business profile…",
};

async function fallbackAnswer(businessId: string): Promise<string> {
  const [overview, risks, opportunities] = await Promise.all([
    getOverview(businessId),
    getRisks(businessId),
    getOpportunities(businessId),
  ]);
  if (!overview) return "I don't have any transaction data yet. Upload a statement and I can analyze it.";

  const lines: string[] = [];
  lines.push(
    `Here's a quick snapshot of your latest month (${overview.period}): revenue ${formatCurrency(
      overview.revenue.value
    )}, expenses ${formatCurrency(overview.expenses.value)}, and a profit of ${formatCurrency(
      overview.profit.value
    )} (margin ${overview.margin.value.toFixed(1)}%).`
  );
  if (risks.length) {
    lines.push("\nTop risks to watch:");
    risks.slice(0, 3).forEach((r) => lines.push(`- ${r.title}: ${r.summary}`));
  }
  if (opportunities.length) {
    lines.push("\nOpportunities:");
    opportunities.slice(0, 3).forEach((o) => lines.push(`- ${o.title}: ${o.summary}`));
  }
  lines.push(
    "\n(Note: I generated this summary from your data without the AI model, so it may be brief. Ask me a specific question next.)"
  );
  return lines.join("\n");
}

function isSnapshotQuestion(question: string): boolean {
  const normalized = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const snapshotPattern =
    /^(give me |show me |what is |what s )?(a |my )?(business )?(overview|summary|snapshot)$/;
  return snapshotPattern.test(normalized);
}

function boundedHistory(history: { role: "user" | "assistant"; content: string }[]) {
  const selected: typeof history = [];
  let characters = 0;
  for (let i = history.length - 1; i >= 0 && selected.length < 12; i--) {
    const message = history[i];
    if (characters + message.content.length > 12_000) break;
    selected.unshift(message);
    characters += message.content.length;
  }
  return selected;
}

export async function runAnalyst(opts: {
  businessId: string;
  business: IBusiness | null;
  question: string;
  history: { role: "user" | "assistant"; content: string }[];
  emit: (event: AgentEvent) => void;
}): Promise<string> {
  const { apiKey, baseURL, model, headers } = provider();

  if (!apiKey || isSnapshotQuestion(opts.question)) {
    const reason = apiKey
      ? "Building a verified snapshot from your data…"
      : "No AI key configured — building a summary from your data…";
    opts.emit({ type: "status", message: reason });
    const text = await fallbackAnswer(opts.businessId);
    opts.emit({ type: "delta", content: text });
    opts.emit({ type: "done" });
    return text;
  }

  const c = new OpenAI({ apiKey, baseURL, defaultHeaders: headers });

  const defs = toolsFor(opts.businessId, opts.business);
  const schemas = defs.map((d) => ({
    type: "function" as const,
    function: { name: d.name, description: d.description, parameters: d.parameters },
  }));
  const byName = new Map(defs.map((d) => [d.name, d]));

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt(opts.business) },
    ...boundedHistory(opts.history).map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user", content: opts.question },
  ];

  let delivered = "";
  try {
    for (let i = 0; i < 6; i++) {
      const stream = await c.chat.completions.create({
        model,
        messages,
        tools: schemas,
        temperature: 0.3,
        stream: true,
      });

      const pendingCalls = new Map<number, { id: string; name: string; arguments: string }>();
      let content = "";
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) {
          content += delta.content;
          delivered += delta.content;
          opts.emit({ type: "delta", content: delta.content });
        }
        for (const call of delta?.tool_calls || []) {
          const current = pendingCalls.get(call.index) || { id: "", name: "", arguments: "" };
          if (call.id) current.id = call.id;
          if (call.function?.name) current.name += call.function.name;
          if (call.function?.arguments) current.arguments += call.function.arguments;
          pendingCalls.set(call.index, current);
        }
      }

      const calls = Array.from(pendingCalls.values()).filter((call) => call.id && call.name);

      if (calls.length > 0) {
        messages.push({
          role: "assistant",
          content: content || null,
          tool_calls: calls.map((call) => ({
            id: call.id,
            type: "function" as const,
            function: { name: call.name, arguments: call.arguments },
          })),
        });

        const results = await Promise.all(
          calls.map(async (call) => {
            const name = call.name;
            opts.emit({ type: "status", message: TOOL_STATUS[name] ?? `Using ${name}…` });
            opts.emit({ type: "tool", name, args: call.arguments });
            const tool = byName.get(name);
            let result: unknown;
            if (tool) {
              try {
                result = await tool.execute(JSON.parse(call.arguments || "{}"));
              } catch {
                result = { error: "Tool failed" };
              }
            } else {
              result = { error: `Unknown tool ${name}` };
            }
            return {
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify(result),
            } as OpenAI.ChatCompletionToolMessageParam;
          })
        );
        for (const result of results) {
          messages.push(result);
        }
        continue;
      }

      if (content) {
        opts.emit({ type: "done" });
        return delivered;
      }

      const fallback = await fallbackAnswer(opts.businessId);
      opts.emit({ type: "status", message: "The model returned no answer — showing a data summary instead…" });
      opts.emit({ type: "delta", content: fallback });
      opts.emit({ type: "done" });
      return delivered + fallback;
    }
  } catch (e) {
    console.error("Analyst provider failed", e);
    opts.emit({ type: "status", message: "AI model unavailable — showing a verified data summary instead…" });
    const fallback = await fallbackAnswer(opts.businessId);
    opts.emit({ type: "delta", content: fallback });
    opts.emit({ type: "done" });
    return delivered + fallback;
  }

  const finalFallback = await fallbackAnswer(opts.businessId);
  opts.emit({ type: "delta", content: finalFallback });
  opts.emit({ type: "done" });
  return delivered + finalFallback;
}
