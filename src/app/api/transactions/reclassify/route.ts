import { connectDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getBusinessForUser, json, handleError, invalidateAnalyticsCache } from "@/lib/api";
import { reclassifyBusiness } from "@/lib/reclassify";
import { analyzeBusiness } from "@/lib/python";
import { enforceRateLimit } from "@/lib/rate-limit";
import { rateLimitIdentity } from "@/lib/security";

export async function POST() {
  try {
    const user = await requireUser();
    await connectDb();
    const business = await getBusinessForUser(user._id.toString());
    if (!business) return json({ error: "No business found" }, 404);
    const businessId = business._id.toString();

    await enforceRateLimit({
      scope: "reclassify",
      identity: rateLimitIdentity(businessId),
      limit: 5,
      windowMs: 10 * 60 * 1000,
    });

    const updated = await reclassifyBusiness(business._id.toString());

    await invalidateAnalyticsCache(businessId);
    analyzeBusiness(businessId).catch(() => {});

    return json({ reclassified: updated });
  } catch (err) {
    return handleError(err);
  }
}
