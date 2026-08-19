import { Transaction } from "./models";
import { inferDirection } from "./direction";
import { classifyTransaction } from "./classify";

export async function reclassifyBusiness(businessId: string): Promise<number> {
  const cursor = Transaction.find(
    { businessId },
    { description: 1, direction: 1, rawType: 1 }
  ).cursor();

  let updated = 0;
  let batch: { updateOne: { filter: Record<string, unknown>; update: Record<string, unknown> } }[] = [];

  const flush = async () => {
    if (batch.length === 0) return;
    await Transaction.collection.bulkWrite(batch);
    batch = [];
  };

  for await (const doc of cursor) {
    const direction =
      inferDirection({ type: doc.rawType, description: doc.description || "" }) ?? doc.direction;
    if (direction === doc.direction) continue;
    const { category, subcategory, confidence } = classifyTransaction(direction, doc.description || "");
    batch.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { direction, category, subcategory, confidence } },
      },
    });
    updated++;
    if (batch.length >= 1000) await flush();
  }
  await flush();
  return updated;
}
