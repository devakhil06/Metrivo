import { connectDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Conversation } from "@/lib/models";
import { getBusinessForUser, json, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    await connectDb();
    const business = await getBusinessForUser(user._id.toString());
    if (!business) return json({ conversations: [] });

    const conversations = await Conversation.find({ businessId: business._id })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();
    return json({ conversations });
  } catch (err) {
    return handleError(err);
  }
}
