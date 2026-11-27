import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MEDIA_COLLECTION,
  POSTS_COLLECTION,
  ensureBlogIndexes,
  type MediaDoc,
  type PostDoc,
} from "./indexes";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
}));

let currentDb: Db;
let mongoConfigured = true;

vi.mock("@/lib/mongodb", () => ({
  isMongoConfigured: () => mongoConfigured,
  getDb: async () => currentDb,
}));

const {
  getAdjacentPosts,
  getAllTags,
  getLatestPosts,
  getLivePostBySlug,
  getLivePosts,
  getMediaSizes,
  getRelatedPosts,
  getTagIndex,
} = await import("./public");

function makePost(overrides: Partial<PostDoc>): PostDoc {
  const now = new Date();
  return {
    _id: new ObjectId(),
    title: "Post Title",
    slug: `post-${Math.random().toString(36).slice(2, 8)}`,
    excerpt: "Short excerpt",
    body: "Body content",
    cover: {
      url: "https://k3x9.public.blob.vercel-storage.com/blog/cover.webp",
      alt: "Cover alt",
      width: 1600,
      height: 900,
    },
    tags: ["Next.js"],
    status: "published",
    publishedAt: new Date(now.getTime() - 60_000),
    readingMinutes: 3,
    views: 0,
    authorId: new ObjectId(),
    authorName: "Carls Dale Escalo",
    createdAt: new Date(now.getTime() - 120_000),
    updatedAt: new Date(now.getTime() - 60_000),
    ...overrides,
  };
}

