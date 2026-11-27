import { z } from "zod";
import { consumeRateLimit } from "@/lib/admin/rate-limit";
import { setLike } from "@/lib/blog/engagement";
import { POST_LIKES_COLLECTION, ensureBlogIndexes, type PostLikeDoc } from "@/lib/blog/indexes";
import {
  blogSlugSchema,
  emptyNoStore,
  findLivePostForEngagement,
  jsonNoStore,
  readJsonBody,
} from "@/lib/blog/route-helpers";
import { clientIp, hashIp } from "@/lib/contact";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import {
  hasNoTrackCookie,
  hashBlogVisitor,
  isLikelyBot,
  parseVisitorCookie,
} from "@/lib/visitor";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_PER_WINDOW = 30;

const likeBodySchema = z.object({
  slug: blogSlugSchema,
  liked: z.boolean(),
});

export async function POST(request: Request): Promise<Response> {
  const body = await readJsonBody(request);
  if (!body.ok) {
    return jsonNoStore({ error: "Invalid JSON body." }, 400);
  }

  const parsed = likeBodySchema.safeParse(body.data);
  if (!parsed.success) {
    return jsonNoStore({ error: "Invalid like payload." }, 400);
  }

  const { visitorId, isNew } = parseVisitorCookie(request.headers);
  if (isNew) {
    return jsonNoStore({ error: "Reload the page and try again." }, 400);
  }

  if (!isMongoConfigured()) {
    return emptyNoStore(503);
  }

  const db = await getDb();
  await ensureBlogIndexes(db);

  const ipHash = hashIp(clientIp(request.headers));
  const allowed = await consumeRateLimit(
    db,
    `blog-like:${ipHash}`,
    RATE_LIMIT_WINDOW_MS,
    RATE_LIMIT_MAX_PER_WINDOW,
  );
  if (!allowed) {
    return jsonNoStore({ error: "Too many requests." }, 429);
  }

  const now = new Date();
  const post = await findLivePostForEngagement(db, parsed.data.slug, now);
  if (!post) {
    return emptyNoStore(404);
  }

  const visitorHash = hashBlogVisitor(visitorId);
  if (hasNoTrackCookie(request.headers) || isLikelyBot(request.headers.get("user-agent"))) {
    const existingLike = await db
      .collection<PostLikeDoc>(POST_LIKES_COLLECTION)
      .findOne({ _id: `${post._id.toString()}:${visitorHash}` }, { projection: { _id: 1 } });
    return jsonNoStore(
      {
        liked: Boolean(existingLike),
        likes: post.likes ?? 0,
        tracked: false,
      },
      200,
    );
  }

  const result = await setLike(db, {
    postId: post._id,
    visitorHash,
    ipHash,
    liked: parsed.data.liked,
    now,
  });

  return jsonNoStore({ ...result, tracked: true }, 200);
}
