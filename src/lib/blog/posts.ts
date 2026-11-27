import "server-only";
import { del } from "@vercel/blob";
import { ObjectId, type Db } from "mongodb";
import { logAudit } from "@/lib/admin/audit";
import type { AdminDoc } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import {
  emptyShares,
  sumShares,
  type PostShares,
} from "./engagement-types";
import {
  MEDIA_COLLECTION,
  POSTS_COLLECTION,
  POST_LIKES_COLLECTION,
  POST_SHARES_COLLECTION,
  POST_STATS_DAILY_COLLECTION,
  POST_VIEWS_COLLECTION,
  ensureBlogIndexes,
  type MediaDoc,
  type PostCover,
  type PostDoc,
  type PostLikeDoc,
  type PostShareDoc,
  type PostStatsDailyDoc,
  type PostStatus,
  type PostViewDoc,
} from "./indexes";
import {
  extractMarkdownImageUrls,
  findMarkdownImagesMissingAlt,
  readingMinutes,
} from "./markdown";
import { isValidSlug, makeUniqueSlug, slugify } from "./slug";

export {
  MEDIA_COLLECTION,
  POSTS_COLLECTION,
  POST_LIKES_COLLECTION,
  POST_SHARES_COLLECTION,
  POST_STATS_DAILY_COLLECTION,
  POST_VIEWS_COLLECTION,
  ensureBlogIndexes,
  type MediaDoc,
  type PostCover,
  type PostDoc,
  type PostShares,
  type PostStatus,
};

export type DerivedPostStatus = "draft" | "scheduled" | "published";

export interface SerializedAdminPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  cover: PostCover | null;
  tags: string[];
  status: PostStatus;
  derivedStatus: DerivedPostStatus;
  publishedAt: string | null;
  readingMinutes: number;
  views: number;
  likes: number;
  shares: number;
  sharesByChannel: PostShares;
  hideStats: boolean;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

export interface PostPatchInput {
  title?: string;
  slug?: string;
  excerpt?: string;
  body?: string;
  cover?: PostCover | null;
  tags?: string[];
}

export function derivePostStatus(
  post: Pick<PostDoc, "status" | "publishedAt">,
  now = new Date(),
): DerivedPostStatus {
  if (post.status === "draft") return "draft";
  if (post.publishedAt && post.publishedAt.getTime() > now.getTime()) return "scheduled";
  return "published";
}

export function isPostLive(
  post: Pick<PostDoc, "status" | "publishedAt">,
  now = new Date(),
): boolean {
  return (
    post.status === "published" &&
    post.publishedAt !== null &&
    post.publishedAt.getTime() <= now.getTime()
  );
}

export function serializeAdminPost(doc: PostDoc, now = new Date()): SerializedAdminPost {
  const sharesByChannel: PostShares = {
    copy: doc.shares?.copy ?? 0,
    x: doc.shares?.x ?? 0,
    linkedin: doc.shares?.linkedin ?? 0,
    native: doc.shares?.native ?? 0,
  };
  return {
    id: doc._id.toString(),
    title: doc.title,
    slug: doc.slug,
    excerpt: doc.excerpt,
    body: doc.body,
    cover: doc.cover,
    tags: doc.tags,
    status: doc.status,
    derivedStatus: derivePostStatus(doc, now),
    publishedAt: doc.publishedAt ? doc.publishedAt.toISOString() : null,
    readingMinutes: doc.readingMinutes,
    views: doc.views,
    likes: doc.likes ?? 0,
    shares: sumShares(sharesByChannel),
    sharesByChannel,
    hideStats: Boolean(doc.hideStats),
    authorId: doc.authorId.toString(),
    authorName: doc.authorName,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function normalizeTags(rawTags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of rawTags) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length > 24) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= 5) break;
  }
  return out;
}

export function collectPostImageUrls(body: string, cover: PostCover | null): string[] {
  const urls = new Set<string>(extractMarkdownImageUrls(body));
  if (cover?.url) {
    urls.add(cover.url);
  }
  return [...urls];
}

