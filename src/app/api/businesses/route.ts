import { z } from "zod";
import { connectDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Business } from "@/lib/models";
import { json, handleError, getBusinessForUser, invalidateAnalyticsCache } from "@/lib/api";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1).max(120),
  businessType: z.string().min(1).max(60).optional().default("retail"),
  industry: z.string().min(1).max(60).optional().default("general"),
  currency: z.string().min(1).max(10).optional().default("INR"),
  country: z.string().min(1).max(60).optional().default("India"),
  revenueModel: z.string().min(1).max(60).optional().default("product_sales"),
  startDate: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = schema.parse(await req.json());
    await connectDb();

    let business = await Business.findOne({ ownerId: user._id });
    if (business) {
      Object.assign(business, body);
      await business.save();
    } else {
      business = await Business.create({ ownerId: user._id, ...body });
    }
    await invalidateAnalyticsCache(business._id.toString());
    return json({ business });
  } catch (err) {
    if (err instanceof z.ZodError) return json({ error: err.issues[0].message }, 400);
    return handleError(err);
  }
}

export async function GET() {
  try {
    const user = await requireUser();
    await connectDb();
    const business = await getBusinessForUser(user._id.toString());
    return json({ business });
  } catch (err) {
    return handleError(err);
  }
}

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  businessType: z.string().min(1).max(60).optional(),
  industry: z.string().min(1).max(60).optional(),
  currency: z.string().min(1).max(10).optional(),
  country: z.string().min(1).max(60).optional(),
  revenueModel: z.string().min(1).max(60).optional(),
  startDate: z.string().optional(),
});

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const body = patchSchema.parse(await req.json());
    await connectDb();

    const business = await Business.findOne({ ownerId: user._id });
    if (!business) return json({ error: "No business found" }, 404);

    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) business.set(key, value);
    }
    await business.save();
    await invalidateAnalyticsCache(business._id.toString());
    return json({ business });
  } catch (err) {
    if (err instanceof z.ZodError) return json({ error: err.issues[0].message }, 400);
    return handleError(err);
  }
}
