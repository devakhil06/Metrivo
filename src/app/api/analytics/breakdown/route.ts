import { connectDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getBusinessForUser, json, handleError } from "@/lib/api";
import { categoryBreakdown } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    await connectDb();
    const business = await getBusinessForUser(user._id.toString());
    if (!business) return json({ revenue: [], expenses: [] });

    const url = new URL(req.url);
    const month = url.searchParams.get("month");
    let from: Date | undefined;
    let to: Date | undefined;
    if (month) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return json({ error: "Invalid month" }, 400);
      const [y, m] = month.split("-").map(Number);
      from = new Date(Date.UTC(y, m - 1, 1));
      to = new Date(Date.UTC(y, m, 1) - 1);
    }

    const businessId = business._id.toString();
    const [revenue, expenses] = await Promise.all([
      categoryBreakdown(businessId, "credit", from, to),
      categoryBreakdown(businessId, "debit", from, to),
    ]);
    return json({ revenue, expenses });
  } catch (err) {
    return handleError(err);
  }
}
