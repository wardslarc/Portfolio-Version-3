import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  POSTS_COLLECTION,
  POST_SHARES_COLLECTION,
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

function makeShareRequest(
  body: unknown,
  opts?: { visitorId?: string; ip?: string; userAgent?: string | null; extraCookie?: string },
): Request {
  const headers = new Headers({
    "content-type": "application/json",
    origin: "http://localhost",
    "x-forwarded-for": opts?.ip ?? "198.51.100.20",
  });
  if (opts?.userAgent !== null) {
    headers.set("user-agent", opts?.userAgent ?? "Mozilla/5.0 (TestBrowser)");
  }
  const cookies: string[] = [];
  if (opts?.visitorId) cookies.push(`visitor_id=${opts.visitorId}`);
  if (opts?.extraCookie) cookies.push(opts.extraCookie);
  if (cookies.length > 0) headers.set("cookie", cookies.join("; "));

  return new Request("http://localhost/api/blog/share", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/blog/share", () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;

  beforeAll(async () => {
    process.env.IP_HASH_SALT = "test-share-salt";
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
    db = client.db("blog_share_route_test");
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
      db.collection(POST_SHARES_COLLECTION).deleteMany({}),
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

  it("requires visitor_id cookie and valid channel", async () => {
    const missing = await POST(makeShareRequest({ slug: "live-post", channel: "x" }));
    expect(missing.status).toBe(400);

    const badChannel = await POST(
      makeShareRequest(
        { slug: "live-post", channel: "email" },
        { visitorId: "11111111-1111-4111-8111-111111111111" },
      ),
    );
    expect(badChannel.status).toBe(400);
  });

  it("records shares per channel with 24h dedupe and skips no-track/bots", async () => {
    const postId = await seedPost();
    const visitorId = "11111111-1111-4111-8111-111111111111";

    const r1 = await POST(makeShareRequest({ slug: "live-post", channel: "copy" }, { visitorId }));
    expect(r1.status).toBe(204);
    expect(r1.headers.get("cache-control")).toBe("no-store");

    // Duplicate within 24h -> 204, no increment
    const r2 = await POST(makeShareRequest({ slug: "live-post", channel: "copy" }, { visitorId }));
    expect(r2.status).toBe(204);

    // Different channel -> counted
    const r3 = await POST(makeShareRequest({ slug: "live-post", channel: "x" }, { visitorId }));
    expect(r3.status).toBe(204);

    // No-track and bot -> no write
    const r4 = await POST(
      makeShareRequest(
        { slug: "live-post", channel: "linkedin" },
        { visitorId, extraCookie: "blog_notrack=1" },
      ),
    );
    expect(r4.status).toBe(204);

    const r5 = await POST(
      makeShareRequest(
        { slug: "live-post", channel: "native" },
        { visitorId, userAgent: "Twitterbot/1.0" },
      ),
    );
    expect(r5.status).toBe(204);

    const post = await db.collection<PostDoc>(POSTS_COLLECTION).findOne({ _id: postId });
    expect(post?.shares).toEqual({ copy: 1, x: 1, linkedin: 0, native: 0 });
  });

  it("rate limits after 30 requests per minute and returns 404 for unknown slug", async () => {
    const visitorId = "11111111-1111-4111-8111-111111111111";
    const ip = "198.51.100.66";
    for (let i = 0; i < 30; i++) {
      const r = await POST(makeShareRequest({ slug: "missing", channel: "copy" }, { visitorId, ip }));
      expect(r.status).toBe(404);
    }
    const blocked = await POST(makeShareRequest({ slug: "missing", channel: "copy" }, { visitorId, ip }));
    expect(blocked.status).toBe(429);
  });
});
