import { z } from "zod";
import { connectDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Conversation, Message } from "@/lib/models";
import { getBusinessForUser, json, handleError } from "@/lib/api";
import { runAnalyst } from "@/lib/agent";
import { enforceRateLimit } from "@/lib/rate-limit";
import { rateLimitIdentity } from "@/lib/security";

const schema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid conversation").optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    await connectDb();
    const business = await getBusinessForUser(user._id.toString());
    if (!business) return json({ error: "Create your business profile first" }, 400);

    const body = schema.parse(await req.json());
    const businessId = business._id.toString();

    await enforceRateLimit({
      scope: "analyst-chat",
      identity: rateLimitIdentity(businessId),
      limit: 30,
      windowMs: 60 * 1000,
    });

    let conversation;
    if (body.conversationId) {
      conversation = await Conversation.findOne({
        _id: body.conversationId,
        businessId: business._id,
      });
    }
    if (!conversation) {
      conversation = await Conversation.create({
        businessId: business._id,
        title: body.message.slice(0, 50),
      });
    }

    const userMessage = await Message.create({ conversationId: conversation._id, role: "user", content: body.message });
    await Conversation.updateOne({ _id: conversation._id }, { $set: { updatedAt: new Date() } });

    const historyMessages = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();
    const history = historyMessages
      .reverse()
      .filter((m) => m._id.toString() !== userMessage._id.toString())
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const conversationId = conversation._id.toString();
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: unknown) =>
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        let answer = "";
        try {
          answer = await runAnalyst({
            businessId,
            business,
            question: body.message,
            history,
            emit: send,
          });
          if (answer) {
            await Message.create({
              conversationId: conversation._id,
              role: "assistant",
              content: answer,
            });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "The analyst could not respond.";
          send({ type: "error", message: msg });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        "X-Conversation-Id": conversationId,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) return json({ error: err.issues[0].message }, 400);
    return handleError(err);
  }
}
