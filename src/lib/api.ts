import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { AuthError } from "./auth";
import { Business } from "./models";
import { RateLimitError } from "./rate-limit";
import { SecurityError } from "./security";

export function json(data: unknown, status = 200): NextResponse {
  const response = NextResponse.json(data, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function handleError(err: unknown): NextResponse {
  if (err instanceof AuthError) return json({ error: err.message }, 401);
  if (err instanceof SecurityError) return json({ error: err.message }, err.status);
  if (err instanceof RateLimitError) {
    const response = json({ error: err.message }, 429);
    response.headers.set("Retry-After", String(err.retryAfter));
    return response;
  }
  console.error(err);
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err instanceof Error
        ? err.message
        : "Internal server error";
  return json({ error: message }, 500);
}

export async function getBusinessForUser(userId: string) {
  return Business.findOne({ ownerId: userId }).sort({ createdAt: 1 }).lean();
}

export async function invalidateAnalyticsCache(businessId: string): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;
  await db.collection("kpis").deleteOne({ businessId });
}
