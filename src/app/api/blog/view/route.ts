import { z } from "zod";
import { consumeRateLimit } from "@/lib/admin/rate-limit";
import {
  POSTS_COLLECTION,
  POST_VIEWS_COLLECTION,
  ensureBlogIndexes,
  type PostDoc,
  type PostViewDoc,
} from "@/lib/blog/indexes";
import { SLUG_MAX_LENGTH, SLUG_REGEX } from "@/lib/blog/slug";
import { clientIp, hashIp } from "@/lib/contact";
import { getDb, isMongoConfigured } from "@/lib/mongodb";

const VIEW_TTL_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_PER_WINDOW = 60;

const viewBodySchema = z.object({
  slug: z.string().trim().min(1).max(SLUG_MAX_LENGTH).regex(SLUG_REGEX),
});

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === 11000
  );
}

export async function POST(request: Request): Promise<Response> {
  let raw: unknown;
  try {
    const text = await request.text();
    raw = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = viewBodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "Invalid slug." }, { status: 400 });
  }

  if (!isMongoConfigured()) {
    return new Response(null, { status: 503 });
  }

  const db = await getDb();
  await ensureBlogIndexes(db);

  const ipHash = hashIp(clientIp(request.headers));
  const allowed = await consumeRateLimit(
    db,
    `blog-view:${ipHash}`,
    RATE_LIMIT_WINDOW_MS,
    RATE_LIMIT_MAX_PER_WINDOW,
  );
  if (!allowed) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  const now = new Date();
  const posts = db.collection<PostDoc>(POSTS_COLLECTION);
  const post = await posts.findOne(
    {
      slug: parsed.data.slug,
      status: "published",
      publishedAt: { $lte: now },
    },
    { projection: { _id: 1 } },
  );
  if (!post) {
    return new Response(null, { status: 404 });
  }

  const viewsCol = db.collection<PostViewDoc>(POST_VIEWS_COLLECTION);
  try {
    await viewsCol.insertOne({
      _id: `${post._id.toString()}:${ipHash}`,
      expiresAt: new Date(now.getTime() + VIEW_TTL_MS),
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return new Response(null, { status: 204 });
    }
    throw err;
  }

  await posts.updateOne(
    { _id: post._id, status: "published", publishedAt: { $lte: now } },
    { $inc: { views: 1 } },
  );

  return new Response(null, { status: 204 });
}
