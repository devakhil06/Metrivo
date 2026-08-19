import { cookies } from "next/headers";
import { clearAuthCookies, revokeAuthSession } from "@/lib/auth";
import { json, handleError } from "@/lib/api";
import { REFRESH_COOKIE } from "@/lib/session-config";

export async function POST() {
  try {
    await revokeAuthSession(cookies().get(REFRESH_COOKIE)?.value);
    const response = json({ ok: true });
    clearAuthCookies(response);
    response.headers.set("Clear-Site-Data", '"cache"');
    return response;
  } catch (err) {
    return handleError(err);
  }
}
