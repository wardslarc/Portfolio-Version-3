import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_AUDIT_COLLECTION } from "@/lib/admin/audit";
import type { AdminDoc } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import type {
  PostShareDoc,
  PostStatsDailyDoc,
  PostViewDoc,
} from "./indexes";

vi.mock("server-only", () => ({}));

const {
  POSTS_COLLECTION,
  POST_LIKES_COLLECTION,
  POST_SHARES_COLLECTION,
  POST_STATS_DAILY_COLLECTION,
  POST_VIEWS_COLLECTION,
  createDraftPost,
  deletePost,
  duplicatePost,
  ensureBlogIndexes,
  publishPost,
} = await import("./posts");

const {
  getPublicEngagement,
  queryEngagementSummary,
  queryPostEngagement,
  recordShare,
  recordView,
  removeLikesFromSource,
  resetPostStats,
  setLike,
  setPostStatsHidden,
  utcDateString,
} = await import("./engagement");

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
  alt: "Cover alt",
  width: 1600,
  height: 900,
};

describe("blog engagement", () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
    db = client.db("blog_engagement_test");
    await ensureBlogIndexes(db);
  });

  afterAll(async () => {
    await client?.close();
    await mongod?.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      db.collection(POSTS_COLLECTION).deleteMany({}),
      db.collection(POST_LIKES_COLLECTION).deleteMany({}),
      db.collection(POST_SHARES_COLLECTION).deleteMany({}),
      db.collection(POST_STATS_DAILY_COLLECTION).deleteMany({}),
      db.collection(POST_VIEWS_COLLECTION).deleteMany({}),
      db.collection(ADMIN_AUDIT_COLLECTION).deleteMany({}),
    ]);
  });

  async function seedLivePost(title = "Engagement Post", now = new Date("2026-11-27T12:00:00Z")) {
    const owner = makeAdmin("owner");
    const draft = await createDraftPost(
      db,
      owner,
      {
        title,
        excerpt: "Short excerpt",
        body: "Hello world",
        cover: VALID_COVER,
        tags: ["Next.js"],
      },
      now,
    );
    const pub = await publishPost(db, owner, draft._id.toString(), { mode: "now", now });
    if (!pub.ok) throw new Error(pub.error);
    return pub.post;
  }

  it("grants blog:engagement to owner and admin only", () => {
    expect(can("owner", "blog:engagement")).toBe(true);
    expect(can("admin", "blog:engagement")).toBe(true);
    expect(can("viewer", "blog:engagement")).toBe(false);
  });

  it("initializes and resets engagement fields on create and duplicate", async () => {
    const owner = makeAdmin("owner");
    const now = new Date("2026-11-27T12:00:00Z");
    const post = await seedLivePost("Original", now);
    expect(post.likes).toBe(0);
    expect(post.shares).toEqual({ copy: 0, x: 0, linkedin: 0, native: 0 });
    expect(post.hideStats).toBe(false);

    await recordView(db, post._id, "ip1", now);
    await setLike(db, { postId: post._id, visitorHash: "v1", ipHash: "ip1", liked: true, now });
    await recordShare(db, { postId: post._id, visitorHash: "v1", channel: "x", now });
    await setPostStatsHidden(db, owner, post._id, true);

    const dup = await duplicatePost(db, owner, post._id.toString(), now);
    expect(dup.ok).toBe(true);
    if (dup.ok) {
      expect(dup.post.views).toBe(0);
      expect(dup.post.likes).toBe(0);
      expect(dup.post.shares).toEqual({ copy: 0, x: 0, linkedin: 0, native: 0 });
      expect(dup.post.hideStats).toBe(false);
    }
  });

  it("handles idempotent likes, unlikes without going negative, and concurrent likes", async () => {
    const now = new Date("2026-11-27T12:00:00Z");
    const post = await seedLivePost("Likes Post", now);

    const l1 = await setLike(db, { postId: post._id, visitorHash: "v1", ipHash: "ip1", liked: true, now });
    expect(l1).toEqual({ liked: true, likes: 1 });
    const l2 = await setLike(db, { postId: post._id, visitorHash: "v1", ipHash: "ip1", liked: true, now });
    expect(l2).toEqual({ liked: true, likes: 1 });

    const u1 = await setLike(db, { postId: post._id, visitorHash: "v1", ipHash: "ip1", liked: false, now });
    expect(u1).toEqual({ liked: false, likes: 0 });
    const u2 = await setLike(db, { postId: post._id, visitorHash: "v1", ipHash: "ip1", liked: false, now });
    expect(u2).toEqual({ liked: false, likes: 0 });

    // Concurrent likes for the same visitor must only count once.
    const [c1, c2] = await Promise.all([
      setLike(db, { postId: post._id, visitorHash: "v2", ipHash: "ip2", liked: true, now }),
      setLike(db, { postId: post._id, visitorHash: "v2", ipHash: "ip2", liked: true, now }),
    ]);
    expect(c1.liked).toBe(true);
    expect(c2.liked).toBe(true);

    const doc = await db.collection(POSTS_COLLECTION).findOne({ _id: post._id });
    expect(doc?.likes).toBe(1);
  });

  it("limits distinct visitors from the same ipHash to 3 likes per post", async () => {
    const now = new Date("2026-11-27T12:00:00Z");
    const post = await seedLivePost("IP Limit Post", now);

    for (const v of ["v1", "v2", "v3"]) {
      const res = await setLike(db, { postId: post._id, visitorHash: v, ipHash: "same-ip", liked: true, now });
      expect(res.liked).toBe(true);
    }

    const fourth = await setLike(db, {
      postId: post._id,
      visitorHash: "v4",
      ipHash: "same-ip",
      liked: true,
      now,
    });
    expect(fourth).toEqual({ liked: false, likes: 3, limited: true });

    const doc = await db.collection(POSTS_COLLECTION).findOne({ _id: post._id });
    expect(doc?.likes).toBe(3);
  });

  it("dedupes shares per visitor/channel within 24h and updates daily stats for all events", async () => {
    const now = new Date("2026-11-27T12:00:00Z");
    const post = await seedLivePost("Daily Stats Post", now);

    expect(await recordView(db, post._id, "ip1", now)).toBe(true);
    expect(await recordView(db, post._id, "ip1", now)).toBe(false);
    expect(await recordView(db, post._id, "ip2", now)).toBe(true);

    await setLike(db, { postId: post._id, visitorHash: "v1", ipHash: "ip1", liked: true, now });
    await setLike(db, { postId: post._id, visitorHash: "v2", ipHash: "ip2", liked: true, now });
    await setLike(db, { postId: post._id, visitorHash: "v1", ipHash: "ip1", liked: false, now });

    expect(await recordShare(db, { postId: post._id, visitorHash: "v1", channel: "copy", now })).toBe(true);
    expect(await recordShare(db, { postId: post._id, visitorHash: "v1", channel: "copy", now })).toBe(false);
    expect(await recordShare(db, { postId: post._id, visitorHash: "v1", channel: "x", now })).toBe(true);

    const daily = await db
      .collection<PostStatsDailyDoc>(POST_STATS_DAILY_COLLECTION)
      .findOne({ _id: `${post._id.toString()}:${utcDateString(now)}` });
    expect(daily).toMatchObject({
      postId: post._id,
      date: "2026-11-27",
      views: 2,
      likes: 1,
      shares: { copy: 1, x: 1, linkedin: 0, native: 0 },
    });

    const pubEng = await getPublicEngagement(db, post._id, "v2");
    expect(pubEng).toEqual({
      views: 2,
      likes: 1,
      shares: 2,
      liked: true,
      hidden: false,
    });
  });

  it("hides public counts when hideStats is true while keeping liked accurate", async () => {
    const owner = makeAdmin("owner");
    const now = new Date("2026-11-27T12:00:00Z");
    const post = await seedLivePost("Hidden Stats", now);

    await recordView(db, post._id, "ip1", now);
    await setLike(db, { postId: post._id, visitorHash: "v1", ipHash: "ip1", liked: true, now });
    await setPostStatsHidden(db, owner, post._id, true);

    expect(await getPublicEngagement(db, post._id, "v1")).toEqual({
      views: null,
      likes: null,
      shares: null,
      liked: true,
      hidden: true,
    });
    expect(await getPublicEngagement(db, post._id, "v2")).toEqual({
      views: null,
      likes: null,
      shares: null,
      liked: false,
      hidden: true,
    });
  });

  it("computes queryEngagementSummary with zero-filled gaps and previous period", async () => {
    const publishDate = new Date("2026-11-01T00:00:00Z");
    const now = new Date("2026-11-27T12:00:00Z");
    const p1 = await seedLivePost("Top Post", publishDate);
    const p2 = await seedLivePost("Second Post", publishDate);

    // Current 7d: 2026-11-21 .. 2026-11-27
    await recordView(db, p1._id, "ip1", new Date("2026-11-25T10:00:00Z"));
    await recordView(db, p1._id, "ip2", new Date("2026-11-27T10:00:00Z"));
    await setLike(db, {
      postId: p1._id,
      visitorHash: "v1",
      ipHash: "ip1",
      liked: true,
      now: new Date("2026-11-27T10:00:00Z"),
    });
    await recordShare(db, {
      postId: p2._id,
      visitorHash: "v2",
      channel: "linkedin",
      now: new Date("2026-11-26T10:00:00Z"),
    });

    // Previous 7d: 2026-11-14 .. 2026-11-20
    await recordView(db, p2._id, "ip3", new Date("2026-11-15T10:00:00Z"));
    await recordShare(db, {
      postId: p2._id,
      visitorHash: "v3",
      channel: "x",
      now: new Date("2026-11-18T10:00:00Z"),
    });

    const summary7 = await queryEngagementSummary(db, { days: 7, now });
    expect(summary7.totals).toEqual({ views: 2, likes: 1, shares: 1 });
    expect(summary7.previousTotals).toEqual({ views: 1, likes: 0, shares: 1 });
    expect(summary7.daily).toHaveLength(7);
    expect(summary7.daily[0]?.date).toBe("2026-11-21");
    expect(summary7.daily[6]?.date).toBe("2026-11-27");
    expect(summary7.daily[0]).toEqual({ date: "2026-11-21", views: 0, likes: 0, shares: 0 });
    expect(summary7.daily[4]).toEqual({ date: "2026-11-25", views: 1, likes: 0, shares: 0 });
    expect(summary7.daily[5]).toEqual({ date: "2026-11-26", views: 0, likes: 0, shares: 1 });
    expect(summary7.daily[6]).toEqual({ date: "2026-11-27", views: 1, likes: 1, shares: 0 });
    expect(summary7.byChannel).toEqual({ copy: 0, x: 0, linkedin: 1, native: 0 });
    expect(summary7.topPosts.map((p) => p.title)).toEqual(["Top Post", "Second Post"]);

    const summaryAll = await queryEngagementSummary(db, { days: 0, now });
    expect(summaryAll.previousTotals).toBeNull();
    expect(summaryAll.totals).toEqual({ views: 3, likes: 1, shares: 2 });
    expect(summaryAll.daily).toHaveLength(30);
    expect(summaryAll.byChannel).toEqual({ copy: 0, x: 1, linkedin: 1, native: 0 });
  });

  it("removes likes from source, enforces permissions, and audits", async () => {
    const owner = makeAdmin("owner");
    const viewer = makeAdmin("viewer");
    const now = new Date("2026-11-27T12:00:00Z");
    const post = await seedLivePost("Source Removal", now);

    const badIp = "abcd1234deadbeef0000111122223333";
    await setLike(db, { postId: post._id, visitorHash: "v1", ipHash: badIp, liked: true, now });
    await setLike(db, { postId: post._id, visitorHash: "v2", ipHash: badIp, liked: true, now });
    await setLike(db, { postId: post._id, visitorHash: "v3", ipHash: badIp, liked: true, now });
    await setLike(db, { postId: post._id, visitorHash: "v4", ipHash: "goodip", liked: true, now });

    const detail = await queryPostEngagement(db, post._id, now);
    expect(detail?.likeSources[0]).toMatchObject({
      source: "abcd1234",
      ipHash: badIp,
      count: 3,
      flagged: true,
    });

    await expect(removeLikesFromSource(db, viewer, post._id, badIp, now)).rejects.toThrow("Forbidden");
    await expect(resetPostStats(db, viewer, post._id, ["likes"])).rejects.toThrow("Forbidden");
    await expect(setPostStatsHidden(db, viewer, post._id, true)).rejects.toThrow("Forbidden");

    const res = await removeLikesFromSource(db, owner, post._id, badIp, now);
    expect(res).toEqual({ ok: true, slug: post.slug, deletedCount: 3 });

    const updatedPost = await db.collection(POSTS_COLLECTION).findOne({ _id: post._id });
    expect(updatedPost?.likes).toBe(1);

    const daily = await db
      .collection<PostStatsDailyDoc>(POST_STATS_DAILY_COLLECTION)
      .findOne({ _id: `${post._id.toString()}:2026-11-27` });
    expect(daily?.likes).toBe(1);

    const audit = await db.collection(ADMIN_AUDIT_COLLECTION).findOne({ action: "post.likes_remove" });
    expect(audit?.detail).toBe("Removed 3 like(s) from source abcd1234");
  });

  it("resets selected counters without touching other counters", async () => {
    const owner = makeAdmin("owner");
    const now = new Date("2026-11-27T12:00:00Z");
    const post = await seedLivePost("Reset Counters", now);

    await recordView(db, post._id, "ip1", now);
    await setLike(db, { postId: post._id, visitorHash: "v1", ipHash: "ip1", liked: true, now });
    await recordShare(db, { postId: post._id, visitorHash: "v1", channel: "copy", now });

    const res = await resetPostStats(db, owner, post._id, ["likes"]);
    expect(res).toEqual({ ok: true, slug: post.slug, reset: ["likes"] });

    const after = await db.collection(POSTS_COLLECTION).findOne({ _id: post._id });
    expect(after?.views).toBe(1);
    expect(after?.likes).toBe(0);
    expect(after?.shares).toEqual({ copy: 1, x: 0, linkedin: 0, native: 0 });
    expect(await db.collection(POST_LIKES_COLLECTION).countDocuments({ postId: post._id })).toBe(0);
    expect(await db.collection(POST_SHARES_COLLECTION).countDocuments({})).toBe(1);
    expect(await db.collection(POST_VIEWS_COLLECTION).countDocuments({})).toBe(1);

    const dailyAfter = await db
      .collection<PostStatsDailyDoc>(POST_STATS_DAILY_COLLECTION)
      .findOne({ _id: `${post._id.toString()}:2026-11-27` });
    expect(dailyAfter).toMatchObject({
      views: 1,
      likes: 0,
      shares: { copy: 1, x: 0, linkedin: 0, native: 0 },
    });

    const audit = await db.collection(ADMIN_AUDIT_COLLECTION).findOne({ action: "post.stats_reset" });
    expect(audit?.detail).toBe("likes");
  });

  it("cascades deletePost across engagement collections without affecting other posts", async () => {
    const owner = makeAdmin("owner");
    const now = new Date("2026-11-27T12:00:00Z");
    const p1 = await seedLivePost("Delete Me", now);
    const p2 = await seedLivePost("Keep Me", now);

    await recordView(db, p1._id, "ip1", now);
    await setLike(db, { postId: p1._id, visitorHash: "v1", ipHash: "ip1", liked: true, now });
    await recordShare(db, { postId: p1._id, visitorHash: "v1", channel: "native", now });

    await recordView(db, p2._id, "ip1", now);
    await setLike(db, { postId: p2._id, visitorHash: "v1", ipHash: "ip1", liked: true, now });
    await recordShare(db, { postId: p2._id, visitorHash: "v1", channel: "native", now });

    const delRes = await deletePost(db, owner, p1._id.toString());
    expect(delRes.ok).toBe(true);

    expect(await db.collection(POST_LIKES_COLLECTION).countDocuments({ postId: p1._id })).toBe(0);
    expect(await db.collection(POST_STATS_DAILY_COLLECTION).countDocuments({ postId: p1._id })).toBe(0);
    expect(
      await db.collection<PostShareDoc>(POST_SHARES_COLLECTION).countDocuments({ _id: { $regex: `^${p1._id.toString()}:` } }),
    ).toBe(0);
    expect(
      await db.collection<PostViewDoc>(POST_VIEWS_COLLECTION).countDocuments({ _id: { $regex: `^${p1._id.toString()}:` } }),
    ).toBe(0);

    // Other post data remains intact.
    expect(await db.collection(POST_LIKES_COLLECTION).countDocuments({ postId: p2._id })).toBe(1);
    expect(await db.collection(POST_STATS_DAILY_COLLECTION).countDocuments({ postId: p2._id })).toBe(1);
    expect(
      await db.collection<PostShareDoc>(POST_SHARES_COLLECTION).countDocuments({ _id: { $regex: `^${p2._id.toString()}:` } }),
    ).toBe(1);
    expect(
      await db.collection<PostViewDoc>(POST_VIEWS_COLLECTION).countDocuments({ _id: { $regex: `^${p2._id.toString()}:` } }),
    ).toBe(1);
  });
});
