import "server-only";
import { del, head, type HeadBlobResult } from "@vercel/blob";
import { ObjectId, type Db } from "mongodb";
import { logAudit } from "@/lib/admin/audit";
import type { AdminDoc } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { MEDIA_COLLECTION, ensureBlogIndexes, type MediaDoc } from "./indexes";

export const ALLOWED_BLOB_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

export const MAX_BLOB_SIZE_BYTES = 8 * 1024 * 1024;
const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

export interface SerializedMedia {
  id: string;
  url: string;
  pathname: string;
  filename: string;
  contentType: string;
  size: number;
  width: number;
  height: number;
  usedByCount: number;
  uploadedAt: string;
}

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function isValidBlobUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (!host.endsWith(BLOB_HOST_SUFFIX) || host.length <= BLOB_HOST_SUFFIX.length) {
      return false;
    }
    if (!parsed.pathname.startsWith("/blog/") || parsed.pathname.includes("..")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function serializeMedia(doc: MediaDoc): SerializedMedia {
  const filename = doc.pathname.split("/").pop() || doc.pathname;
  return {
    id: doc._id.toString(),
    url: doc.url,
    pathname: doc.pathname,
    filename,
    contentType: doc.contentType,
    size: doc.size,
    width: doc.width,
    height: doc.height,
    usedByCount: doc.usedBy.length,
    uploadedAt: doc.uploadedAt.toISOString(),
  };
}

export async function registerMedia(
  db: Db,
  actor: AdminDoc,
  input: { url: string; width: number; height: number },
  opts: {
    headBlob?: (url: string) => Promise<Pick<HeadBlobResult, "size" | "contentType" | "pathname">>;
    now?: Date;
  } = {},
): Promise<{ ok: true; media: SerializedMedia } | { ok: false; error: string }> {
  if (!can(actor.role, "blog:write")) throw new Error("Forbidden");
  await ensureBlogIndexes(db);

  if (!isValidBlobUrl(input.url)) {
    return { ok: false, error: "Invalid Vercel Blob URL." };
  }
  if (
    !Number.isFinite(input.width) ||
    !Number.isFinite(input.height) ||
    input.width < 1 ||
    input.height < 1
  ) {
    return { ok: false, error: "Invalid image dimensions." };
  }

  let meta: Pick<HeadBlobResult, "size" | "contentType" | "pathname">;
  try {
    meta = await (opts.headBlob ?? head)(input.url);
  } catch {
    return { ok: false, error: "Uploaded file could not be verified in Blob storage." };
  }

  if (!meta.pathname.startsWith("blog/")) {
    return { ok: false, error: "Invalid Blob pathname." };
  }
  if (!ALLOWED_BLOB_CONTENT_TYPES.includes(meta.contentType as (typeof ALLOWED_BLOB_CONTENT_TYPES)[number])) {
    return { ok: false, error: "Unsupported Blob content type." };
  }
  if (meta.size > MAX_BLOB_SIZE_BYTES) {
    return { ok: false, error: "Uploaded file exceeds 8 MB limit." };
  }

  const now = opts.now ?? new Date();
  const width = Math.round(input.width);
  const height = Math.round(input.height);

  const doc = await db.collection<MediaDoc>(MEDIA_COLLECTION).findOneAndUpdate(
    { url: input.url },
    {
      $setOnInsert: {
        _id: new ObjectId(),
        url: input.url,
        usedBy: [],
        uploadedBy: actor._id,
        uploadedAt: now,
      },
      $set: {
        pathname: meta.pathname,
        contentType: meta.contentType,
        size: meta.size,
        width,
        height,
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  if (!doc) {
    return { ok: false, error: "Failed to save media record." };
  }

  await logAudit(db, actor, "media.upload", meta.pathname, `${meta.size} bytes`);
  return { ok: true, media: serializeMedia(doc) };
}

export async function deleteMediaItem(
  db: Db,
  actor: AdminDoc,
  mediaId: string,
  opts: { deleteBlob?: (url: string) => Promise<void> } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!can(actor.role, "blog:write")) throw new Error("Forbidden");
  if (!ObjectId.isValid(mediaId)) return { ok: false, error: "Invalid media ID." };

  const _id = new ObjectId(mediaId);
  const col = db.collection<MediaDoc>(MEDIA_COLLECTION);
  const existing = await col.findOne({ _id });
  if (!existing) return { ok: false, error: "Image not found." };

  if (existing.usedBy.length > 0) {
    return { ok: false, error: "Remove this image from posts before deleting it." };
  }

  const removeBlob =
    opts.deleteBlob ??
    (async (url: string) => {
      if (!isBlobConfigured()) {
        throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
      }
      await del(url);
    });

  try {
    await removeBlob(existing.url);
  } catch {
    return { ok: false, error: "Could not delete image from Vercel Blob." };
  }

  const res = await col.deleteOne({ _id, usedBy: { $size: 0 } });
  if (res.deletedCount === 0) {
    return { ok: false, error: "Image is currently used by a post." };
  }

  await logAudit(db, actor, "media.delete", existing.pathname, existing.url);
  return { ok: true };
}

export async function queryMediaLibrary(
  db: Db,
  opts: { q?: string; filter?: "all" | "unused" } = {},
): Promise<{ items: SerializedMedia[]; totalCount: number; totalBytes: number }> {
  const docs = await db
    .collection<MediaDoc>(MEDIA_COLLECTION)
    .find({})
    .sort({ uploadedAt: -1 })
    .toArray();

  const totalCount = docs.length;
  const totalBytes = docs.reduce((sum, d) => sum + d.size, 0);

  const q = opts.q?.trim().toLowerCase() ?? "";
  const filter = opts.filter ?? "all";

  const items = docs
    .filter((d) => {
      if (filter === "unused" && d.usedBy.length > 0) return false;
      if (q) {
        const filename = (d.pathname.split("/").pop() || d.pathname).toLowerCase();
        if (!filename.includes(q)) return false;
      }
      return true;
    })
    .map(serializeMedia);

  return { items, totalCount, totalBytes };
}
