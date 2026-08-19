import { cookies } from "next/headers";
import { clearAuthCookies, rotateAuthSession, setAuthCookies } from "@/lib/auth";
import { json, handleError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { REFRESH_COOKIE } from "@/lib/session-config";
import { rateLimitIdentity } from "@/lib/security";

export async function POST() {
  try {
    const refreshToken = cookies().get(REFRESH_COOKIE)?.value;
    if (!refreshToken) return json({ error: "No refresh session" }, 401);

    await enforceRateLimit({
      scope: "refresh",
      identity: rateLimitIdentity(refreshToken),
      limit: 30,
      windowMs: 60 * 1000,
    });

    const result = await rotateAuthSession(refreshToken);
    if (result === "retry") {
      return json({ error: "Session was refreshed by another request", retry: true }, 409);
    }
    if (!result) {
      const response = json({ error: "Refresh session expired" }, 401);
      clearAuthCookies(response);
      return response;
    }

    const response = json({ ok: true });
    setAuthCookies(response, result);
    return response;
  } catch (err) {
    return handleError(err);
  }
}
