import "server-only";
import type { Db } from "mongodb";
import { z } from "zod";
import { POSTS_COLLECTION, type PostDoc } from "./indexes";
import { SLUG_MAX_LENGTH, SLUG_REGEX } from "./slug";

export const blogSlugSchema = z.string().trim().min(1).max(SLUG_MAX_LENGTH).regex(SLUG_REGEX);

export function jsonNoStore(body: unknown, status: number, setCookie?: string): Response {
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (setCookie) headers.append("Set-Cookie", setCookie);
  return Response.json(body, { status, headers });
}

export function emptyNoStore(status: number): Response {
  return new Response(null, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function readJsonBody(request: Request): Promise<{ ok: true; data: unknown } | { ok: false }> {
  try {
    const text = await request.text();
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

export async function findLivePostForEngagement(
  db: Db,
  slug: string,
  now = new Date(),
): Promise<Pick<PostDoc, "_id" | "likes" | "hideStats"> | null> {
  return db.collection<PostDoc>(POSTS_COLLECTION).findOne(
    {
      slug,
      status: "published",
      publishedAt: { $lte: now },
    },
    { projection: { _id: 1, likes: 1, hideStats: 1 } },
  );
}
