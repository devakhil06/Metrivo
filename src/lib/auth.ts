import { randomBytes, randomUUID } from "crypto";
import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { connectDb } from "./db";
import { RefreshSession, User, type IUser } from "./models";
import { sha256 } from "./security";
import {
  ACCESS_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_COOKIE,
  REFRESH_TOKEN_TTL_SECONDS,
  jwtSecret,
} from "./session-config";

export interface AccessSession {
  userId: string;
  email: string;
  sessionId: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export type RotationResult = AuthTokens | "retry" | null;

function refreshExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
}

function newRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

async function signAccessToken(user: IUser, sessionId: string): Promise<string> {
  return new SignJWT({
    userId: user._id.toString(),
    email: user.email,
    sessionId,
    tokenType: "access",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("metrivo")
    .setAudience("metrivo-web")
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(jwtSecret());
}

export async function createAuthSession(user: IUser): Promise<AuthTokens> {
  await connectDb();
  const refreshToken = newRefreshToken();
  const session = await RefreshSession.create({
    userId: user._id,
    familyId: randomUUID(),
    tokenHash: sha256(refreshToken),
    expiresAt: refreshExpiry(),
    lastUsedAt: new Date(),
  });

  return {
    accessToken: await signAccessToken(user, session._id.toString()),
    refreshToken,
  };
}

export async function rotateAuthSession(refreshToken: string): Promise<RotationResult> {
  await connectDb();
  const current = await RefreshSession.findOne({ tokenHash: sha256(refreshToken) });
  if (!current) return null;

  if (current.revokedAt) {
    const recentlyRotated =
      Boolean(current.replacedByHash) && Date.now() - current.revokedAt.getTime() < 10_000;
    if (recentlyRotated) return "retry";

    await RefreshSession.updateMany(
      { familyId: current.familyId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } }
    );
    return null;
  }

  if (current.expiresAt <= new Date()) return null;

  const user = await User.findById(current.userId);
  if (!user) return null;

  const nextToken = newRefreshToken();
  const next = await RefreshSession.create({
    userId: current.userId,
    familyId: current.familyId,
    tokenHash: sha256(nextToken),
    expiresAt: current.expiresAt,
    lastUsedAt: new Date(),
  });

  const rotated = await RefreshSession.updateOne(
    { _id: current._id, revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
    {
      $set: {
        revokedAt: new Date(),
        replacedByHash: next.tokenHash,
        lastUsedAt: new Date(),
      },
    }
  );

  if (rotated.modifiedCount !== 1) {
    await RefreshSession.deleteOne({ _id: next._id });
    return "retry";
  }

  return {
    accessToken: await signAccessToken(user, next._id.toString()),
    refreshToken: nextToken,
  };
}

export async function revokeAuthSession(refreshToken?: string): Promise<void> {
  if (!refreshToken) return;
  await connectDb();
  const session = await RefreshSession.findOne({ tokenHash: sha256(refreshToken) }).lean();
  if (!session) return;
  await RefreshSession.updateMany(
    { familyId: session.familyId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } }
  );
}

export function setAuthCookies(response: NextResponse, tokens: AuthTokens): void {
  const secure = process.env.NODE_ENV === "production";
  const common = { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };

  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    ...common,
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...common,
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
}

export function clearAuthCookies(response: NextResponse): void {
  const secure = process.env.NODE_ENV === "production";
  const options = { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: 0 };
  response.cookies.set(ACCESS_COOKIE, "", options);
  response.cookies.set(REFRESH_COOKIE, "", options);
}

export async function verifyToken(token: string): Promise<AccessSession | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret(), {
      issuer: "metrivo",
      audience: "metrivo-web",
    });
    if (payload.tokenType !== "access") return null;
    if (!payload.userId || !payload.email || !payload.sessionId) return null;
    return {
      userId: String(payload.userId),
      email: String(payload.email),
      sessionId: String(payload.sessionId),
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<AccessSession | null> {
  const token = cookies().get(ACCESS_COOKIE)?.value;
  return token ? verifyToken(token) : null;
}

export async function requireUser(): Promise<IUser> {
  const session = await getSession();
  if (!session) throw new AuthError("Not authenticated");
  await connectDb();

  const [user, activeSession] = await Promise.all([
    User.findById(session.userId),
    RefreshSession.exists({
      _id: session.sessionId,
      userId: session.userId,
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    }),
  ]);

  if (!user || !activeSession) throw new AuthError("Session expired");
  return user;
}

export class AuthError extends Error {}
