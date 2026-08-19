import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose/jwt/verify";
import { ACCESS_COOKIE, REFRESH_COOKIE, jwtSecret } from "@/lib/session-config";

const protectedPaths = ["/dashboard", "/metrics", "/upload", "/transactions", "/chat", "/onboarding"];
const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

function csrfFailure(req: NextRequest): NextResponse | null {
  if (!req.nextUrl.pathname.startsWith("/api/") || safeMethods.has(req.method)) return null;

  const fetchSite = req.headers.get("sec-fetch-site");
  const origin = req.headers.get("origin");
  const expectedOrigin = req.nextUrl.origin;
  const markedRequest = req.headers.get("x-metrivo-request") === "1";

  if (fetchSite === "cross-site" || (origin && origin !== expectedOrigin) || !markedRequest) {
    return NextResponse.json(
      { error: "Request origin could not be verified" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }
  return null;
}

export async function middleware(req: NextRequest) {
  const blocked = csrfFailure(req);
  if (blocked) return blocked;

  const { pathname } = req.nextUrl;
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  const hasRefreshToken = Boolean(req.cookies.get(REFRESH_COOKIE)?.value);
  let authed = false;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, jwtSecret(), {
        issuer: "metrivo",
        audience: "metrivo-web",
      });
      if (payload.tokenType !== "access") throw new Error("Invalid token type");
      authed = true;
    } catch {
      authed = false;
    }
  }

  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
  if (isProtected && !authed && !hasRefreshToken) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if ((pathname === "/login" || pathname === "/register") && authed) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/metrics/:path*",
    "/upload/:path*",
    "/transactions/:path*",
    "/chat/:path*",
    "/onboarding/:path*",
    "/login",
    "/register",
    "/api/:path*",
  ],
};