export async function ensureUniquePostSlug(
  db: Db,
  desired: string,
  excludePostId?: ObjectId,
): Promise<string> {
  const posts = db.collection<PostDoc>(POSTS_COLLECTION);
  return makeUniqueSlug(desired, async (candidate) => {
    const existing = await posts.findOne(
      excludePostId ? { slug: candidate, _id: { $ne: excludePostId } } : { slug: candidate },
      { projection: { _id: 1 } },
    );
    return existing !== null;
  });
}

export async function syncMediaUsage(
  db: Db,
  postId: ObjectId,
  urls: string[],
): Promise<void> {
  const uniqueUrls = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  const media = db.collection<MediaDoc>(MEDIA_COLLECTION);
  if (uniqueUrls.length > 0) {
    await media.updateMany(
      { url: { $in: uniqueUrls } },
      { $addToSet: { usedBy: postId } },
    );
  }
  await media.updateMany(
    uniqueUrls.length > 0 ? { url: { $nin: uniqueUrls }, usedBy: postId } : { usedBy: postId },
    { $pull: { usedBy: postId } },
  );
}

export function validatePostFields(input: PostPatchInput): string | null {
  if (input.title !== undefined && input.title.trim().length > 140) {
    return "Title must be 140 characters or fewer.";
  }
  if (input.slug !== undefined && !isValidSlug(input.slug)) {
    return "URL slug must use lowercase letters, numbers, and hyphens (max 80 characters).";
  }
  if (input.excerpt !== undefined && input.excerpt.trim().length > 200) {
    return "Excerpt must be 200 characters or fewer.";
  }
  if (input.body !== undefined && input.body.length > 100_000) {
    return "Body must be 100,000 characters or fewer.";
  }
  if (input.cover !== undefined && input.cover !== null) {
    if (!/^https:\/\//i.test(input.cover.url)) {
      return "Cover image URL must use https.";
    }
    if (input.cover.alt.trim().length > 300) {
      return "Cover alt text must be 300 characters or fewer.";
    }
  }
  if (input.tags !== undefined) {
    if (input.tags.length > 5) return "Choose at most 5 tags.";
    for (const tag of input.tags) {
      const t = tag.trim();
      if (!t || t.length > 24) return "Each tag must be 1–24 characters.";
    }
  }
  return null;
}

export function validatePostForPublish(post: {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  cover: PostCover | null;
  tags: string[];
}): string | null {
  const title = post.title.trim();
  if (title.length < 1 || title.length > 140) {
    return "Add a title (1–140 characters) before publishing.";
  }
  if (!isValidSlug(post.slug)) {
    return "Enter a valid URL slug before publishing.";
  }
  const excerpt = post.excerpt.trim();
  if (excerpt.length < 1 || excerpt.length > 160) {
    return "Add an excerpt (1–160 characters) before publishing.";
  }
  if (!post.cover || !/^https:\/\//i.test(post.cover.url)) {
    return "Add a cover image before publishing.";
  }
  if (!post.cover.alt.trim()) {
    return "Add alt text for the cover image before publishing.";
  }
  if (findMarkdownImagesMissingAlt(post.body).length > 0) {
    return "Every image in the article body needs descriptive alt text.";
  }
  if (post.tags.length < 1) {
    return "Add at least one tag before publishing.";
  }
  return null;
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === 11000
  );
}

