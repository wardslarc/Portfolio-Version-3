import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  POSTS_COLLECTION,
  POST_LIKES_COLLECTION,
  ensureBlogIndexes,
  type PostDoc,
  type PostLikeDoc,
} from "@/lib/blog/indexes";
import { hashBlogVisitor } from "@/lib/visitor";

vi.mock("server-only", () => ({}));

let currentDb: Db;
let mongoConfigured = true;

vi.mock("@/lib/mongodb", () => ({
  isMongoConfigured: () => mongoConfigured,
  getDb: async () => currentDb,
}));

const { GET } = await import("./route");

describe("GET /api/blog/engagement", () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;

  beforeAll(async () => {
    process.env.IP_HASH_SALT = "test-eng-salt";
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
    db = client.db("blog_engagement_route_test");
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
      db.collection("rate_limits").deleteMany({}),
    ]);
  });

  it("validates slug, checks DB availability, and returns 404 for non-live posts", async () => {
    expect((await GET(new Request("http://localhost/api/blog/engagement?slug=INVALID!"))).status).toBe(400);

    mongoConfigured = false;
    expect((await GET(new Request("http://localhost/api/blog/engagement?slug=valid-slug"))).status).toBe(503);
    mongoConfigured = true;

    expect((await GET(new Request("http://localhost/api/blog/engagement?slug=missing-slug"))).status).toBe(404);
  });

  it("returns counts, sets visitor cookie when new, and respects liked and hideStats", async () => {
    const now = new Date();
    const postId = new ObjectId();
    await db.collection<PostDoc>(POSTS_COLLECTION).insertOne({
      _id: postId,
      title: "Live",
      slug: "live-post",
      excerpt: "Summary",
      body: "Body",
      cover: null,
      tags: ["Next.js"],
      status: "published",
      publishedAt: new Date(now.getTime() - 10_000),
      readingMinutes: 1,
      views: 42,
      likes: 5,
      shares: { copy: 1, x: 2, linkedin: 0, native: 1 },
      hideStats: false,
      authorId: new ObjectId(),
      authorName: "Carls",
      createdAt: now,
      updatedAt: now,
    });

    // New visitor gets Set-Cookie and liked: false
    const res1 = await GET(new Request("http://localhost/api/blog/engagement?slug=live-post"));
    expect(res1.status).toBe(200);
    expect(res1.headers.get("cache-control")).toBe("no-store");
    expect(res1.headers.get("set-cookie")).toContain("visitor_id=");
    expect(await res1.json()).toEqual({
      views: 42,
      likes: 5,
      shares: 4,
      liked: false,
      hidden: false,
    });

    // Existing visitor who liked gets liked: true and no new Set-Cookie
    const visitorId = "11111111-1111-4111-8111-111111111111";
    await db.collection<PostLikeDoc>(POST_LIKES_COLLECTION).insertOne({
      _id: `${postId.toString()}:${hashBlogVisitor(visitorId)}`,
      postId,
      ipHash: "ip1",
      createdAt: now,
    });

    const res2 = await GET(
      new Request("http://localhost/api/blog/engagement?slug=live-post", {
        headers: { cookie: `visitor_id=${visitorId}` },
      }),
    );
    expect(res2.status).toBe(200);
    expect(res2.headers.get("set-cookie")).toBeNull();
    expect(await res2.json()).toEqual({
      views: 42,
      likes: 5,
      shares: 4,
      liked: true,
      hidden: false,
    });

    // Hidden stats return null counts with liked preserved
    await db.collection<PostDoc>(POSTS_COLLECTION).updateOne({ _id: postId }, { $set: { hideStats: true } });
    const res3 = await GET(
      new Request("http://localhost/api/blog/engagement?slug=live-post", {
        headers: { cookie: `visitor_id=${visitorId}` },
      }),
    );
    expect(await res3.json()).toEqual({
      views: null,
      likes: null,
      shares: null,
      liked: true,
      hidden: true,
    });
  });

  it("rate limits after 120 requests per minute", async () => {
    const ip = "198.51.100.77";
    for (let i = 0; i < 120; i++) {
      const r = await GET(
        new Request("http://localhost/api/blog/engagement?slug=nope", {
          headers: { "x-forwarded-for": ip },
        }),
      );
      expect(r.status).toBe(404);
    }
    const blocked = await GET(
      new Request("http://localhost/api/blog/engagement?slug=nope", {
        headers: { "x-forwarded-for": ip },
      }),
    );
    expect(blocked.status).toBe(429);
  });
});
