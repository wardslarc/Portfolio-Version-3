import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Filter } from "mongodb";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { POSTS_COLLECTION, type PostCover, type PostDoc } from "./indexes";

export const BLOG_PAGE_SIZE = 10;

export interface PublicPostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  cover: PostCover | null;
  tags: string[];
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
  authorName: string;
}

export interface PublicPostDetail extends PublicPostSummary {
  body: string;
}

function liveFilter(now = new Date()): Filter<PostDoc> {
  return {
    status: "published",
    publishedAt: { $lte: now },
  };
}

function serializeSummary(doc: PostDoc): PublicPostSummary {
  return {
    id: doc._id.toString(),
    title: doc.title,
    slug: doc.slug,
    excerpt: doc.excerpt,
    cover: doc.cover,
    tags: doc.tags,
    publishedAt: (doc.publishedAt ?? doc.createdAt).toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    readingMinutes: doc.readingMinutes,
    authorName: doc.authorName,
  };
}

function serializeDetail(doc: PostDoc): PublicPostDetail {
  return {
    ...serializeSummary(doc),
    body: doc.body,
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getLivePosts(opts: { tag?: string; page?: number } = {}): Promise<{
  items: PublicPostSummary[];
  total: number;
  page: number;
  totalPages: number;
}> {
  "use cache";
  cacheTag("posts");
  cacheLife({ stale: 300, revalidate: 900, expire: 86_400 });

  if (!isMongoConfigured()) {
    return { items: [], total: 0, page: 1, totalPages: 1 };
  }

  try {
    const db = await getDb();
    const col = db.collection<PostDoc>(POSTS_COLLECTION);
    const now = new Date();
    const filter: Filter<PostDoc> = liveFilter(now);

    const tag = opts.tag?.trim();
    if (tag) {
      filter.tags = { $regex: new RegExp(`^${escapeRegex(tag)}$`, "i") };
    }

    const total = await col.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE));
    const page = Math.min(Math.max(1, opts.page ?? 1), totalPages);
    const skip = (page - 1) * BLOG_PAGE_SIZE;

    const docs = await col
      .find(filter, { projection: { body: 0 } })
      .sort({ publishedAt: -1, _id: -1 })
      .skip(skip)
      .limit(BLOG_PAGE_SIZE)
      .toArray();

    return {
      items: docs.map(serializeSummary),
      total,
      page,
      totalPages,
    };
  } catch {
    return { items: [], total: 0, page: 1, totalPages: 1 };
  }
}

export async function getLivePostBySlug(slug: string): Promise<PublicPostDetail | null> {
  "use cache";
  cacheTag("posts", `post:${slug}`);
  cacheLife({ stale: 300, revalidate: 900, expire: 86_400 });

  if (!isMongoConfigured()) return null;

  try {
    const db = await getDb();
    const doc = await db
      .collection<PostDoc>(POSTS_COLLECTION)
      .findOne({ slug, ...liveFilter(new Date()) });
    return doc ? serializeDetail(doc) : null;
  } catch {
    return null;
  }
}

export async function getAdjacentPosts(post: {
  publishedAt: string;
  slug: string;
}): Promise<{
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
}> {
  "use cache";
  cacheTag("posts");
  cacheLife({ stale: 300, revalidate: 900, expire: 86_400 });

  if (!isMongoConfigured()) return { prev: null, next: null };

  try {
    const db = await getDb();
    const col = db.collection<PostDoc>(POSTS_COLLECTION);
    const now = new Date();
    const currentPublishedAt = new Date(post.publishedAt);

    const [prevDoc, nextDoc] = await Promise.all([
      col.findOne(
        {
          ...liveFilter(now),
          slug: { $ne: post.slug },
          publishedAt: { $lte: currentPublishedAt },
        },
        {
          sort: { publishedAt: -1, _id: -1 },
          projection: { slug: 1, title: 1 },
        },
      ),
      col.findOne(
        {
          status: "published",
          slug: { $ne: post.slug },
          publishedAt: { $gt: currentPublishedAt, $lte: now },
        },
        {
          sort: { publishedAt: 1, _id: 1 },
          projection: { slug: 1, title: 1 },
        },
      ),
    ]);

    return {
      prev: prevDoc ? { slug: prevDoc.slug, title: prevDoc.title } : null,
      next: nextDoc ? { slug: nextDoc.slug, title: nextDoc.title } : null,
    };
  } catch {
    return { prev: null, next: null };
  }
}

export async function getAllTags(): Promise<string[]> {
  "use cache";
  cacheTag("posts");
  cacheLife({ stale: 300, revalidate: 900, expire: 86_400 });

  if (!isMongoConfigured()) return [];

  try {
    const db = await getDb();
    const docs = await db
      .collection<PostDoc>(POSTS_COLLECTION)
      .find(liveFilter(new Date()), { projection: { tags: 1 } })
      .toArray();

    const map = new Map<string, string>();
    for (const d of docs) {
      for (const t of d.tags) {
        const key = t.toLowerCase();
        if (!map.has(key)) map.set(key, t);
      }
    }
    return [...map.values()].sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export async function getLatestPosts(limit = 3): Promise<PublicPostSummary[]> {
  "use cache";
  cacheTag("posts");
  cacheLife({ stale: 300, revalidate: 900, expire: 86_400 });

  if (!isMongoConfigured()) return [];

  try {
    const db = await getDb();
    const docs = await db
      .collection<PostDoc>(POSTS_COLLECTION)
      .find(liveFilter(new Date()), { projection: { body: 0 } })
      .sort({ publishedAt: -1, _id: -1 })
      .limit(limit)
      .toArray();
    return docs.map(serializeSummary);
  } catch {
    return [];
  }
}

export async function getLivePostSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
  "use cache";
  cacheTag("posts");
  cacheLife({ stale: 300, revalidate: 900, expire: 86_400 });

  if (!isMongoConfigured()) return [];

  try {
    const db = await getDb();
    const docs = await db
      .collection<PostDoc>(POSTS_COLLECTION)
      .find(liveFilter(new Date()), { projection: { slug: 1, updatedAt: 1 } })
      .sort({ publishedAt: -1 })
      .toArray();
    return docs.map((d) => ({ slug: d.slug, updatedAt: d.updatedAt }));
  } catch {
    return [];
  }
}

export async function getRecentLivePostsForRss(limit = 20): Promise<PublicPostDetail[]> {
  "use cache";
  cacheTag("posts");
  cacheLife({ stale: 300, revalidate: 900, expire: 86_400 });

  if (!isMongoConfigured()) return [];

  try {
    const db = await getDb();
    const docs = await db
      .collection<PostDoc>(POSTS_COLLECTION)
      .find(liveFilter(new Date()))
      .sort({ publishedAt: -1, _id: -1 })
      .limit(limit)
      .toArray();
    return docs.map(serializeDetail);
  } catch {
    return [];
  }
}
