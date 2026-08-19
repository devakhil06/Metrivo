import { Transaction } from "./models";
import { dedupKey } from "./preprocess";

export async function backfillDedupKeys(businessId: string): Promise<number> {
  const existingKeys = new Set(
    (await Transaction.distinct("dedupKey", { businessId, dedupKey: { $type: "string" } })).filter(Boolean)
  );
  const cursor = Transaction.find(
    { businessId, dedupKey: { $exists: false } },
    { date: 1, amount: 1, direction: 1, description: 1 }
  ).cursor();

  let count = 0;
  let batch: { updateOne: { filter: Record<string, unknown>; update: Record<string, unknown> } }[] = [];

  const flush = async () => {
    if (batch.length === 0) return;
    await Transaction.collection.bulkWrite(batch);
    batch = [];
  };

  for await (const doc of cursor) {
    const key = dedupKey(businessId, doc.date, doc.amount, doc.direction, doc.description || "");
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    batch.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { dedupKey: key } } } });
    count++;
    if (batch.length >= 1000) await flush();
  }
  await flush();
  return count;
}
