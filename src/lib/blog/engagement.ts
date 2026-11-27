import "server-only";
import { ObjectId, type Db } from "mongodb";
import { logAudit } from "@/lib/admin/audit";
import type { AdminDoc } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import {
  SHARE_CHANNELS,
  emptyShares,
  sumShares,
  type PostShares,
  type PublicEngagementPayload,
  type ShareChannel,
} from "./engagement-types";
import {
  POSTS_COLLECTION,
  POST_LIKES_COLLECTION,
  POST_SHARES_COLLECTION,
  POST_STATS_DAILY_COLLECTION,
  POST_VIEWS_COLLECTION,
  type PostDoc,
  type PostLikeDoc,
  type PostShareDoc,
  type PostStatsDailyDoc,
  type PostViewDoc,
} from "./indexes";
import { serializeAdminPost, type SerializedAdminPost } from "./posts";

export { SHARE_CHANNELS, emptyShares, sumShares, type PostShares, type PublicEngagementPayload, type ShareChannel };

const VIEW_TTL_MS = 24 * 60 * 60 * 1000;
const SHARE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_LIKES_PER_IP_PER_POST = 3;

export type EngagementCounter = "views" | "likes" | "shares";

export interface EngagementTotals {
  views: number;
  likes: number;
  shares: number;
}

export interface DailyEngagementRow {
  date: string;
  views: number;
  likes: number;
  shares: number;
}

export interface TopEngagementPost {
  id: string;
  title: string;
  slug: string;
  views: number;
  likes: number;
  shares: number;
}

export interface EngagementSummary {
  days: 7 | 30 | 0;
  totals: EngagementTotals;
  previousTotals: EngagementTotals | null;
  daily: DailyEngagementRow[];
  byChannel: PostShares;
  topPosts: TopEngagementPost[];
}

export interface LikeSourceRow {
  source: string;
  ipHash: string;
  count: number;
  lastAt: string;
  flagged: boolean;
}

export interface PostEngagementDetail {
  post: SerializedAdminPost;
  totals: EngagementTotals;
  daily: DailyEngagementRow[];
  byChannel: PostShares;
  likeSources: LikeSourceRow[];
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === 11000
  );
}

export function utcDateString(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function shiftUtcDays(date: Date, deltaDays: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + deltaDays));
}

function buildDateRange(endDate: Date, count: number): string[] {
  const dates: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    dates.push(utcDateString(shiftUtcDays(endDate, -i)));
  }
  return dates;
}

export async function bumpDaily(
  db: Db,
  postId: ObjectId,
  patch: { views?: number; likes?: number; shares?: Partial<PostShares> },
  now = new Date(),
): Promise<void> {
  const inc: Record<string, number> = {};
  const setOnInsert: Record<string, unknown> = {
    postId,
    date: utcDateString(now),
  };

  if (patch.views) {
    inc.views = patch.views;
  } else {
    setOnInsert.views = 0;
  }

  if (patch.likes) {
    inc.likes = patch.likes;
  } else {
    setOnInsert.likes = 0;
  }

  for (const ch of SHARE_CHANNELS) {
    const val = patch.shares?.[ch];
    if (val) {
      inc[`shares.${ch}`] = val;
    } else {
      setOnInsert[`shares.${ch}`] = 0;
    }
  }

  if (Object.keys(inc).length === 0) return;

  const date = utcDateString(now);
  await db.collection<PostStatsDailyDoc>(POST_STATS_DAILY_COLLECTION).updateOne(
    { _id: `${postId.toString()}:${date}` },
    {
      $inc: inc,
      $setOnInsert: setOnInsert,
    },
    { upsert: true },
  );
}