export async function createDraftPost(
  db: Db,
  actor: AdminDoc,
  input: PostPatchInput = {},
  now = new Date(),
): Promise<PostDoc> {
  if (!can(actor.role, "blog:write")) throw new Error("Forbidden");
  await ensureBlogIndexes(db);

  const title = (input.title ?? "").trim().slice(0, 140);
  const desiredSlug = input.slug?.trim() || slugify(title) || "untitled-post";
  const slug = await ensureUniquePostSlug(db, desiredSlug);
  const excerpt = (input.excerpt ?? "").trim().slice(0, 200);
  const body = (input.body ?? "").slice(0, 100_000);
  const cover = input.cover ?? null;
  const tags = normalizeTags(input.tags ?? []);

  const doc: PostDoc = {
    _id: new ObjectId(),
    title,
    slug,
    excerpt,
    body,
    cover,
    tags,
    status: "draft",
    publishedAt: null,
    readingMinutes: readingMinutes(body),
    views: 0,
    likes: 0,
    shares: emptyShares(),
    hideStats: false,
    authorId: actor._id,
    authorName: actor.name,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection<PostDoc>(POSTS_COLLECTION).insertOne(doc);
  await syncMediaUsage(db, doc._id, collectPostImageUrls(doc.body, doc.cover));
  await logAudit(db, actor, "post.create", doc.slug, doc.title || "Untitled draft");
  return doc;
}

export async function updatePost(
  db: Db,
  actor: AdminDoc,
  postId: string,
  input: PostPatchInput,
  opts: { now?: Date; audit?: boolean } = {},
): Promise<
  | { ok: true; post: PostDoc; previousSlug: string }
  | { ok: false; error: string; field?: "slug" }
> {
  if (!can(actor.role, "blog:write")) throw new Error("Forbidden");
  if (!ObjectId.isValid(postId)) return { ok: false, error: "Invalid post ID." };
  await ensureBlogIndexes(db);

  const fieldError = validatePostFields(input);
  if (fieldError) {
    return {
      ok: false,
      error: fieldError,
      ...(input.slug !== undefined && !isValidSlug(input.slug) ? { field: "slug" as const } : {}),
    };
  }

  const posts = db.collection<PostDoc>(POSTS_COLLECTION);
  const _id = new ObjectId(postId);
  const existing = await posts.findOne({ _id });
  if (!existing) return { ok: false, error: "Post not found." };

  const nextTitle = input.title !== undefined ? input.title.trim() : existing.title;
  const nextSlug = input.slug !== undefined ? input.slug.trim() : existing.slug;
  const nextExcerpt = input.excerpt !== undefined ? input.excerpt.trim() : existing.excerpt;
  const nextBody = input.body !== undefined ? input.body : existing.body;
  const nextCover = input.cover !== undefined ? input.cover : existing.cover;
  const nextTags = input.tags !== undefined ? normalizeTags(input.tags) : existing.tags;

  if (nextSlug !== existing.slug) {
    const taken = await posts.findOne(
      { slug: nextSlug, _id: { $ne: _id } },
      { projection: { _id: 1 } },
    );
    if (taken) {
      return { ok: false, error: "That URL slug is already taken.", field: "slug" };
    }
  }

  if (existing.status === "published") {
    const pubErr = validatePostForPublish({
      title: nextTitle,
      slug: nextSlug,
      excerpt: nextExcerpt,
      body: nextBody,
      cover: nextCover,
      tags: nextTags,
    });
    if (pubErr) return { ok: false, error: pubErr };
  }

  const now = opts.now ?? new Date();
  const nextReadingMinutes = readingMinutes(nextBody);

  try {
    const updated = await posts.findOneAndUpdate(
      { _id },
      {
        $set: {
          title: nextTitle,
          slug: nextSlug,
          excerpt: nextExcerpt,
          body: nextBody,
          cover: nextCover,
          tags: nextTags,
          readingMinutes: nextReadingMinutes,
          updatedAt: now,
        },
      },
      { returnDocument: "after" },
    );

    if (!updated) return { ok: false, error: "Post not found." };

    await syncMediaUsage(db, _id, collectPostImageUrls(updated.body, updated.cover));
    if (opts.audit !== false) {
      await logAudit(db, actor, "post.update", updated.slug, updated.title || "Untitled draft");
    }

    return { ok: true, post: updated, previousSlug: existing.slug };
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return { ok: false, error: "That URL slug is already taken.", field: "slug" };
    }
    throw err;
  }
}

export async function publishPost(
  db: Db,
  actor: AdminDoc,
  postId: string,
  opts: {
    mode: "now" | "schedule";
    scheduledAt?: Date;
    patch?: PostPatchInput;
    now?: Date;
  },
): Promise<
  | { ok: true; post: PostDoc; previousSlug: string; scheduled: boolean }
  | { ok: false; error: string; field?: "slug" | "scheduledAt" }
