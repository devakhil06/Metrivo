import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI as string;

const cached: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } = {
  conn: null,
  promise: null,
};

let indexesReady: Promise<void> | null = null;

async function dropIndexIfPresent(collection: mongoose.mongo.Collection, name: string): Promise<void> {
  try {
    await collection.dropIndex(name);
  } catch (error) {
    const codeName = error && typeof error === "object" && "codeName" in error ? error.codeName : undefined;
    if (codeName !== "IndexNotFound" && codeName !== "NamespaceNotFound") throw error;
  }
}

async function ensureCriticalIndexes(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB connection is not ready");

  const businesses = db.collection("businesses");
  const duplicateOwner = await businesses
    .aggregate([
      { $group: { _id: "$ownerId", count: { $sum: 1 } } },
      { $match: { _id: { $ne: null }, count: { $gt: 1 } } },
      { $limit: 1 },
    ])
    .hasNext();
  if (duplicateOwner) {
    throw new Error("Cannot enforce one business per owner: duplicate business profiles require review");
  }

  const transactions = db.collection("transactions");
  const duplicateTransaction = await transactions
    .aggregate([
      { $match: { dedupKey: { $type: "string" } } },
      { $group: { _id: { businessId: "$businessId", dedupKey: "$dedupKey" }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 1 },
    ])
    .hasNext();
  if (duplicateTransaction) {
    throw new Error("Cannot enforce transaction deduplication: duplicate keys require review");
  }

  const businessIndexes = await businesses.indexes().catch(() => []);
  if (businessIndexes.some((index) => index.name === "ownerId_1")) {
    await dropIndexIfPresent(businesses, "ownerId_1");
  }
  await businesses.createIndex({ ownerId: 1 }, { unique: true, name: "ownerId_unique" });

  const transactionIndexes = await transactions.indexes().catch(() => []);
  if (transactionIndexes.some((index) => index.name === "businessId_1_dedupKey_1")) {
    await dropIndexIfPresent(transactions, "businessId_1_dedupKey_1");
  }
  await transactions.createIndex(
    { businessId: 1, dedupKey: 1 },
    {
      unique: true,
      name: "businessId_dedupKey_unique",
      partialFilterExpression: { dedupKey: { $type: "string" } },
    }
  );

  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true, name: "email_1" }),
    db.collection("files").createIndex({ businessId: 1 }, { name: "businessId_1" }),
    transactions.createIndex({ businessId: 1, date: 1 }, { name: "businessId_1_date_1" }),
    transactions.createIndex({ businessId: 1, category: 1 }, { name: "businessId_1_category_1" }),
    transactions.createIndex({ businessId: 1, direction: 1 }, { name: "businessId_1_direction_1" }),
    db.collection("conversations").createIndex({ businessId: 1 }, { name: "businessId_1" }),
    db.collection("messages").createIndex({ conversationId: 1 }, { name: "conversationId_1" }),
    db.collection("refreshsessions").createIndex({ tokenHash: 1 }, { unique: true, name: "tokenHash_1" }),
    db.collection("refreshsessions").createIndex({ userId: 1 }, { name: "userId_1" }),
    db.collection("refreshsessions").createIndex({ familyId: 1 }, { name: "familyId_1" }),
    db.collection("refreshsessions").createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: "expiresAt_1" }
    ),
    db.collection("ratelimits").createIndex({ key: 1 }, { unique: true, name: "key_1" }),
    db.collection("ratelimits").createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: "expiresAt_1" }
    ),
  ]);
}

export async function connectDb(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set. Add it to your .env file.");
  }
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false, autoIndex: false });
  }
  cached.conn = await cached.promise;
  if (!indexesReady) indexesReady = ensureCriticalIndexes();
  await indexesReady;
  return cached.conn;
}
