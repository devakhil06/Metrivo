import { connectDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { FileModel } from "@/lib/models";
import { getBusinessForUser, json, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    await connectDb();
    const business = await getBusinessForUser(user._id.toString());
    if (!business) return json({ files: [] });

    const files = await FileModel.find({ businessId: business._id }).sort({ createdAt: -1 }).lean();
    return json({ files });
  } catch (err) {
    return handleError(err);
  }
}