> {
  if (!can(actor.role, "blog:write")) throw new Error("Forbidden");
  if (!ObjectId.isValid(postId)) return { ok: false, error: "Invalid post ID." };
  await ensureBlogIndexes(db);

  if (opts.patch) {
    const fieldError = validatePostFields(opts.patch);
    if (fieldError) {
      return {
        ok: false,
        error: fieldError,
        ...(opts.patch.slug !== undefined && !isValidSlug(opts.patch.slug)
          ? { field: "slug" as const }
          : {}),
      };
    }
  }

  const posts = db.collection<PostDoc>(POSTS_COLLECTION);
  const _id = new ObjectId(postId);
  const existing = await posts.findOne({ _id });
  if (!existing) return { ok: false, error: "Post not found." };

  const merged = {
    title: opts.patch?.title !== undefined ? opts.patch.title.trim() : existing.title,
    slug: opts.patch?.slug !== undefined ? opts.patch.slug.trim() : existing.slug,
    excerpt: opts.patch?.excerpt !== undefined ? opts.patch.excerpt.trim() : existing.excerpt,
    body: opts.patch?.body !== undefined ? opts.patch.body : existing.body,
    cover: opts.patch?.cover !== undefined ? opts.patch.cover : existing.cover,
    tags: opts.patch?.tags !== undefined ? normalizeTags(opts.patch.tags) : existing.tags,
  };

  const publishErr = validatePostForPublish(merged);
  if (publishErr) return { ok: false, error: publishErr };

  const now = opts.now ?? new Date();
  let publishedAt: Date;
  if (opts.mode === "schedule") {
    if (!opts.scheduledAt || Number.isNaN(opts.scheduledAt.getTime())) {
      return { ok: false, error: "Choose a valid schedule date and time.", field: "scheduledAt" };
    }
    if (opts.scheduledAt.getTime() <= now.getTime()) {
      return { ok: false, error: "Scheduled publish time must be in the future.", field: "scheduledAt" };
    }
    publishedAt = opts.scheduledAt;
  } else {
    publishedAt =
      existing.status === "published" && existing.publishedAt && existing.publishedAt.getTime() <= now.getTime()
        ? existing.publishedAt
        : now;
  }

  if (merged.slug !== existing.slug) {
    const taken = await posts.findOne(
      { slug: merged.slug, _id: { $ne: _id } },
      { projection: { _id: 1 } },
    );
    if (taken) {
      return { ok: false, error: "That URL slug is already taken.", field: "slug" };
    }
  }

  try {
    const updated = await posts.findOneAndUpdate(
      { _id },
      {
        $set: {
          title: merged.title,
          slug: merged.slug,
          excerpt: merged.excerpt,
          body: merged.body,
          cover: merged.cover,
          tags: merged.tags,
          status: "published",
          publishedAt,
          readingMinutes: readingMinutes(merged.body),
          updatedAt: now,
        },
      },
      { returnDocument: "after" },
    );
    if (!updated) return { ok: false, error: "Post not found." };

    await syncMediaUsage(db, _id, collectPostImageUrls(updated.body, updated.cover));
    const scheduled = publishedAt.getTime() > now.getTime();
    await logAudit(
      db,
      actor,
      scheduled ? "post.schedule" : "post.publish",
      updated.slug,
      scheduled ? `Scheduled for ${publishedAt.toISOString()}` : updated.title,
    );

    return { ok: true, post: updated, previousSlug: existing.slug, scheduled };
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return { ok: false, error: "That URL slug is already taken.", field: "slug" };
    }
    throw err;
  }
}

export async function unpublishPost(
  db: Db,
  actor: AdminDoc,
  postId: string,
  now = new Date(),
): Promise<{ ok: true; post: PostDoc } | { ok: false; error: string }> {
  if (!can(actor.role, "blog:write")) throw new Error("Forbidden");
  if (!ObjectId.isValid(postId)) return { ok: false, error: "Invalid post ID." };

  const posts = db.collection<PostDoc>(POSTS_COLLECTION);
  const updated = await posts.findOneAndUpdate(
    { _id: new ObjectId(postId) },
    { $set: { status: "draft", publishedAt: null, updatedAt: now } },
    { returnDocument: "after" },
  );
  if (!updated) return { ok: false, error: "Post not found." };

  await logAudit(db, actor, "post.unpublish", updated.slug, updated.title);
  return { ok: true, post: updated };
}

