import { connectDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getBusinessForUser, json, handleError } from "@/lib/api";
import { getAllTimeOverview, getOverview, getRisks, getOpportunities, transactionCount } from "@/lib/analytics";
import { getNvidiaKpiInsights } from "@/lib/kpi-insights";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    await connectDb();
    const business = await getBusinessForUser(user._id.toString());
    if (!business) return json({ business: null, overview: null, risks: [], opportunities: [], total: 0 });

    const url = new URL(req.url);
    const month = url.searchParams.get("month");
    const allTime = url.searchParams.get("allTime") === "true";
    if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return json({ error: "Invalid month" }, 400);
    if (month && allTime) return json({ error: "Choose either a month or all time" }, 400);

    const businessId = business._id.toString();
    const [overview, baseRisks, baseOpportunities, total] = await Promise.all([
      allTime ? getAllTimeOverview(businessId) : getOverview(businessId, month || undefined),
      getRisks(businessId, month || undefined),
      getOpportunities(businessId, month || undefined),
      transactionCount(businessId),
    ]);

    const insights = overview
      ? await getNvidiaKpiInsights({
          businessId,
          currency: business.currency || "INR",
          overview,
          risks: baseRisks,
          opportunities: baseOpportunities,
        })
      : { risks: baseRisks, opportunities: baseOpportunities, source: "deterministic" as const };

    return json({ business, overview, risks: insights.risks, opportunities: insights.opportunities, insightSource: insights.source, total });
  } catch (err) {
    return handleError(err);
  }
}
