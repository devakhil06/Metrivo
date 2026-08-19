import { connectDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getBusinessForUser, json, handleError } from "@/lib/api";
import { getAnalytics, analyzeBusiness } from "@/lib/python";
import { enforceRateLimit } from "@/lib/rate-limit";
import { rateLimitIdentity } from "@/lib/security";

export const dynamic = "force-dynamic";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    await connectDb();
    const business = await getBusinessForUser(user._id.toString());
    if (!business) return json({ business: null, analytics: null });

    const url = new URL(req.url);
    const month = url.searchParams.get("month");
    if (month && !MONTH_RE.test(month)) return json({ error: "Invalid month" }, 400);

    const analytics =
      month && MONTH_RE.test(month)
        ? await getAnalytics(business._id.toString(), month)
        : await getAnalytics(business._id.toString());
    return json({ business, analytics });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST() {
  try {
    const user = await requireUser();
    await connectDb();
    const business = await getBusinessForUser(user._id.toString());
    if (!business) return json({ error: "No business found" }, 404);

    await enforceRateLimit({
      scope: "analytics-recalculate",
      identity: rateLimitIdentity(business._id.toString()),
      limit: 10,
      windowMs: 5 * 60 * 1000,
    });

    const analytics = await analyzeBusiness(business._id.toString());
    return json({ business, analytics });
  } catch (err) {
    return handleError(err);
  }
}