export async function duplicatePost(
  db: Db,
  actor: AdminDoc,
  postId: string,
  now = new Date(),
): Promise<{ ok: true; post: PostDoc } | { ok: false; error: string }> {
  if (!can(actor.role, "blog:write")) throw new Error("Forbidden");
  if (!ObjectId.isValid(postId)) return { ok: false, error: "Invalid post ID." };
  await ensureBlogIndexes(db);

  const posts = db.collection<PostDoc>(POSTS_COLLECTION);
  const source = await posts.findOne({ _id: new ObjectId(postId) });
  if (!source) return { ok: false, error: "Post not found." };

  const baseTitle = source.title.trim() || "Untitled post";
  const suffix = " (copy)";
  const title =
    baseTitle.length + suffix.length <= 140
      ? `${baseTitle}${suffix}`
      : `${baseTitle.slice(0, 140 - suffix.length)}${suffix}`;

  const slug = await ensureUniquePostSlug(db, `${source.slug}-copy`);

  const copy: PostDoc = {
    _id: new ObjectId(),
    title,
    slug,
    excerpt: source.excerpt,
    body: source.body,
    cover: source.cover,
    tags: source.tags,
    status: "draft",
    publishedAt: null,
    readingMinutes: readingMinutes(source.body),
    views: 0,
    likes: 0,
    shares: emptyShares(),
    hideStats: false,
    authorId: actor._id,
    authorName: actor.name,
    createdAt: now,
    updatedAt: now,
  };

  await posts.insertOne(copy);
  await syncMediaUsage(db, copy._id, collectPostImageUrls(copy.body, copy.cover));
  await logAudit(db, actor, "post.create", copy.slug, `Duplicated from ${source.slug}`);
  return { ok: true, post: copy };
}

export async function findPostExclusiveLifetimeMedia(
  db: Db,
  post: Pick<PostDoc, "_id" | "createdAt">,
): Promise<MediaDoc[]> {
  const mediaDocs = await db
    .collection<MediaDoc>(MEDIA_COLLECTION)
    .find({ usedBy: post._id })
    .toArray();

  return mediaDocs.filter(
    (m) =>
      m.usedBy.every((id) => id.equals(post._id)) &&
      m.uploadedAt.getTime() >= post.createdAt.getTime(),
  );
}

async function defaultDeleteBlob(url: string): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  }
  await del(url);
}

export async function deletePost(
  db: Db,
  actor: AdminDoc,
  postId: string,
  opts: { deleteBlob?: (url: string) => Promise<void> } = {},
): Promise<
  | { ok: true; slug: string; deletedMediaCount: number; failedMediaUrls: string[] }
  | { ok: false; error: string }
> {
  if (!can(actor.role, "blog:write")) throw new Error("Forbidden");
  if (!ObjectId.isValid(postId)) return { ok: false, error: "Invalid post ID." };

  const _id = new ObjectId(postId);
  const posts = db.collection<PostDoc>(POSTS_COLLECTION);
  const post = await posts.findOne({ _id });
  if (!post) return { ok: false, error: "Post not found." };

  const media = db.collection<MediaDoc>(MEDIA_COLLECTION);
  const deleteCandidates = await findPostExclusiveLifetimeMedia(db, post);

  await media.updateMany({ usedBy: _id }, { $pull: { usedBy: _id } });
  await posts.deleteOne({ _id });

  const idPrefixRegex = new RegExp(`^${_id.toString()}:`);
  await Promise.all([
    db.collection<PostLikeDoc>(POST_LIKES_COLLECTION).deleteMany({ postId: _id }),
    db.collection<PostStatsDailyDoc>(POST_STATS_DAILY_COLLECTION).deleteMany({ postId: _id }),
    db.collection<PostShareDoc>(POST_SHARES_COLLECTION).deleteMany({ _id: { $regex: idPrefixRegex } }),
    db.collection<PostViewDoc>(POST_VIEWS_COLLECTION).deleteMany({ _id: { $regex: idPrefixRegex } }),
  ]);

  const removeBlob = opts.deleteBlob ?? defaultDeleteBlob;
  let deletedMediaCount = 0;
  const failedMediaUrls: string[] = [];

  for (const item of deleteCandidates) {
    try {
      await removeBlob(item.url);
      await media.deleteOne({ _id: item._id });
      deletedMediaCount++;
    } catch {
      failedMediaUrls.push(item.url);
    }
  }

  await logAudit(
    db,
    actor,
    "post.delete",
    post.slug,
    deletedMediaCount > 0
      ? `Deleted ${deletedMediaCount} exclusive image(s)`
      : post.title || "Untitled draft",
  );

  return { ok: true, slug: post.slug, deletedMediaCount, failedMediaUrls };
}

