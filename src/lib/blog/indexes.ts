import "server-only";
import type { Db, ObjectId } from "mongodb";
import type { PostShares } from "./engagement-types";

export const POSTS_COLLECTION = "posts";
export const MEDIA_COLLECTION = "media";
export const POST_VIEWS_COLLECTION = "post_views";
export const POST_LIKES_COLLECTION = "post_likes";
export const POST_SHARES_COLLECTION = "post_shares";
export const POST_STATS_DAILY_COLLECTION = "post_stats_daily";

export interface PostCover {
  url: string;
  alt: string;
  width: number;
  height: number;
}

export type PostStatus = "draft" | "published";

export interface PostDoc {
  _id: ObjectId;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  cover: PostCover | null;
  tags: string[];
  status: PostStatus;
  publishedAt: Date | null;
  readingMinutes: number;
  views: number;
  likes?: number;
  shares?: PostShares;
  hideStats?: boolean;
  authorId: ObjectId;
  authorName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MediaDoc {
  _id: ObjectId;
  url: string;
  pathname: string;
  contentType: string;
  size: number;
  width: number;
  height: number;
  usedBy: ObjectId[];
  uploadedBy: ObjectId;
  uploadedAt: Date;
}

export interface PostViewDoc {
  _id: string; // `${postId}:${ipHash}`
  expiresAt: Date;
}

export interface PostLikeDoc {
  _id: string; // `${postId}:${visitorHash}`
  postId: ObjectId;
  ipHash: string;
  createdAt: Date;
}

export interface PostShareDoc {
  _id: string; // `${postId}:${visitorHash}:${channel}`
  expiresAt: Date;
}

export interface PostStatsDailyDoc {
  _id: string; // `${postId}:${YYYY-MM-DD}`
  postId: ObjectId;
  date: string; // "YYYY-MM-DD" (UTC)
  views: number;
  likes: number;
  shares: PostShares;
}

const globalForBlogIndexes = globalThis as unknown as {
  _blogIndexes?: WeakMap<object, Map<string, Promise<void>>>;
};

export function ensureBlogIndexes(db: Db): Promise<void> {
  if (!globalForBlogIndexes._blogIndexes) {
    globalForBlogIndexes._blogIndexes = new WeakMap();
  }
  const clientKey: object = db.client ?? db;
  let perClient = globalForBlogIndexes._blogIndexes.get(clientKey);
  if (!perClient) {
    perClient = new Map();
    globalForBlogIndexes._blogIndexes.set(clientKey, perClient);
  }
  const existing = perClient.get(db.databaseName);
  if (existing) return existing;

  const promise = Promise.all([
    db.collection<PostDoc>(POSTS_COLLECTION).createIndex({ slug: 1 }, { unique: true }),
    db.collection<PostDoc>(POSTS_COLLECTION).createIndex({ status: 1, publishedAt: -1 }),
    db.collection<PostDoc>(POSTS_COLLECTION).createIndex({ tags: 1, publishedAt: -1 }),
    db.collection<MediaDoc>(MEDIA_COLLECTION).createIndex({ url: 1 }, { unique: true }),
    db.collection<MediaDoc>(MEDIA_COLLECTION).createIndex({ usedBy: 1 }),
    db
      .collection<PostViewDoc>(POST_VIEWS_COLLECTION)
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection<PostLikeDoc>(POST_LIKES_COLLECTION).createIndex({ postId: 1, ipHash: 1 }),
    db.collection<PostLikeDoc>(POST_LIKES_COLLECTION).createIndex({ postId: 1, createdAt: -1 }),
    db
      .collection<PostShareDoc>(POST_SHARES_COLLECTION)
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection<PostStatsDailyDoc>(POST_STATS_DAILY_COLLECTION).createIndex({ date: 1 }),
    db
      .collection<PostStatsDailyDoc>(POST_STATS_DAILY_COLLECTION)
      .createIndex({ postId: 1, date: 1 }),
  ])
    .then(() => undefined)
    .catch((err) => {
      perClient?.delete(db.databaseName);
      throw err;
    });

  perClient.set(db.databaseName, promise);
  return promise;
}
