import { z } from "zod";
import { consumeRateLimit } from "@/lib/admin/rate-limit";
import { recordShare } from "@/lib/blog/engagement";
import { shareChannelSchema } from "@/lib/blog/engagement-types";
import { ensureBlogIndexes } from "@/lib/blog/indexes";
import {
  blogSlugSchema,
  emptyNoStore,
  findLivePostForEngagement,
  jsonNoStore,
  readJsonBody,
} from "@/lib/blog/route-helpers";
import { clientIp, hashIp } from "@/lib/contact";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { rejectCrossSiteJsonPost } from "@/lib/request-guard";
import {
  hasNoTrackCookie,
  hashBlogVisitor,
  isLikelyBot,
  parseVisitorCookie,
} from "@/lib/visitor";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_PER_WINDOW = 30;

const shareBodySchema = z.object({
  slug: blogSlugSchema,
  channel: shareChannelSchema,
});

export async function POST(request: Request): Promise<Response> {
  const rejected = rejectCrossSiteJsonPost(request);
  if (rejected) return rejected;

  const body = await readJsonBody(request);
  if (!body.ok) {
    return jsonNoStore({ error: "Invalid JSON body." }, 400);
  }

  const parsed = shareBodySchema.safeParse(body.data);
  if (!parsed.success) {
    return jsonNoStore({ error: "Invalid share payload." }, 400);
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
    `blog-share:${ipHash}`,
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

  if (hasNoTrackCookie(request.headers) || isLikelyBot(request.headers.get("user-agent"))) {
    return emptyNoStore(204);
  }

  await recordShare(db, {
    postId: post._id,
    visitorHash: hashBlogVisitor(visitorId),
    channel: parsed.data.channel,
    now,
  });

  return emptyNoStore(204);
}
