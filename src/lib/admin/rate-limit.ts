import "server-only";
import type { Db } from "mongodb";

const RATE_LIMITS_COLLECTION = "rate_limits";

interface RateLimitDoc {
  _id: string;
  count: number;
  expiresAt: Date;
}

const globalForRateLimitIndex = globalThis as unknown as {
  _adminRateLimitIndexes?: WeakMap<object, Map<string, Promise<string>>>;
};

function ensureRateLimitIndex(db: Db): Promise<string> {
  const cache = (globalForRateLimitIndex._adminRateLimitIndexes ??= new WeakMap());
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
      .collection<RateLimitDoc>(RATE_LIMITS_COLLECTION)
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

export async function consumeRateLimit(
  db: Db,
  key: string,
  windowMs: number,
  maxPerWindow: number,
  nowMs = Date.now(),
): Promise<boolean> {
  await ensureRateLimitIndex(db);
  const limits = db.collection<RateLimitDoc>(RATE_LIMITS_COLLECTION);
  const windowStart = Math.floor(nowMs / windowMs) * windowMs;
  const filter = { _id: `${key}:${windowStart}` };
  const update = {
    $inc: { count: 1 },
    $setOnInsert: { expiresAt: new Date(windowStart + 2 * windowMs) },
  };

  let doc: RateLimitDoc | null = null;
  try {
    doc = await limits.findOneAndUpdate(filter, update, { upsert: true, returnDocument: "after" });
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    doc = await limits.findOneAndUpdate(filter, { $inc: { count: 1 } }, { returnDocument: "after" });
  }

  return (doc?.count ?? 1) <= maxPerWindow;
}
