import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminDoc } from "@/lib/admin/auth";

vi.mock("server-only", () => ({}));

const { slugify } = await import("./slug");
const {
  MEDIA_COLLECTION,
  POSTS_COLLECTION,
  createDraftPost,
  deletePost,
  derivePostStatus,
  duplicatePost,
  ensureBlogIndexes,
  ensureUniquePostSlug,
  isPostLive,
  publishPost,
  queryAdminPosts,
  unpublishPost,
  updatePost,
} = await import("./posts");

function makeAdmin(role: "owner" | "admin" | "viewer" = "owner"): AdminDoc {
  return {
    _id: new ObjectId(),
    email: `${role}@example.com`,
    name: `Test ${role}`,
    role,
    passwordHash: "hash",
    backupCodeHashes: [],
    createdAt: new Date("2026-11-01T00:00:00Z"),
    passwordChangedAt: null,
    lastSignInAt: null,
    disabledAt: null,
  };
}

const VALID_COVER = {
  url: "https://k3x9.public.blob.vercel-storage.com/blog/cover.webp",
  alt: "A clean cover photo",
  width: 1600,
  height: 900,
};

describe("blog posts core", () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
    db = client.db("blog_posts_test");
    await ensureBlogIndexes(db);
  });

  afterAll(async () => {
    await client?.close();
    await mongod?.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      db.collection(POSTS_COLLECTION).deleteMany({}),
      db.collection(MEDIA_COLLECTION).deleteMany({}),
      db.collection("admin_audit").deleteMany({}),
    ]);
  });

  it("slugifies titles and resolves slug collisions within 80 chars", async () => {
    expect(slugify("Building a Chess Board: Part 2!")).toBe("building-a-chess-board-part-2");
    expect(slugify("a".repeat(100)).length).toBeLessThanOrEqual(80);

    const owner = makeAdmin("owner");
    const p1 = await createDraftPost(db, owner, { title: "Hello World" });
    const p2 = await createDraftPost(db, owner, { title: "Hello World" });
    const p3 = await createDraftPost(db, owner, { title: "Hello World" });

    expect(p1.slug).toBe("hello-world");
    expect(p2.slug).toBe("hello-world-2");
    expect(p3.slug).toBe("hello-world-3");

    const next = await ensureUniquePostSlug(db, "hello-world");
    expect(next).toBe("hello-world-4");
  });

  it("rejects viewer role for every post mutation", async () => {
    const owner = makeAdmin("owner");
    const viewer = makeAdmin("viewer");
    const draft = await createDraftPost(db, owner, { title: "Owner Post" });
    const id = draft._id.toString();

    await expect(createDraftPost(db, viewer, { title: "Nope" })).rejects.toThrow("Forbidden");
    await expect(updatePost(db, viewer, id, { title: "Nope" })).rejects.toThrow("Forbidden");
    await expect(publishPost(db, viewer, id, { mode: "now" })).rejects.toThrow("Forbidden");
    await expect(unpublishPost(db, viewer, id)).rejects.toThrow("Forbidden");
    await expect(duplicatePost(db, viewer, id)).rejects.toThrow("Forbidden");
    await expect(deletePost(db, viewer, id)).rejects.toThrow("Forbidden");
  });

  it("validates publish readiness on the server", async () => {
    const admin = makeAdmin("admin");
    const draft = await createDraftPost(db, admin, {
      title: "Valid Title",
      excerpt: "Short excerpt",
      body: "Body text",
      tags: ["Next.js"],
    });
    const id = draft._id.toString();

    // Missing cover
    const noCover = await publishPost(db, admin, id, { mode: "now" });
    expect(noCover.ok).toBe(false);

    // Missing cover alt
    const noCoverAlt = await publishPost(db, admin, id, {
      mode: "now",
      patch: { cover: { ...VALID_COVER, alt: "   " } },
    });
    expect(noCoverAlt.ok).toBe(false);

    // Placeholder alt in body image
    const placeholderAlt = await publishPost(db, admin, id, {
      mode: "now",
      patch: {
        cover: VALID_COVER,
        body: "![Describe this image](https://k3x9.public.blob.vercel-storage.com/blog/x.webp)",
      },
    });
    expect(placeholderAlt.ok).toBe(false);

    // Excerpt over 160 chars
    const longExcerpt = await publishPost(db, admin, id, {
      mode: "now",
      patch: {
        cover: VALID_COVER,
        body: "![Valid alt](https://k3x9.public.blob.vercel-storage.com/blog/x.webp)",
        excerpt: "x".repeat(161),
      },
    });
    expect(longExcerpt.ok).toBe(false);

    // Missing tags
    const noTags = await publishPost(db, admin, id, {
      mode: "now",
      patch: {
        cover: VALID_COVER,
        body: "![Valid alt](https://k3x9.public.blob.vercel-storage.com/blog/x.webp)",
        excerpt: "Short excerpt",
        tags: [],
      },
    });
    expect(noTags.ok).toBe(false);

    // Schedule in the past fails
    const pastSchedule = await publishPost(db, admin, id, {
      mode: "schedule",
      scheduledAt: new Date("2020-01-01T00:00:00Z"),
      patch: {
        cover: VALID_COVER,
        body: "![Valid alt](https://k3x9.public.blob.vercel-storage.com/blog/x.webp)",
        excerpt: "Short excerpt",
        tags: ["Next.js"],
      },
    });
    expect(pastSchedule.ok).toBe(false);

    // Valid publish succeeds
    const ok = await publishPost(db, admin, id, {
      mode: "now",
      patch: {
        cover: VALID_COVER,
        body: "![Valid alt](https://k3x9.public.blob.vercel-storage.com/blog/x.webp)",
        excerpt: "Short excerpt",
        tags: ["Next.js", "next.js", "MongoDB"],
      },
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.post.tags).toEqual(["Next.js", "MongoDB"]);
      expect(ok.post.status).toBe("published");
    }
  });

  it("derives draft, scheduled, and published statuses and filters admin list", async () => {
    const owner = makeAdmin("owner");
    const t0 = new Date("2026-11-27T08:00:00Z");

    const d1 = await createDraftPost(db, owner, { title: "Draft One", tags: ["Design"] }, t0);
    const d2 = await createDraftPost(db, owner, { title: "Live One", tags: ["Next.js"] }, t0);
    const d3 = await createDraftPost(db, owner, { title: "Future One", tags: ["Security"] }, t0);

    await publishPost(db, owner, d2._id.toString(), {
      mode: "now",
      now: t0,
      patch: { excerpt: "Live", cover: VALID_COVER, tags: ["Next.js"] },
    });
    await publishPost(db, owner, d3._id.toString(), {
      mode: "schedule",
      now: t0,
      scheduledAt: new Date("2026-12-01T09:00:00Z"),
      patch: { excerpt: "Future", cover: VALID_COVER, tags: ["Security"] },
    });

    const listAtT0 = await queryAdminPosts(db, { now: t0 });
    expect(listAtT0.counts).toEqual({ all: 3, published: 1, scheduled: 1, draft: 1 });

    const scheduledItem = listAtT0.items.find((i) => i.id === d3._id.toString());
    expect(scheduledItem?.derivedStatus).toBe("scheduled");

    const afterLaunch = new Date("2026-12-01T09:01:00Z");
    const listAfter = await queryAdminPosts(db, { status: "published", now: afterLaunch });
    expect(listAfter.counts).toEqual({ all: 3, published: 2, scheduled: 0, draft: 1 });
    expect(listAfter.items.map((i) => i.title)).toContain("Future One");

    expect(derivePostStatus(d1, afterLaunch)).toBe("draft");
    expect(isPostLive({ status: "published", publishedAt: new Date("2026-12-01T09:00:00Z") }, t0)).toBe(false);
    expect(isPostLive({ status: "published", publishedAt: new Date("2026-12-01T09:00:00Z") }, afterLaunch)).toBe(true);
  });

  it("syncs media usage on update and deletes only exclusive lifetime media on delete", async () => {
    const owner = makeAdmin("owner");
    const olderTime = new Date("2026-11-01T00:00:00Z");
    const postTime = new Date("2026-11-10T00:00:00Z");
    const laterTime = new Date("2026-11-11T00:00:00Z");

    const imgOld = "https://k3x9.public.blob.vercel-storage.com/blog/old.webp";
    const imgExclusive = "https://k3x9.public.blob.vercel-storage.com/blog/exclusive.webp";
    const imgShared = "https://k3x9.public.blob.vercel-storage.com/blog/shared.webp";

    await db.collection(MEDIA_COLLECTION).insertMany([
      {
        _id: new ObjectId(),
        url: imgOld,
        pathname: "blog/old.webp",
        contentType: "image/webp",
        size: 1000,
        width: 800,
        height: 600,
        usedBy: [],
        uploadedBy: owner._id,
        uploadedAt: olderTime,
      },
      {
        _id: new ObjectId(),
        url: imgExclusive,
        pathname: "blog/exclusive.webp",
        contentType: "image/webp",
        size: 2000,
        width: 800,
        height: 600,
        usedBy: [],
        uploadedBy: owner._id,
        uploadedAt: laterTime,
      },
      {
        _id: new ObjectId(),
        url: imgShared,
        pathname: "blog/shared.webp",
        contentType: "image/webp",
        size: 3000,
        width: 800,
        height: 600,
        usedBy: [],
        uploadedBy: owner._id,
        uploadedAt: laterTime,
      },
    ]);

    const p1 = await createDraftPost(
      db,
      owner,
      {
        title: "Post One",
        cover: { ...VALID_COVER, url: imgOld },
        body: `![ex](${imgExclusive})\n\n![sh](${imgShared})`,
      },
      postTime,
    );
    const p2 = await createDraftPost(
      db,
      owner,
      {
        title: "Post Two",
        body: `![sh](${imgShared})`,
      },
      laterTime,
    );

    const mediaAfterCreate = await db.collection(MEDIA_COLLECTION).find({}).toArray();
    const byUrl = new Map(mediaAfterCreate.map((m) => [m.url, m]));
    expect(byUrl.get(imgExclusive)?.usedBy.map(String)).toEqual([p1._id.toString()]);
    expect(byUrl.get(imgShared)?.usedBy.map(String)).toHaveLength(2);

    // Removing imgOld from p1 pulls p1._id from usedBy
    await updatePost(db, owner, p1._id.toString(), { cover: null });
    const oldDoc = await db.collection(MEDIA_COLLECTION).findOne({ url: imgOld });
    expect(oldDoc?.usedBy).toEqual([]);

    // Put imgOld back, then delete p1: only imgExclusive (uploaded >= postTime and exclusive to p1) is deleted
    await updatePost(db, owner, p1._id.toString(), { cover: { ...VALID_COVER, url: imgOld } });
    const deletedUrls: string[] = [];
    const delRes = await deletePost(db, owner, p1._id.toString(), {
      deleteBlob: async (url) => {
        deletedUrls.push(url);
      },
    });

    expect(delRes.ok).toBe(true);
    expect(deletedUrls).toEqual([imgExclusive]);
    expect(await db.collection(MEDIA_COLLECTION).findOne({ url: imgExclusive })).toBeNull();
    expect(await db.collection(MEDIA_COLLECTION).findOne({ url: imgOld })).not.toBeNull();
    const sharedAfter = await db.collection(MEDIA_COLLECTION).findOne({ url: imgShared });
    expect(sharedAfter?.usedBy.map(String)).toEqual([p2._id.toString()]);
  });

  it("duplicates and unpublishes posts", async () => {
    const owner = makeAdmin("owner");
    const post = await createDraftPost(db, owner, {
      title: "Original",
      excerpt: "Summary",
      body: "Hello",
      cover: VALID_COVER,
      tags: ["Next.js"],
    });
    await publishPost(db, owner, post._id.toString(), { mode: "now" });

    const dup = await duplicatePost(db, owner, post._id.toString());
    expect(dup.ok).toBe(true);
    if (dup.ok) {
      expect(dup.post.title).toBe("Original (copy)");
      expect(dup.post.slug).toBe("original-copy");
      expect(dup.post.status).toBe("draft");
      expect(dup.post.publishedAt).toBeNull();
    }

    const unpub = await unpublishPost(db, owner, post._id.toString());
    expect(unpub.ok).toBe(true);
    if (unpub.ok) {
      expect(unpub.post.status).toBe("draft");
      expect(unpub.post.publishedAt).toBeNull();
    }
  });
});
