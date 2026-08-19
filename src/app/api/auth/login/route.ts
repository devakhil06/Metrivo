import { z } from "zod";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { User } from "@/lib/models";
import { createAuthSession, setAuthCookies } from "@/lib/auth";
import { json, handleError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { clientAddress, rateLimitIdentity } from "@/lib/security";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

const DUMMY_PASSWORD_HASH = "$2b$12$MtfxezhGFEQRMpqX6hUNZO5eTGvQX/C5oKrGQI3ojWgTtHusdPoqO";

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    await Promise.all([
      enforceRateLimit({
        scope: "login",
        identity: rateLimitIdentity(body.email),
        limit: 10,
        windowMs: 15 * 60 * 1000,
      }),
      enforceRateLimit({
        scope: "login-ip",
        identity: rateLimitIdentity(clientAddress(req)),
        limit: 50,
        windowMs: 15 * 60 * 1000,
      }),
    ]);
    await connectDb();
    const user = await User.findOne({ email: body.email.toLowerCase() });
    const passwordHash = user?.passwordHash || DUMMY_PASSWORD_HASH;
    const passwordMatches = await bcrypt.compare(body.password, passwordHash);
    if (!user || !passwordMatches) {
      return json({ error: "Invalid email or password" }, 401);
    }

    const tokens = await createAuthSession(user);
    const res = json({ user: { id: user._id, name: user.name, email: user.email } });
    setAuthCookies(res, tokens);
    return res;
  } catch (err) {
    if (err instanceof z.ZodError) return json({ error: err.issues[0].message }, 400);
    return handleError(err);
  }
}
