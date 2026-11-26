import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POSTS_COLLECTION, POST_VIEWS_COLLECTION, ensureBlogIndexes, type PostDoc } from "@/lib/blog/indexes";

vi.mock("server-only", () => ({}));

let currentDb: Db;
let mongoConfigured = true;

vi.mock("@/lib/mongodb", () => ({
  isMongoConfigured: () => mongoConfigured,
  getDb: async () => currentDb,
}));

const { POST } = await import("./route");

function makeViewRequest(slug: string, ip = "203.0.113.9"): Request {
  return new Request("http://localhost/api/blog/view", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
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
      db.collection("rate_limits").deleteMany({}),
    ]);
  });

  it("dedupes view counts per IP within 24h and ignores non-live posts", async () => {
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

    // First hit from IP 1 increments views
    const r1 = await POST(makeViewRequest("live-post", "198.51.100.1"));
    expect(r1.status).toBe(204);

    // Repeat hit from same IP returns 204 without incrementing
    const r2 = await POST(makeViewRequest("live-post", "198.51.100.1"));
    expect(r2.status).toBe(204);

    // Hit from IP 2 increments views to 2
    const r3 = await POST(makeViewRequest("live-post", "198.51.100.2"));
    expect(r3.status).toBe(204);

    // Draft and scheduled return 404 and never increment
    expect((await POST(makeViewRequest("draft-post", "198.51.100.1"))).status).toBe(404);
    expect((await POST(makeViewRequest("scheduled-post", "198.51.100.1"))).status).toBe(404);

    const live = await db.collection<PostDoc>(POSTS_COLLECTION).findOne({ slug: "live-post" });
    expect(live?.views).toBe(2);
  });

  it("rate limits excessive view requests with 429", async () => {
    const ip = "198.51.100.99";
    for (let i = 0; i < 60; i++) {
      const res = await POST(makeViewRequest("missing-post", ip));
      expect(res.status).toBe(404);
    }
    const blocked = await POST(makeViewRequest("missing-post", ip));
    expect(blocked.status).toBe(429);
  });
});
