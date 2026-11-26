import { clientIp } from "@/lib/contact";
import {
  ensureChessIndexes,
  formatEtag,
  formatVisitorSetCookie,
  getActiveGameMeta,
  getLockStatus,
  getOrCreateActiveGame,
  hashChessIp,
  hashVisitorId,
  matchesIfNoneMatch,
  parseVisitorCookie,
  serializeGamePayload,
} from "@/lib/chess";
import { getDb, isMongoConfigured } from "@/lib/mongodb";

export async function GET(request: Request) {
  const { visitorId, isNew } = parseVisitorCookie(request.headers);

  if (!isMongoConfigured()) {
    console.error("Chess GET used but MONGODB_URI is not set");
    return Response.json(
      { error: "Visitor chess isn't available right now." },
      { status: 503, headers: { "Cache-Control": "private, no-cache" } },
    );
  }

  try {
    const db = await getDb();
    await ensureChessIndexes(db);

    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch) {
      const meta = await getActiveGameMeta(db);
      if (meta) {
        const etag = formatEtag(meta.number, meta.version);
        if (matchesIfNoneMatch(ifNoneMatch, etag)) {
          const headers = new Headers({
            ETag: etag,
            "Cache-Control": "private, no-cache",
          });
          if (isNew) headers.append("Set-Cookie", formatVisitorSetCookie(visitorId));
          return new Response(null, { status: 304, headers });
        }
      }
    }

    const game = await getOrCreateActiveGame(db);
    const visitorHash = hashVisitorId(visitorId);
    const ipHash = hashChessIp(clientIp(request.headers));
    const now = new Date();
    const you = await getLockStatus(db, visitorHash, ipHash, now);

    const etag = formatEtag(game.number, game.version);
    const headers = new Headers({
      ETag: etag,
      "Cache-Control": "private, no-cache",
    });
    if (isNew) headers.append("Set-Cookie", formatVisitorSetCookie(visitorId));

    return Response.json(serializeGamePayload(game, visitorHash, you, now), {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error("Failed to load chess game", err);
    return Response.json(
      { error: "Unable to load the chess board right now." },
      { status: 503, headers: { "Cache-Control": "private, no-cache" } },
    );
  }
}
