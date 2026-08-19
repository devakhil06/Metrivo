import { connectDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Transaction, FileModel } from "@/lib/models";
import { getBusinessForUser, json, handleError, invalidateAnalyticsCache } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    await connectDb();
    const business = await getBusinessForUser(user._id.toString());
    if (!business) return json({ error: "No business found" }, 404);

    const { searchParams } = new URL(req.url);
    const requestedLimit = Number(searchParams.get("limit") || 100);
    const requestedSkip = Number(searchParams.get("skip") || 0);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 500) : 100;
    const skip = Number.isFinite(requestedSkip) ? Math.max(Math.floor(requestedSkip), 0) : 0;
    const direction = searchParams.get("direction");
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    const filter: Record<string, unknown> = { businessId: business._id };
    if (direction === "credit" || direction === "debit") filter.direction = direction;
    if (category) filter.category = category;
    if (search) {
      const safeSearch = search.slice(0, 200).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.description = { $regex: safeSearch, $options: "i" };
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(filter).sort({ date: -1 }).skip(skip).limit(limit).lean(),
      Transaction.countDocuments(filter),
    ]);

    return json({ transactions, total });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    await connectDb();
    const business = await getBusinessForUser(user._id.toString());
    if (!business) return json({ error: "No business found" }, 404);

    const businessId = business._id.toString();
    const txn = await Transaction.deleteMany({ businessId: business._id });
    await FileModel.deleteMany({ businessId: business._id });
    await invalidateAnalyticsCache(businessId);

    return json({ deleted: txn.deletedCount });
  } catch (err) {
    return handleError(err);
  }
}
