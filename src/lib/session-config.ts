export const ACCESS_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-metrivo-access" : "metrivo-access";

export const REFRESH_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-metrivo-refresh" : "metrivo-refresh";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export function jwtSecret(): Uint8Array {
  const value = process.env.JWT_SECRET;
  const weak = !value || value.length < 32 || value === "change-this-to-a-random-string";

  if (weak) {
    throw new Error("JWT_SECRET must be a random value of at least 32 characters");
  }

  return new TextEncoder().encode(value);
}
