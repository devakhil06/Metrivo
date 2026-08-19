import { connectDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Conversation, Message } from "@/lib/models";
import { getBusinessForUser, json, handleError } from "@/lib/api";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (!mongoose.isValidObjectId(params.id)) return json({ error: "Invalid conversation" }, 400);
    await connectDb();
    const business = await getBusinessForUser(user._id.toString());
    if (!business) return json({ messages: [] });

    const conversation = await Conversation.findOne({ _id: params.id, businessId: business._id });
    if (!conversation) return json({ messages: [] });

    const messages = await Message.find({ conversationId: conversation._id }).sort({ createdAt: 1 }).lean();
    return json({ conversation, messages });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (!mongoose.isValidObjectId(params.id)) return json({ error: "Invalid conversation" }, 400);
    await connectDb();
    const business = await getBusinessForUser(user._id.toString());
    if (!business) return json({ error: "No business found" }, 404);

    const conversation = await Conversation.findOne({ _id: params.id, businessId: business._id });
    if (!conversation) return json({ error: "Conversation not found" }, 404);

    await Message.deleteMany({ conversationId: conversation._id });
    await Conversation.deleteOne({ _id: conversation._id });

    return json({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
