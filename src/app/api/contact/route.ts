import type { Db } from "mongodb";
import { z } from "zod";
import { clientIp, contactSchema, hashIp, notifyByEmail, type ContactMessage } from "@/lib/contact";
import { getDb, isMongoConfigured } from "@/lib/mongodb";

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_PER_WINDOW = 3;

interface RateLimitDoc {
  _id: string; // `${ipHash}:${windowStart}`
  count: number;
  expiresAt: Date;
}

const globalForIndex = globalThis as unknown as {
  _rateLimitIndexes?: WeakMap<object, Map<string, Promise<string>>>;
};

function ensureRateLimitIndex(db: Db): Promise<string> {
  const cache = (globalForIndex._rateLimitIndexes ??= new WeakMap());
  const clientKey: object = db.client ?? db;
  const dbName = db.databaseName ?? "";
  let byDb = cache.get(clientKey);
  if (!byDb) {
    byDb = new Map();
    cache.set(clientKey, byDb);
  }
  let pending = byDb.get(dbName);
  if (!pending) {
    pending = db
      .collection<RateLimitDoc>("rate_limits")
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
      .catch((err) => {
        byDb.delete(dbName);
        throw err;
      });
    byDb.set(dbName, pending);
  }
  return pending;
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === 11000;
}

/**
 * Atomically increments this visitor's counter for the current fixed window and returns
 * the new count. A TTL index on `expiresAt` lets MongoDB delete old counters on its own.
 */
async function countAttempt(db: Db, ipHash: string): Promise<number> {
  await ensureRateLimitIndex(db);
  const limits = db.collection<RateLimitDoc>("rate_limits");

  const windowStart = Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS;
  const filter = { _id: `${ipHash}:${windowStart}` };
  const update = {
    $inc: { count: 1 },
    $setOnInsert: { expiresAt: new Date(windowStart + 2 * WINDOW_MS) },
  };

  // Two concurrent upserts for a brand-new _id can race and throw E11000; retry so
  // the second caller increments the winning document instead of failing with 500.
  for (let attempt = 0; ; attempt++) {
    try {
      const doc = await limits.findOneAndUpdate(filter, update, {
        upsert: true,
        returnDocument: "after",
      });
      return doc?.count ?? 1;
    } catch (err) {
      if (attempt < 2 && isDuplicateKeyError(err)) continue;
      throw err;
    }
  }
}

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

    // Count this attempt atomically before doing any work, so a burst of parallel
    // requests can't all pass a read-then-insert check.
    const attempts = await countAttempt(db, ipHash);
    if (attempts > MAX_PER_WINDOW) {
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
