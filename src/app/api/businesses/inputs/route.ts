import { z } from "zod";
import { connectDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Business } from "@/lib/models";
import { json, handleError, invalidateAnalyticsCache } from "@/lib/api";

const numberFields = z.union([z.number(), z.string()]).optional();

const schema = z.object({
  cash_balance: numberFields,
  accounts_receivable: numberFields,
  accounts_payable: numberFields,
  inventory_value: numberFields,
  total_debt: numberFields,
  total_assets: numberFields,
  total_equity: numberFields,
  employee_count: numberFields,
  customer_count: numberFields,
  monthly_new_customers: numberFields,
  marketing_spend: numberFields,
  units_sold: numberFields,
});

export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    await connectDb();
    const business = await Business.findOne({ ownerId: user._id });
    if (!business) return json({ error: "No business found" }, 404);

    const body = schema.parse(await req.json());
    const inputs: Record<string, number> = {};
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined && value !== null && value !== "") {
        const n = Number(value);
        if (Number.isFinite(n) && n >= 0 && n <= 1_000_000_000_000_000) inputs[key] = n;
      }
    }

    const merged = { ...(business.inputs || {}), ...inputs };
    business.inputs = merged;
    await business.save();
    await invalidateAnalyticsCache(business._id.toString());
    return json({ inputs: merged });
  } catch (err) {
    if (err instanceof z.ZodError) return json({ error: err.issues[0].message }, 400);
    return handleError(err);
  }
}
