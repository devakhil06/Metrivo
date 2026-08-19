import { requireUser } from "@/lib/auth";
import { json, handleError, getBusinessForUser } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const business = await getBusinessForUser(user._id.toString());
    return json({
      user: { id: user._id, name: user.name, email: user.email },
      business,
    });
  } catch (err) {
    return handleError(err);
  }
}