export async function recordView(
  db: Db,
  postId: ObjectId,
  ipHash: string,
  now = new Date(),
): Promise<boolean> {
  const viewsCol = db.collection<PostViewDoc>(POST_VIEWS_COLLECTION);
  try {
    await viewsCol.insertOne({
      _id: `${postId.toString()}:${ipHash}`,
      expiresAt: new Date(now.getTime() + VIEW_TTL_MS),
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return false;
    }
    throw err;
  }

  const res = await db.collection<PostDoc>(POSTS_COLLECTION).updateOne(
    { _id: postId, status: "published", publishedAt: { $lte: now } },
    { $inc: { views: 1 } },
  );
  if (res.modifiedCount > 0) {
    await bumpDaily(db, postId, { views: 1 }, now);
    return true;
  }
  return false;
}

export async function setLike(
  db: Db,
  opts: {
    postId: ObjectId;
    visitorHash: string;
    ipHash: string;
    liked: boolean;
    now?: Date;
  },
): Promise<{ liked: boolean; likes: number; limited?: boolean }> {
  const now = opts.now ?? new Date();
  const posts = db.collection<PostDoc>(POSTS_COLLECTION);
  const likesCol = db.collection<PostLikeDoc>(POST_LIKES_COLLECTION);
  const likeId = `${opts.postId.toString()}:${opts.visitorHash}`;

  const readLikes = async (): Promise<number> => {
    const doc = await posts.findOne({ _id: opts.postId }, { projection: { likes: 1 } });
    return doc?.likes ?? 0;
  };

  if (opts.liked) {
    const existing = await likesCol.findOne({ _id: likeId }, { projection: { _id: 1 } });
    if (existing) {
      return { liked: true, likes: await readLikes() };
    }

    const ipCount = await likesCol.countDocuments({ postId: opts.postId, ipHash: opts.ipHash });
    if (ipCount >= MAX_LIKES_PER_IP_PER_POST) {
      return { liked: false, likes: await readLikes(), limited: true };
    }

    try {
      await likesCol.insertOne({
        _id: likeId,
        postId: opts.postId,
        ipHash: opts.ipHash,
        createdAt: now,
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        return { liked: true, likes: await readLikes() };
      }
      throw err;
    }

    const updated = await posts.findOneAndUpdate(
      { _id: opts.postId },
      { $inc: { likes: 1 } },
      { returnDocument: "after", projection: { likes: 1 } },
    );
    await bumpDaily(db, opts.postId, { likes: 1 }, now);
    return { liked: true, likes: updated?.likes ?? 1 };
  }

  const delRes = await likesCol.deleteOne({ _id: likeId });
  if (delRes.deletedCount === 1) {
    const updated = await posts.findOneAndUpdate(
      { _id: opts.postId, likes: { $gt: 0 } },
      { $inc: { likes: -1 } },
      { returnDocument: "after", projection: { likes: 1 } },
    );
    await bumpDaily(db, opts.postId, { likes: -1 }, now);
    return { liked: false, likes: updated ? (updated.likes ?? 0) : await readLikes() };
  }

  return { liked: false, likes: await readLikes() };
}

export async function recordShare(
  db: Db,
  opts: {
    postId: ObjectId;
    visitorHash: string;
    channel: ShareChannel;
    now?: Date;
  },
): Promise<boolean> {
  const now = opts.now ?? new Date();
  const sharesCol = db.collection<PostShareDoc>(POST_SHARES_COLLECTION);
  const shareId = `${opts.postId.toString()}:${opts.visitorHash}:${opts.channel}`;

  try {
    await sharesCol.insertOne({
      _id: shareId,
      expiresAt: new Date(now.getTime() + SHARE_TTL_MS),
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return false;
    }
    throw err;
  }

  await db
    .collection<PostDoc>(POSTS_COLLECTION)
    .updateOne({ _id: opts.postId }, { $inc: { [`shares.${opts.channel}`]: 1 } });
  await bumpDaily(db, opts.postId, { shares: { [opts.channel]: 1 } }, now);
  return true;
}

export async function getPublicEngagement(
  db: Db,
  postId: ObjectId,
  visitorHash: string | null,
): Promise<PublicEngagementPayload> {
  const [post, likeDoc] = await Promise.all([
    db
      .collection<PostDoc>(POSTS_COLLECTION)
      .findOne({ _id: postId }, { projection: { views: 1, likes: 1, shares: 1, hideStats: 1 } }),
    visitorHash
      ? db
          .collection<PostLikeDoc>(POST_LIKES_COLLECTION)
          .findOne({ _id: `${postId.toString()}:${visitorHash}` }, { projection: { _id: 1 } })
      : Promise.resolve(null),
  ]);

  const hidden = Boolean(post?.hideStats);
  const liked = Boolean(likeDoc);

  if (hidden) {
    return {
      views: null,
      likes: null,
      shares: null,
      liked,
      hidden: true,
    };
  }

  return {
    views: post?.views ?? 0,
    likes: post?.likes ?? 0,
    shares: sumShares(post?.shares),
    liked,
    hidden: false,
  };
}

interface DailyAggRow {
  _id: string;
  views: number;
  likes: number;
  copy: number;
  x: number;
  linkedin: number;
  native: number;
}

function zeroFillDaily(dates: string[], rows: DailyAggRow[]): DailyEngagementRow[] {
  const byDate = new Map(rows.map((r) => [r._id, r]));
  return dates.map((date) => {
    const r = byDate.get(date);
    return {
      date,
      views: r?.views ?? 0,
      likes: r?.likes ?? 0,
      shares: r ? (r.copy ?? 0) + (r.x ?? 0) + (r.linkedin ?? 0) + (r.native ?? 0) : 0,
    };
  });
}

async function aggregateDailyPeriod(
  db: Db,
  startDate: string,
  endDate: string,
  postId?: ObjectId,
): Promise<{
  totals: EngagementTotals;
  byChannel: PostShares;
  dailyRows: DailyAggRow[];
}> {
  const match: Record<string, unknown> = {
    date: { $gte: startDate, $lte: endDate },
  };
  if (postId) match.postId = postId;

  const dailyRows = await db
    .collection<PostStatsDailyDoc>(POST_STATS_DAILY_COLLECTION)
    .aggregate<DailyAggRow>([
      { $match: match },
      {
        $group: {
          _id: "$date",
          views: { $sum: { $ifNull: ["$views", 0] } },
          likes: { $sum: { $ifNull: ["$likes", 0] } },
          copy: { $sum: { $ifNull: ["$shares.copy", 0] } },
          x: { $sum: { $ifNull: ["$shares.x", 0] } },
          linkedin: { $sum: { $ifNull: ["$shares.linkedin", 0] } },
          native: { $sum: { $ifNull: ["$shares.native", 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();

  const byChannel = emptyShares();
  let views = 0;
  let likes = 0;
  for (const row of dailyRows) {
    views += row.views;
    likes += row.likes;
    byChannel.copy += row.copy;
    byChannel.x += row.x;
    byChannel.linkedin += row.linkedin;
    byChannel.native += row.native;
  }

  return {
    totals: {
      views,
      likes,
      shares: sumShares(byChannel),
    },
    byChannel,
    dailyRows,
  };
}

export async function queryEngagementSummary(
  db: Db,
  opts: { days: 7 | 30 | 0; now?: Date },
): Promise<EngagementSummary> {
  const now = opts.now ?? new Date();
  const chartDays = opts.days === 7 ? 7 : 30;
  const chartDates = buildDateRange(now, chartDays);
  const chartStart = chartDates[0]!;
  const chartEnd = chartDates[chartDates.length - 1]!;

  if (opts.days === 0) {
    const [postsAgg, topPostDocs, chartAgg] = await Promise.all([
      db
        .collection<PostDoc>(POSTS_COLLECTION)
        .aggregate<{
          views: number;
          likes: number;
          copy: number;
          x: number;
          linkedin: number;
          native: number;
        }>([
          {
            $group: {
              _id: null,
              views: { $sum: { $ifNull: ["$views", 0] } },
              likes: { $sum: { $ifNull: ["$likes", 0] } },
              copy: { $sum: { $ifNull: ["$shares.copy", 0] } },
              x: { $sum: { $ifNull: ["$shares.x", 0] } },
              linkedin: { $sum: { $ifNull: ["$shares.linkedin", 0] } },
              native: { $sum: { $ifNull: ["$shares.native", 0] } },
            },
          },
        ])
        .toArray(),
      db
        .collection<PostDoc>(POSTS_COLLECTION)
        .find(
          {
            $or: [
              { views: { $gt: 0 } },
              { likes: { $gt: 0 } },
              { "shares.copy": { $gt: 0 } },
              { "shares.x": { $gt: 0 } },
              { "shares.linkedin": { $gt: 0 } },
              { "shares.native": { $gt: 0 } },
            ],
          },
          { projection: { title: 1, slug: 1, views: 1, likes: 1, shares: 1 } },
        )
        .sort({ views: -1, likes: -1, updatedAt: -1 })
        .limit(10)
        .toArray(),
      aggregateDailyPeriod(db, chartStart, chartEnd),
    ]);

    const agg = postsAgg[0];
    const byChannel: PostShares = agg
      ? { copy: agg.copy, x: agg.x, linkedin: agg.linkedin, native: agg.native }
      : emptyShares();

    return {
      days: 0,
      totals: {
        views: agg?.views ?? 0,
        likes: agg?.likes ?? 0,
        shares: sumShares(byChannel),
      },
      previousTotals: null,
      daily: zeroFillDaily(chartDates, chartAgg.dailyRows),
      byChannel,
      topPosts: topPostDocs.map((p) => ({
        id: p._id.toString(),
        title: p.title || "Untitled post",
        slug: p.slug,
        views: p.views ?? 0,
        likes: p.likes ?? 0,
        shares: sumShares(p.shares),
      })),
    };
  }

  const prevDates = buildDateRange(shiftUtcDays(now, -opts.days), opts.days);
  const prevStart = prevDates[0]!;
  const prevEnd = prevDates[prevDates.length - 1]!;

  const [currentAgg, prevAgg, topAgg] = await Promise.all([
    aggregateDailyPeriod(db, chartStart, chartEnd),
    aggregateDailyPeriod(db, prevStart, prevEnd),
    db
      .collection<PostStatsDailyDoc>(POST_STATS_DAILY_COLLECTION)
      .aggregate<{
        _id: ObjectId;
        views: number;
        likes: number;
        shares: number;
      }>([
        { $match: { date: { $gte: chartStart, $lte: chartEnd } } },
        {
          $group: {
            _id: "$postId",
            views: { $sum: { $ifNull: ["$views", 0] } },
            likes: { $sum: { $ifNull: ["$likes", 0] } },
            shares: {
              $sum: {
                $add: [
                  { $ifNull: ["$shares.copy", 0] },
                  { $ifNull: ["$shares.x", 0] },
                  { $ifNull: ["$shares.linkedin", 0] },
                  { $ifNull: ["$shares.native", 0] },
                ],
              },
            },
          },
        },
        {
          $match: {
            $or: [{ views: { $gt: 0 } }, { likes: { $ne: 0 } }, { shares: { $gt: 0 } }],
          },
        },
        { $sort: { views: -1, likes: -1, shares: -1 } },
        { $limit: 10 },
      ])
      .toArray(),
  ]);

  const topIds = topAgg.map((r) => r._id);
  const postDocs =
    topIds.length > 0
      ? await db
          .collection<PostDoc>(POSTS_COLLECTION)
          .find({ _id: { $in: topIds } }, { projection: { title: 1, slug: 1 } })
          .toArray()
      : [];
  const postById = new Map(postDocs.map((p) => [p._id.toString(), p]));

  const topPosts: TopEngagementPost[] = [];
  for (const row of topAgg) {
    const p = postById.get(row._id.toString());
    if (!p) continue;
    topPosts.push({
      id: row._id.toString(),
      title: p.title || "Untitled post",
      slug: p.slug,
      views: row.views,
      likes: row.likes,
      shares: row.shares,
    });
  }

  return {
    days: opts.days,
    totals: currentAgg.totals,
    previousTotals: prevAgg.totals,
    daily: zeroFillDaily(chartDates, currentAgg.dailyRows),
    byChannel: currentAgg.byChannel,
    topPosts,
  };
}

export async function queryPostEngagement(
  db: Db,
  postId: ObjectId | string,
  now = new Date(),
): Promise<PostEngagementDetail | null> {
  const _id =
    typeof postId === "string"
      ? ObjectId.isValid(postId)
        ? new ObjectId(postId)
        : null
      : postId;
  if (!_id) return null;

  const postDoc = await db.collection<PostDoc>(POSTS_COLLECTION).findOne({ _id });
  if (!postDoc) return null;

  const dates = buildDateRange(now, 30);
  const startDate = dates[0]!;
  const endDate = dates[dates.length - 1]!;

  const [dailyAgg, likeGroups] = await Promise.all([
    aggregateDailyPeriod(db, startDate, endDate, _id),
    db
      .collection<PostLikeDoc>(POST_LIKES_COLLECTION)
      .aggregate<{ _id: string; count: number; lastAt: Date }>([
        { $match: { postId: _id } },
        {
          $group: {
            _id: "$ipHash",
            count: { $sum: 1 },
            lastAt: { $max: "$createdAt" },
          },
        },
        { $sort: { count: -1, lastAt: -1 } },
        { $limit: 50 },
      ])
      .toArray(),
  ]);

  const serialized = serializeAdminPost(postDoc, now);

  return {
    post: serialized,
    totals: {
      views: serialized.views,
      likes: serialized.likes,
      shares: serialized.shares,
    },
    daily: zeroFillDaily(dates, dailyAgg.dailyRows),
    byChannel: serialized.sharesByChannel,
    likeSources: likeGroups.map((row) => ({
      source: row._id.slice(0, 8),
      ipHash: row._id,
      count: row.count,
      lastAt: row.lastAt.toISOString(),
      flagged: row.count >= MAX_LIKES_PER_IP_PER_POST,
    })),
  };
}

export async function removeLikesFromSource(
  db: Db,
  actor: AdminDoc,
  postId: ObjectId | string,
  ipHash: string,
  now = new Date(),
): Promise<{ ok: true; slug: string; deletedCount: number } | { ok: false; error: string }> {
  if (!can(actor.role, "blog:engagement")) throw new Error("Forbidden");
  const _id =
    typeof postId === "string"
      ? ObjectId.isValid(postId)
        ? new ObjectId(postId)
        : null
      : postId;
  if (!_id) return { ok: false, error: "Invalid post ID." };

  const posts = db.collection<PostDoc>(POSTS_COLLECTION);
  const post = await posts.findOne({ _id }, { projection: { slug: 1 } });
  if (!post) return { ok: false, error: "Post not found." };

  const delRes = await db
    .collection<PostLikeDoc>(POST_LIKES_COLLECTION)
    .deleteMany({ postId: _id, ipHash });
  const deleted = delRes.deletedCount;

  if (deleted > 0) {
    await posts.updateOne(
      { _id },
      [
        {
          $set: {
            likes: {
              $max: [0, { $subtract: [{ $ifNull: ["$likes", 0] }, deleted] }],
            },
          },
        },
      ],
    );
    await bumpDaily(db, _id, { likes: -deleted }, now);
  }

  await logAudit(
    db,
    actor,
    "post.likes_remove",
    post.slug,
    `Removed ${deleted} like(s) from source ${ipHash.slice(0, 8)}`,
  );

  return { ok: true, slug: post.slug, deletedCount: deleted };
}

export async function resetPostStats(
  db: Db,
  actor: AdminDoc,
  postId: ObjectId | string,
  which: EngagementCounter[],
): Promise<{ ok: true; slug: string; reset: EngagementCounter[] } | { ok: false; error: string }> {
  if (!can(actor.role, "blog:engagement")) throw new Error("Forbidden");
  const _id =
    typeof postId === "string"
      ? ObjectId.isValid(postId)
        ? new ObjectId(postId)
        : null
      : postId;
  if (!_id) return { ok: false, error: "Invalid post ID." };

  const targets = [...new Set(which)];
  if (targets.length === 0) {
    return { ok: false, error: "Select at least one counter to reset." };
  }

  const posts = db.collection<PostDoc>(POSTS_COLLECTION);
  const post = await posts.findOne({ _id }, { projection: { slug: 1 } });
  if (!post) return { ok: false, error: "Post not found." };

  const postSet: Record<string, unknown> = {};
  const dailySet: Record<string, unknown> = {};
  const sideEffects: Promise<unknown>[] = [];
  const idPrefixRegex = new RegExp(`^${_id.toString()}:`);

  if (targets.includes("views")) {
    postSet.views = 0;
    dailySet.views = 0;
    sideEffects.push(
      db.collection<PostViewDoc>(POST_VIEWS_COLLECTION).deleteMany({ _id: { $regex: idPrefixRegex } }),
    );
  }
  if (targets.includes("likes")) {
    postSet.likes = 0;
    dailySet.likes = 0;
    sideEffects.push(db.collection<PostLikeDoc>(POST_LIKES_COLLECTION).deleteMany({ postId: _id }));
  }
  if (targets.includes("shares")) {
    postSet.shares = emptyShares();
    dailySet.shares = emptyShares();
    sideEffects.push(
      db.collection<PostShareDoc>(POST_SHARES_COLLECTION).deleteMany({ _id: { $regex: idPrefixRegex } }),
    );
  }

  await Promise.all([
    posts.updateOne({ _id }, { $set: postSet }),
    db.collection<PostStatsDailyDoc>(POST_STATS_DAILY_COLLECTION).updateMany({ postId: _id }, { $set: dailySet }),
    ...sideEffects,
  ]);

  await logAudit(db, actor, "post.stats_reset", post.slug, targets.join(", "));
  return { ok: true, slug: post.slug, reset: targets };
}

export async function setPostStatsHidden(
  db: Db,
  actor: AdminDoc,
  postId: ObjectId | string,
  hidden: boolean,
): Promise<{ ok: true; slug: string; hidden: boolean } | { ok: false; error: string }> {
  if (!can(actor.role, "blog:engagement")) throw new Error("Forbidden");
  const _id =
    typeof postId === "string"
      ? ObjectId.isValid(postId)
        ? new ObjectId(postId)
        : null
      : postId;
  if (!_id) return { ok: false, error: "Invalid post ID." };

  const posts = db.collection<PostDoc>(POSTS_COLLECTION);
  const updated = await posts.findOneAndUpdate(
    { _id },
    { $set: { hideStats: hidden } },
    { returnDocument: "after", projection: { slug: 1, title: 1 } },
  );
  if (!updated) return { ok: false, error: "Post not found." };

  await logAudit(
    db,
    actor,
    hidden ? "post.stats_hide" : "post.stats_show",
    updated.slug,
    updated.title || updated.slug,
  );
  return { ok: true, slug: updated.slug, hidden };
}
