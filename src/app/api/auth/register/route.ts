import { z } from "zod";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { User } from "@/lib/models";
import { createAuthSession, setAuthCookies } from "@/lib/auth";
import { json, handleError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { clientAddress, rateLimitIdentity } from "@/lib/security";

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(15, "Use at least 15 characters").max(128),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    await enforceRateLimit({
      scope: "register",
      identity: rateLimitIdentity(clientAddress(req)),
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    await connectDb();
    const existing = await User.findOne({ email: body.email.toLowerCase() });
    if (existing) return json({ error: "An account with this email already exists" }, 409);

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await User.create({
      name: body.name,
      email: body.email.toLowerCase(),
      passwordHash,
    });

    const tokens = await createAuthSession(user);
    const res = json({ user: { id: user._id, name: user.name, email: user.email } });
    setAuthCookies(res, tokens);
    return res;
  } catch (err) {
    if (err instanceof z.ZodError) return json({ error: err.issues[0].message }, 400);
    return handleError(err);
  }
}