export type AdminPostSort = "updated" | "views" | "likes" | "shares";

export async function queryAdminPosts(
  db: Db,
  opts: { q?: string; status?: "all" | DerivedPostStatus; sort?: AdminPostSort; now?: Date } = {},
): Promise<{
  items: SerializedAdminPost[];
  counts: { all: number; published: number; scheduled: number; draft: number };
}> {
  const now = opts.now ?? new Date();
  const sort = opts.sort ?? "updated";
  const col = db.collection<PostDoc>(POSTS_COLLECTION);

  let docs: PostDoc[];
  if (sort === "shares") {
    docs = await col
      .aggregate<PostDoc>([
        {
          $addFields: {
            _sharesTotal: {
              $add: [
                { $ifNull: ["$shares.copy", 0] },
                { $ifNull: ["$shares.x", 0] },
                { $ifNull: ["$shares.linkedin", 0] },
                { $ifNull: ["$shares.native", 0] },
              ],
            },
          },
        },
        { $sort: { _sharesTotal: -1, updatedAt: -1 } },
        { $project: { _sharesTotal: 0 } },
      ])
      .toArray();
  } else {
    const sortSpec: Record<string, 1 | -1> =
      sort === "views"
        ? { views: -1, updatedAt: -1 }
        : sort === "likes"
          ? { likes: -1, updatedAt: -1 }
          : { updatedAt: -1 };
    docs = await col.find({}).sort(sortSpec).toArray();
  }

  const serialized = docs.map((d) => serializeAdminPost(d, now));
  const counts = {
    all: serialized.length,
    published: 0,
    scheduled: 0,
    draft: 0,
  };
  for (const p of serialized) {
    counts[p.derivedStatus]++;
  }

  const statusFilter = opts.status ?? "all";
  const q = opts.q?.trim().toLowerCase() ?? "";

  const items = serialized.filter((p) => {
    if (statusFilter !== "all" && p.derivedStatus !== statusFilter) return false;
    if (q) {
      const hay = `${p.title} ${p.tags.join(" ")} ${p.slug}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return { items, counts };
}

export async function getAdminPostById(
  db: Db,
  id: string,
  now = new Date(),
): Promise<{ post: SerializedAdminPost; deletableMediaCount: number } | null> {
  if (!ObjectId.isValid(id)) return null;
  const _id = new ObjectId(id);
  const doc = await db.collection<PostDoc>(POSTS_COLLECTION).findOne({ _id });
  if (!doc) return null;
  const exclusiveMedia = await findPostExclusiveLifetimeMedia(db, doc);
  return {
    post: serializeAdminPost(doc, now),
    deletableMediaCount: exclusiveMedia.length,
  };
}

export async function getAllPostTags(db: Db): Promise<string[]> {
  const docs = await db
    .collection<PostDoc>(POSTS_COLLECTION)
    .find({}, { projection: { tags: 1 } })
    .toArray();
  const map = new Map<string, string>();
  for (const d of docs) {
    for (const t of d.tags) {
      const key = t.toLowerCase();
      if (!map.has(key)) map.set(key, t);
    }
  }
  return [...map.values()].sort((a, b) => a.localeCompare(b));
}
