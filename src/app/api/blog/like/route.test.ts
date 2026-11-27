import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  POSTS_COLLECTION,
  POST_LIKES_COLLECTION,
  POST_STATS_DAILY_COLLECTION,
  ensureBlogIndexes,
  type PostDoc,
} from "@/lib/blog/indexes";

vi.mock("server-only", () => ({}));

let currentDb: Db;
let mongoConfigured = true;

vi.mock("@/lib/mongodb", () => ({
  isMongoConfigured: () => mongoConfigured,
  getDb: async () => currentDb,
}));

const { POST } = await import("./route");

function makeLikeRequest(
  body: unknown,
  opts?: { visitorId?: string; ip?: string; userAgent?: string | null; extraCookie?: string },
): Request {
  const headers = new Headers({
    "content-type": "application/json",
    "x-forwarded-for": opts?.ip ?? "198.51.100.10",
  });
  if (opts?.userAgent !== null) {
    headers.set("user-agent", opts?.userAgent ?? "Mozilla/5.0 (TestBrowser)");
  }
  const cookies: string[] = [];
  if (opts?.visitorId) cookies.push(`visitor_id=${opts.visitorId}`);
  if (opts?.extraCookie) cookies.push(opts.extraCookie);
  if (cookies.length > 0) headers.set("cookie", cookies.join("; "));

  return new Request("http://localhost/api/blog/like", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/blog/like", () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;

  beforeAll(async () => {
    process.env.IP_HASH_SALT = "test-like-salt";
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
    db = client.db("blog_like_route_test");
    currentDb = db;
    await ensureBlogIndexes(db);
  });

  afterAll(async () => {
    await client?.close();
    await mongod?.stop();
  });

  beforeEach(async () => {
    mongoConfigured = true;
    await Promise.all([
      db.collection(POSTS_COLLECTION).deleteMany({}),
      db.collection(POST_LIKES_COLLECTION).deleteMany({}),
      db.collection(POST_STATS_DAILY_COLLECTION).deleteMany({}),
      db.collection("rate_limits").deleteMany({}),
    ]);
  });

  async function seedPost() {
    const now = new Date();
    const _id = new ObjectId();
    await db.collection<PostDoc>(POSTS_COLLECTION).insertOne({
      _id,
      title: "Live",
      slug: "live-post",
      excerpt: "Summary",
      body: "Body",
      cover: null,
      tags: ["Next.js"],
      status: "published",
      publishedAt: new Date(now.getTime() - 10_000),
      readingMinutes: 1,
      views: 0,
      likes: 0,
      shares: { copy: 0, x: 0, linkedin: 0, native: 0 },
      hideStats: false,
      authorId: new ObjectId(),
      authorName: "Carls",
      createdAt: now,
      updatedAt: now,
    });
    return _id;
  }

  it("requires existing visitor_id cookie and valid payload", async () => {
    const missingCookie = await POST(makeLikeRequest({ slug: "live-post", liked: true }));
    expect(missingCookie.status).toBe(400);
    expect(await missingCookie.json()).toEqual({ error: "Reload the page and try again." });

    const invalidBody = await POST(
      makeLikeRequest({ slug: "live-post", liked: "yes" }, { visitorId: "11111111-1111-4111-8111-111111111111" }),
    );
    expect(invalidBody.status).toBe(400);
  });

  it("toggles like state, enforces rate limit, and returns 404 for unknown slug", async () => {
    await seedPost();
    const visitorId = "11111111-1111-4111-8111-111111111111";

    const unknown = await POST(makeLikeRequest({ slug: "missing", liked: true }, { visitorId }));
    expect(unknown.status).toBe(404);

    const r1 = await POST(makeLikeRequest({ slug: "live-post", liked: true }, { visitorId }));
    expect(r1.status).toBe(200);
    expect(r1.headers.get("cache-control")).toBe("no-store");
    expect(await r1.json()).toEqual({ liked: true, likes: 1, tracked: true });

    const r2 = await POST(makeLikeRequest({ slug: "live-post", liked: false }, { visitorId }));
    expect(r2.status).toBe(200);
    expect(await r2.json()).toEqual({ liked: false, likes: 0, tracked: true });
  });

  it("returns unchanged state with tracked: false for no-track cookie and bots", async () => {
    await seedPost();
    const visitorId = "11111111-1111-4111-8111-111111111111";

    const noTrack = await POST(
      makeLikeRequest(
        { slug: "live-post", liked: true },
        { visitorId, extraCookie: "blog_notrack=1" },
      ),
    );
    expect(noTrack.status).toBe(200);
    expect(await noTrack.json()).toEqual({ liked: false, likes: 0, tracked: false });

    const bot = await POST(
      makeLikeRequest(
        { slug: "live-post", liked: true },
        { visitorId, userAgent: "Discordbot/2.0" },
      ),
    );
    expect(bot.status).toBe(200);
    expect(await bot.json()).toEqual({ liked: false, likes: 0, tracked: false });
    expect(await db.collection(POST_LIKES_COLLECTION).countDocuments({})).toBe(0);
  });

  it("rate limits after 30 requests per minute", async () => {
    const visitorId = "11111111-1111-4111-8111-111111111111";
    const ip = "198.51.100.88";
    for (let i = 0; i < 30; i++) {
      const r = await POST(makeLikeRequest({ slug: "missing", liked: true }, { visitorId, ip }));
      expect(r.status).toBe(404);
    }
    const blocked = await POST(makeLikeRequest({ slug: "missing", liked: true }, { visitorId, ip }));
    expect(blocked.status).toBe(429);
  });
});
