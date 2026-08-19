import { connectDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Transaction, FileModel } from "@/lib/models";
import { getBusinessForUser, json, handleError, invalidateAnalyticsCache } from "@/lib/api";
import mongoose from "mongoose";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (!mongoose.isValidObjectId(params.id)) return json({ error: "Invalid file" }, 400);
    await connectDb();
    const business = await getBusinessForUser(user._id.toString());
    if (!business) return json({ error: "No business found" }, 404);

    const file = await FileModel.findOne({ _id: params.id, businessId: business._id });
    if (!file) return json({ error: "File not found" }, 404);

    const txn = await Transaction.deleteMany({ businessId: business._id, sourceFileId: file._id });
    await FileModel.deleteOne({ _id: file._id });
    await invalidateAnalyticsCache(business._id.toString());

    return json({ deleted: txn.deletedCount, file: file.filename });
  } catch (err) {
    return handleError(err);
  }
}
