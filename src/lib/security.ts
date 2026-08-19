import { createHash, timingSafeEqual } from "crypto";

export class SecurityError extends Error {
  constructor(message: string, public readonly status = 403) {
    super(message);
  }
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function clientAddress(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "unknown";
}

export function rateLimitIdentity(...parts: string[]): string {
  return sha256(parts.map((part) => part.trim().toLowerCase()).join("|"));
}