describe("blog public queries", () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
    db = client.db("blog_public_test");
    currentDb = db;
    await ensureBlogIndexes(db);
  });

  afterAll(async () => {
    await client?.close();
    await mongod?.stop();
  });

  beforeEach(async () => {
    mongoConfigured = true;
    await db.collection(POSTS_COLLECTION).deleteMany({});
    await db.collection(MEDIA_COLLECTION).deleteMany({});
  });

  it("returns empty results when MongoDB is not configured", async () => {
    mongoConfigured = false;
    expect(await getLivePosts()).toEqual({ items: [], total: 0, page: 1, totalPages: 1 });
    expect(await getAllTags()).toEqual([]);
    expect(await getTagIndex()).toEqual([]);
    expect(await getLatestPosts(3)).toEqual([]);
    expect(await getRelatedPosts("anything", ["Next.js"])).toEqual([]);
    expect(await getMediaSizes(["https://example.com/a.webp"])).toEqual(new Map());
    expect(await getLivePostBySlug("anything")).toBeNull();
  });

  it("filters out drafts and future scheduled posts and supports tag + paging + adjacent posts", async () => {
    const now = Date.now();
    await db.collection<PostDoc>(POSTS_COLLECTION).insertMany([
      makePost({ title: "Draft", slug: "draft-post", status: "draft", publishedAt: null, tags: ["Hidden"] }),
      makePost({
        title: "Scheduled",
        slug: "scheduled-post",
        status: "published",
        publishedAt: new Date(now + 3_600_000),
        tags: ["Future"],
      }),
      makePost({
        title: "Older",
        slug: "older-post",
        publishedAt: new Date(now - 300_000),
        tags: ["MongoDB"],
      }),
      makePost({
        title: "Middle",
        slug: "middle-post",
        publishedAt: new Date(now - 200_000),
        tags: ["Next.js", "MongoDB"],
      }),
      makePost({
        title: "Newest",
        slug: "newest-post",
        publishedAt: new Date(now - 100_000),
        tags: ["Next.js"],
      }),
    ]);

    const all = await getLivePosts();
    expect(all.total).toBe(3);
    expect(all.items.map((p) => p.slug)).toEqual(["newest-post", "middle-post", "older-post"]);

    const filtered = await getLivePosts({ tag: "nextjs-miss" });
    expect(filtered.total).toBe(0);

    const mongoTag = await getLivePosts({ tag: "mongodb" });
    expect(mongoTag.items.map((p) => p.slug)).toEqual(["middle-post", "older-post"]);

    expect(await getAllTags()).toEqual(["MongoDB", "Next.js"]);
    expect((await getLatestPosts(2)).map((p) => p.slug)).toEqual(["newest-post", "middle-post"]);
    expect(await getLivePostBySlug("draft-post")).toBeNull();
    expect(await getLivePostBySlug("scheduled-post")).toBeNull();

    const mid = await getLivePostBySlug("middle-post");
    expect(mid?.title).toBe("Middle");
    const adj = await getAdjacentPosts({ publishedAt: mid!.publishedAt, slug: mid!.slug });
    expect(adj.prev?.slug).toBe("older-post");
    expect(adj.next?.slug).toBe("newest-post");

    const tagIndex = await getTagIndex();
    expect(tagIndex.map((t) => ({ slug: t.slug, name: t.name, count: t.count }))).toEqual([
      { slug: "mongodb", name: "MongoDB", count: 2 },
      { slug: "next-js", name: "Next.js", count: 2 },
    ]);

    const byTagSlug = await getLivePosts({ tagSlug: "next-js" });
    expect(byTagSlug.items.map((p) => p.slug)).toEqual(["newest-post", "middle-post"]);
    expect((await getLivePosts({ tagSlug: "missing-tag" })).total).toBe(0);
  });

  it("ranks related posts by shared tags desc, then publishedAt desc, fills with latest, and excludes self/unpublished", async () => {
    const now = Date.now();
    await db.collection<PostDoc>(POSTS_COLLECTION).insertMany([
      makePost({ title: "Draft", slug: "draft", status: "draft", publishedAt: null, tags: ["Next.js", "SEO"] }),
      makePost({
        title: "Scheduled",
        slug: "scheduled",
        status: "published",
        publishedAt: new Date(now + 3_600_000),
        tags: ["Next.js", "SEO"],
      }),
      makePost({
        title: "Current",
        slug: "current",
        publishedAt: new Date(now - 50_000),
        tags: ["Next.js", "SEO"],
      }),
      makePost({
        title: "One Tag Older",
        slug: "one-tag-older",
        publishedAt: new Date(now - 300_000),
        tags: ["next.js"],
      }),
      makePost({
        title: "Two Tags",
        slug: "two-tags",
        publishedAt: new Date(now - 400_000),
        tags: ["Next.js", "SEO"],
      }),
      makePost({
        title: "One Tag Newer",
        slug: "one-tag-newer",
        publishedAt: new Date(now - 100_000),
        tags: ["SEO"],
      }),
      makePost({
        title: "Zero Tags Latest",
        slug: "zero-tags-latest",
        publishedAt: new Date(now - 20_000),
        tags: ["Chess"],
      }),
    ]);

    const related = await getRelatedPosts("current", ["Next.js", "SEO"], 3);
    expect(related.map((p) => p.slug)).toEqual(["two-tags", "one-tag-newer", "one-tag-older"]);
    expect(Object.keys(related[0]!).sort()).toEqual([
      "cover",
      "excerpt",
      "publishedAt",
      "readingMinutes",
      "slug",
      "title",
    ]);

    const filled = await getRelatedPosts("current", ["Next.js", "SEO"], 4);
    expect(filled.map((p) => p.slug)).toEqual([
      "two-tags",
      "one-tag-newer",
      "one-tag-older",
      "zero-tags-latest",
    ]);
  });

  it("looks up image dimensions from media collection in a single $in query", async () => {
    const urlA = "https://k3x9.public.blob.vercel-storage.com/blog/a.webp";
    const urlB = "https://k3x9.public.blob.vercel-storage.com/blog/b.webp";
    await db.collection<MediaDoc>(MEDIA_COLLECTION).insertMany([
      {
        _id: new ObjectId(),
        url: urlA,
        pathname: "blog/a.webp",
        contentType: "image/webp",
        size: 1234,
        width: 1280,
        height: 720,
        usedBy: [],
        uploadedBy: new ObjectId(),
        uploadedAt: new Date(),
      },
      {
        _id: new ObjectId(),
        url: urlB,
        pathname: "blog/b.webp",
        contentType: "image/webp",
        size: 5678,
        width: 800,
        height: 600,
        usedBy: [],
        uploadedBy: new ObjectId(),
        uploadedAt: new Date(),
      },
    ]);

    expect(await getMediaSizes([])).toEqual(new Map());
    const result = await getMediaSizes([urlA, "https://example.com/unknown.png"]);
    expect(result.get(urlA)).toEqual({ width: 1280, height: 720 });
    expect(result.has("https://example.com/unknown.png")).toBe(false);
    expect(result.size).toBe(1);
  });

  it("includes views, likes, and hideStats on PublicPostSummary", async () => {
    const now = Date.now();
    await db.collection<PostDoc>(POSTS_COLLECTION).insertMany([
      makePost({
        title: "Popular",
        slug: "popular-post",
        publishedAt: new Date(now - 10_000),
        views: 1200,
        likes: 34,
        hideStats: false,
      }),
      makePost({
        title: "Private Stats",
        slug: "private-stats",
        publishedAt: new Date(now - 20_000),
        views: 500,
        likes: 10,
        hideStats: true,
      }),
    ]);

    const res = await getLivePosts();
    expect(res.items[0]).toMatchObject({
      slug: "popular-post",
      views: 1200,
      likes: 34,
      hideStats: false,
    });
    expect(res.items[1]).toMatchObject({
      slug: "private-stats",
      views: 500,
      likes: 10,
      hideStats: true,
    });
  });
});
