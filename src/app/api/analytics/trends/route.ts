import { connectDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getBusinessForUser, json, handleError } from "@/lib/api";
import { monthlyTotals } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    await connectDb();
    const business = await getBusinessForUser(user._id.toString());
    if (!business) return json({ months: [] });

    const months = await monthlyTotals(business._id.toString());
    const allTime = new URL(req.url).searchParams.get("allTime") === "true";
    return json({ months: allTime ? months : months.slice(-12) });
  } catch (err) {
    return handleError(err);
  }
}
