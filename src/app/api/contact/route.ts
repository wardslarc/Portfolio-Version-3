import { z } from "zod";
import { clientIp, contactSchema, hashIp, notifyByEmail, type ContactMessage } from "@/lib/contact";
import { getDb, isMongoConfigured } from "@/lib/mongodb";

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_PER_WINDOW = 3;

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Send the form as JSON." }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);
    return Response.json(
      {
        error: "Check the highlighted fields.",
        fieldErrors: Object.fromEntries(Object.entries(fieldErrors).map(([k, v]) => [k, v?.[0]])),
      },
      { status: 422 },
    );
  }

  const input = parsed.data;
  // Bots that fill the honeypot get a normal-looking success so they don't retry.
  if (input.website) return Response.json({ ok: true });

  if (!isMongoConfigured()) {
    console.error("Contact form used but MONGODB_URI is not set");
    return Response.json(
      { error: "The contact form isn't available right now. Please email me directly." },
      { status: 503 },
    );
  }

  try {
    const db = await getDb();
    const messages = db.collection<ContactMessage>("messages");
    const ipHash = hashIp(clientIp(request.headers));

    const recent = await messages.countDocuments({
      ipHash,
      createdAt: { $gt: new Date(Date.now() - WINDOW_MS) },
    });
    if (recent >= MAX_PER_WINDOW) {
      return Response.json(
        { error: "You've sent a few messages already. Please wait a few minutes, or email me directly." },
        { status: 429 },
      );
    }

    const { insertedId } = await messages.insertOne({
      name: input.name,
      email: input.email,
      message: input.message,
      createdAt: new Date(),
      ipHash,
      userAgent: (request.headers.get("user-agent") ?? "").slice(0, 300),
      emailed: false,
    });

    const emailed = await notifyByEmail(input);
    if (emailed) await messages.updateOne({ _id: insertedId }, { $set: { emailed: true } });

    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("Failed to save contact message", err);
    return Response.json(
      { error: "Your message didn't send. Try again in a moment, or email me directly." },
      { status: 500 },
    );
  }
}
