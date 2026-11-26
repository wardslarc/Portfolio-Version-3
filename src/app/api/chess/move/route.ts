import { clientIp } from "@/lib/contact";
import {
  GAMES_COLLECTION,
  checkChessRateLimit,
  commitMoveTransaction,
  ensureChessIndexes,
  formatVisitorSetCookie,
  geoFromHeaders,
  getLockStatus,
  getMoveCooldownMs,
  getOrCreateActiveGame,
  hashChessIp,
  hashVisitorId,
  isSameOrigin,
  lockedMessage,
  moveBodySchema,
  parseVisitorCookie,
  serializeGamePayload,
  validateAndApplyMove,
  type ChessGameDoc,
  type ChessMoveDoc,
} from "@/lib/chess";
import { getDb, isMongoConfigured } from "@/lib/mongodb";

function jsonNoStore(body: unknown, status: number, setCookie?: string): Response {
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (setCookie) headers.append("Set-Cookie", setCookie);
  return Response.json(body, { status, headers });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonNoStore({ error: "Cross-origin requests are not allowed." }, 403);
  }

  const contentType = (request.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    return jsonNoStore({ error: "Content-Type must be application/json." }, 415);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON payload." }, 400);
  }

  const parsed = moveBodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonNoStore({ error: "Invalid move payload." }, 400);
  }
  const input = parsed.data;

  if (!isMongoConfigured()) {
    console.error("Chess move POST used but MONGODB_URI is not set");
    return jsonNoStore({ error: "Visitor chess isn't available right now." }, 503);
  }

  const { visitorId, isNew } = parseVisitorCookie(request.headers);
  const setCookie = isNew ? formatVisitorSetCookie(visitorId) : undefined;

  try {
    const db = await getDb();
    await ensureChessIndexes(db);

    const visitorHash = hashVisitorId(visitorId);
    const ipHash = hashChessIp(clientIp(request.headers));
    const { city, country } = geoFromHeaders(request.headers);
    const now = new Date();

    const withinRateLimit = await checkChessRateLimit(db, ipHash, now.getTime());
    if (!withinRateLimit) {
      return jsonNoStore(
        { error: "Too many move requests. Please wait a few minutes." },
        429,
        setCookie,
      );
    }

    const game = await getOrCreateActiveGame(db);

    // Idempotent retry if this visitor already committed this exact moveId.
    const alreadyPlayed = game.moves.some(
      (m) => m.moveId === input.moveId && m.visitorHash === visitorHash,
    );
    if (alreadyPlayed) {
      const you = await getLockStatus(db, visitorHash, ipHash, now);
      return jsonNoStore(serializeGamePayload(game, visitorHash, you, now), 200, setCookie);
    }

    if (input.gameNumber !== game.number || input.version !== game.version) {
      const you = await getLockStatus(db, visitorHash, ipHash, now);
      return jsonNoStore(
        {
          error: "Someone moved first. The board has been updated.",
          ...serializeGamePayload(game, visitorHash, you, now),
        },
        409,
        setCookie,
      );
    }

    const lockState = await getLockStatus(db, visitorHash, ipHash, now);
    if (!lockState.canMove) {
      return jsonNoStore(
        {
          error: lockedMessage(lockState.lockedBy),
          nextMoveAt: lockState.nextMoveAt,
          lockedBy: lockState.lockedBy,
        },
        429,
        setCookie,
      );
    }

    const applied = validateAndApplyMove(game, input, now);
    if (!applied.ok) {
      return jsonNoStore({ error: "That move isn't allowed." }, 400, setCookie);
    }

    const isNewVisitor = !game.moves.some((m) => m.visitorHash === visitorHash);
    const lockedUntil = new Date(now.getTime() + getMoveCooldownMs());
    const newMove: ChessMoveDoc = {
      ply: game.moves.length + 1,
      san: applied.san,
      from: applied.from,
      to: applied.to,
      promotion: applied.promotion,
      moveId: input.moveId,
      city,
      country,
      playedAt: now,
      visitorHash,
      ipHash,
    };

    const txResult = await commitMoveTransaction({
      db,
      game,
      newMove,
      nextFen: applied.nextFen,
      nextStatus: applied.nextStatus,
      nextResult: applied.nextResult,
      nextEndedAt: applied.nextEndedAt,
      isNewVisitor,
      visitorHash,
      ipHash,
      now,
      lockedUntil,
    });

    if (!txResult.ok) {
      const freshNow = new Date();
      if (txResult.reason === "locked") {
        const freshLock = await getLockStatus(db, visitorHash, ipHash, freshNow);
        const lockedBy = freshLock.lockedBy ?? "you";
        return jsonNoStore(
          {
            error: lockedMessage(lockedBy),
            nextMoveAt: freshLock.nextMoveAt ?? lockedUntil.toISOString(),
            lockedBy,
          },
          429,
          setCookie,
        );
      }

      const freshGame =
        (await db.collection<ChessGameDoc>(GAMES_COLLECTION).findOne({ _id: game._id })) ??
        (await getOrCreateActiveGame(db));
      const freshLock = await getLockStatus(db, visitorHash, ipHash, freshNow);
      return jsonNoStore(
        {
          error: "Someone moved first. The board has been updated.",
          ...serializeGamePayload(freshGame, visitorHash, freshLock, freshNow),
        },
        409,
        setCookie,
      );
    }

    return jsonNoStore(
      serializeGamePayload(
        txResult.updatedGame,
        visitorHash,
        {
          canMove: false,
          nextMoveAt: txResult.lockedUntil.toISOString(),
          lockedBy: "you",
        },
        now,
      ),
      201,
      setCookie,
    );
  } catch (err) {
    console.error("Failed to commit chess move", err);
    return jsonNoStore({ error: "The board is busy, try again." }, 503, setCookie);
  }
}
