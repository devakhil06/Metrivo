import { connectDb } from "./db";
import { RateLimit } from "./models";

export class RateLimitError extends Error {
  readonly retryAfter: number;

  constructor(retryAfter: number) {
    super("Too many requests. Please try again shortly.");
    this.retryAfter = retryAfter;
  }
}

export async function enforceRateLimit(options: {
  scope: string;
  identity: string;
  limit: number;
  windowMs: number;
}): Promise<void> {
  await connectDb();
  const now = Date.now();
  const windowStart = Math.floor(now / options.windowMs) * options.windowMs;
  const key = `${options.scope}:${options.identity}:${windowStart}`;
  const expiresAt = new Date(windowStart + options.windowMs * 2);

  let bucket;
  try {
    bucket = await RateLimit.findOneAndUpdate(
      { key },
      {
        $inc: { count: 1 },
        $setOnInsert: { key, expiresAt },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code !== 11000) throw error;
    bucket = await RateLimit.findOneAndUpdate(
      { key },
      { $inc: { count: 1 } },
      { new: true }
    ).lean();
  }

  if (bucket && bucket.count > options.limit) {
    const retryAfter = Math.max(1, Math.ceil((windowStart + options.windowMs - now) / 1000));
    throw new RateLimitError(retryAfter);
  }
}
