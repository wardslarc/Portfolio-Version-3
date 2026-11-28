import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  POSTS_COLLECTION,
  POST_STATS_DAILY_COLLECTION,
  POST_VIEWS_COLLECTION,
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

function makeViewRequest(
  slug: string,
  opts?: { ip?: string; userAgent?: string | null; cookie?: string },
): Request {
  const headers = new Headers({
    "content-type": "application/json",
    origin: "http://localhost",
    "x-forwarded-for": opts?.ip ?? "203.0.113.9",
  });
  if (opts?.userAgent !== null) {
    headers.set("user-agent", opts?.userAgent ?? "Mozilla/5.0 (TestBrowser)");
  }
  if (opts?.cookie) {
    headers.set("cookie", opts.cookie);
  }
  return new Request("http://localhost/api/blog/view", {
    method: "POST",
    headers,
    body: JSON.stringify({ slug }),
  });
}

describe("POST /api/blog/view", () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;

  beforeAll(async () => {
    process.env.IP_HASH_SALT = "test-view-salt";
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
    db = client.db("blog_view_test");
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
      db.collection(POST_VIEWS_COLLECTION).deleteMany({}),
      db.collection(POST_STATS_DAILY_COLLECTION).deleteMany({}),
      db.collection("rate_limits").deleteMany({}),
    ]);
  });

  async function seedPosts() {
    const now = Date.now();
    await db.collection<PostDoc>(POSTS_COLLECTION).insertMany([
      {
        _id: new ObjectId(),
        title: "Live Post",
        slug: "live-post",
        excerpt: "Summary",
        body: "Body",
        cover: null,
        tags: ["Next.js"],
        status: "published",
        publishedAt: new Date(now - 10_000),
        readingMinutes: 1,
        views: 0,
        authorId: new ObjectId(),
        authorName: "Carls",
        createdAt: new Date(now - 20_000),
        updatedAt: new Date(now - 10_000),
      },
      {
        _id: new ObjectId(),
        title: "Draft Post",
        slug: "draft-post",
        excerpt: "Summary",
        body: "Body",
        cover: null,
        tags: ["Next.js"],
        status: "draft",
        publishedAt: null,
        readingMinutes: 1,
        views: 0,
        authorId: new ObjectId(),
        authorName: "Carls",
        createdAt: new Date(now - 20_000),
        updatedAt: new Date(now - 10_000),
      },
      {
        _id: new ObjectId(),
        title: "Scheduled Post",
        slug: "scheduled-post",
        excerpt: "Summary",
        body: "Body",
        cover: null,
        tags: ["Next.js"],
        status: "published",
        publishedAt: new Date(now + 600_000),
        readingMinutes: 1,
        views: 0,
        authorId: new ObjectId(),
        authorName: "Carls",
        createdAt: new Date(now - 20_000),
        updatedAt: new Date(now - 10_000),
      },
    ]);
  }

  it("dedupes view counts per IP within 24h, updates daily stats, and ignores non-live posts", async () => {
    await seedPosts();

    const r1 = await POST(makeViewRequest("live-post", { ip: "198.51.100.1" }));
    expect(r1.status).toBe(204);
    expect(r1.headers.get("cache-control")).toBe("no-store");

    const r2 = await POST(makeViewRequest("live-post", { ip: "198.51.100.1" }));
    expect(r2.status).toBe(204);

    const r3 = await POST(makeViewRequest("live-post", { ip: "198.51.100.2" }));
    expect(r3.status).toBe(204);

    expect((await POST(makeViewRequest("draft-post", { ip: "198.51.100.1" }))).status).toBe(404);
    expect((await POST(makeViewRequest("scheduled-post", { ip: "198.51.100.1" }))).status).toBe(404);

    const live = await db.collection<PostDoc>(POSTS_COLLECTION).findOne({ slug: "live-post" });
    expect(live?.views).toBe(2);

    const daily = await db.collection(POST_STATS_DAILY_COLLECTION).findOne({ postId: live!._id });
    expect(daily?.views).toBe(2);
  });

  it("skips writes when blog_notrack cookie is present or user agent is a bot", async () => {
    await seedPosts();

    const noTrackRes = await POST(
      makeViewRequest("live-post", { ip: "198.51.100.10", cookie: "blog_notrack=1" }),
    );
    expect(noTrackRes.status).toBe(204);

    const botRes = await POST(
      makeViewRequest("live-post", { ip: "198.51.100.11", userAgent: "Googlebot/2.1" }),
    );
    expect(botRes.status).toBe(204);

    const emptyUaRes = await POST(
      makeViewRequest("live-post", { ip: "198.51.100.12", userAgent: null }),
    );
    expect(emptyUaRes.status).toBe(204);

    const live = await db.collection<PostDoc>(POSTS_COLLECTION).findOne({ slug: "live-post" });
    expect(live?.views).toBe(0);
    expect(await db.collection(POST_VIEWS_COLLECTION).countDocuments({})).toBe(0);
  });

  it("rate limits excessive view requests with 429", async () => {
    const ip = "198.51.100.99";
    for (let i = 0; i < 60; i++) {
      const res = await POST(makeViewRequest("missing-post", { ip }));
      expect(res.status).toBe(404);
    }
    const blocked = await POST(makeViewRequest("missing-post", { ip }));
    expect(blocked.status).toBe(429);
  });
});
