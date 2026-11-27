import { consumeRateLimit } from "@/lib/admin/rate-limit";
import { getPublicEngagement } from "@/lib/blog/engagement";
import { ensureBlogIndexes } from "@/lib/blog/indexes";
import {
  blogSlugSchema,
  emptyNoStore,
  findLivePostForEngagement,
  jsonNoStore,
} from "@/lib/blog/route-helpers";
import { clientIp, hashIp } from "@/lib/contact";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { formatVisitorSetCookie, hashBlogVisitor, parseVisitorCookie } from "@/lib/visitor";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_PER_WINDOW = 120;

export async function GET(request: Request): Promise<Response> {
  const slugParam = new URL(request.url).searchParams.get("slug") ?? "";
  const parsedSlug = blogSlugSchema.safeParse(slugParam);
  if (!parsedSlug.success) {
    return jsonNoStore({ error: "Invalid slug." }, 400);
  }

  if (!isMongoConfigured()) {
    return emptyNoStore(503);
  }

  const db = await getDb();
  await ensureBlogIndexes(db);

  const ipHash = hashIp(clientIp(request.headers));
  const allowed = await consumeRateLimit(
    db,
    `blog-eng:${ipHash}`,
    RATE_LIMIT_WINDOW_MS,
    RATE_LIMIT_MAX_PER_WINDOW,
  );
  if (!allowed) {
    return jsonNoStore({ error: "Too many requests." }, 429);
  }

  const now = new Date();
  const post = await findLivePostForEngagement(db, parsedSlug.data, now);
  if (!post) {
    return emptyNoStore(404);
  }

  const { visitorId, isNew } = parseVisitorCookie(request.headers);
  const visitorHash = isNew ? null : hashBlogVisitor(visitorId);
  const payload = await getPublicEngagement(db, post._id, visitorHash);

  return jsonNoStore(payload, 200, isNew ? formatVisitorSetCookie(visitorId) : undefined);
}
