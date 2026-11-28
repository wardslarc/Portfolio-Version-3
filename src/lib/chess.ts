import "server-only";
import { createHash } from "node:crypto";
import { isIPv4, isIPv6 } from "node:net";
import { Chess, DEFAULT_POSITION } from "chess.js";
import type { Collection, Db, ObjectId } from "mongodb";
import { z } from "zod";

import {
  VISITOR_COOKIE_MAX_AGE,
  VISITOR_COOKIE_NAME,
  formatVisitorSetCookie,
  parseVisitorCookie,
} from "./visitor";

export {
  VISITOR_COOKIE_MAX_AGE,
  VISITOR_COOKIE_NAME,
  formatVisitorSetCookie,
  parseVisitorCookie,
};

export const GAMES_COLLECTION = "chess_games";
export const LOCKS_COLLECTION = "chess_move_locks";
export const RATE_LIMITS_COLLECTION = "rate_limits";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_PER_WINDOW = 10;

export type GameStatus = "active" | "checkmate" | "stalemate" | "draw";
export type GameResult = "1-0" | "0-1" | "1/2-1/2" | null;
export type PromotionPiece = "q" | "r" | "b" | "n";
export type LockedBy = "you" | "network" | null;

export interface ChessMoveDoc {
  ply: number;
  san: string;
  from: string;
  to: string;
  promotion: PromotionPiece | null;
  moveId: string;
  city: string | null;
  country: string | null;
  playedAt: Date;
  visitorHash: string;
  ipHash: string;
}

export interface ChessGameDoc {
  _id?: ObjectId;
  number: number;
  status: GameStatus;
  result: GameResult;
  startFen: string;
  fen: string;
  version: number;
  visitorCount: number;
  moves: ChessMoveDoc[];
  startedAt: Date;
  endedAt: Date | null;
}

export interface ChessMoveLockDoc {
  _id: string; // "v:<visitorHash>" | "ip:<ipHash>"
  lockedUntil: Date;
  gameNumber: number;
  ply: number;
}

interface RateLimitDoc {
  _id: string;
  count: number;
  expiresAt: Date;
}

export interface PublicChessMove {
  ply: number;
  san: string;
  from: string;
  to: string;
  city: string | null;
  country: string | null;
  playedAt: string;
  isYou: boolean;
}

export interface ChessYouState {
  canMove: boolean;
  nextMoveAt: string | null;
  lockedBy: LockedBy;
}

export interface ChessApiPayload {
  game: {
    number: number;
    status: GameStatus;
    result: GameResult;
    fen: string;
    version: number;
    startedAt: string;
    moves: PublicChessMove[];
  };
  visitors: number;
  you: ChessYouState;
  serverNow: string;
}

const squareSchema = z.string().regex(/^[a-h][1-8]$/);

export const moveBodySchema = z.object({
  from: squareSchema,
  to: squareSchema,
  promotion: z.enum(["q", "r", "b", "n"]).optional(),
  version: z.number().int().min(0),
  // The game the visitor's board shows, so a tab left open from a finished game can't
  // land a move on the next game when the version numbers happen to match.
  gameNumber: z.number().int().min(1),
  moveId: z.string().uuid(),
});

export type MoveBodyInput = z.infer<typeof moveBodySchema>;

const globalForChessIndexes = globalThis as unknown as {
  _chessIndexes?: WeakMap<object, Map<string, Promise<void>>>;
  _chessRateLimitIndexes?: WeakMap<object, Map<string, Promise<string>>>;
};

function cacheDbOperation<T>(
  store: WeakMap<object, Map<string, Promise<T>>>,
  db: Db,
  fn: () => Promise<T>,
): Promise<T> {
  const clientKey: object = db.client ?? db;
  const dbName = db.databaseName ?? "";
  let byDb = store.get(clientKey);
  if (!byDb) {
    byDb = new Map();
    store.set(clientKey, byDb);
  }
  let pending = byDb.get(dbName);
  if (!pending) {
    pending = fn().catch((err) => {
      byDb.delete(dbName);
      throw err;
    });
    byDb.set(dbName, pending);
  }
  return pending;
}

export function ensureChessIndexes(db: Db): Promise<void> {
  const store = (globalForChessIndexes._chessIndexes ??= new WeakMap());
  return cacheDbOperation(store, db, async () => {
    const games = db.collection<ChessGameDoc>(GAMES_COLLECTION);
    const locks = db.collection<ChessMoveLockDoc>(LOCKS_COLLECTION);
    await Promise.all([
      games.createIndex({ number: 1 }, { unique: true }),
      games.createIndex({ status: 1 }, { unique: true, partialFilterExpression: { status: "active" } }),
      locks.createIndex({ lockedUntil: 1 }, { expireAfterSeconds: 0 }),
    ]);
  });
}

function ensureChessRateLimitIndex(db: Db): Promise<string> {
  const store = (globalForChessIndexes._chessRateLimitIndexes ??= new WeakMap());
  return cacheDbOperation(store, db, () =>
    db.collection<RateLimitDoc>(RATE_LIMITS_COLLECTION).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  );
}

export function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === 11000;
}

function hasErrorLabel(err: unknown, label: string): boolean {
  if (typeof err !== "object" || err === null) return false;
  if ("hasErrorLabel" in err && typeof (err as { hasErrorLabel?: unknown }).hasErrorLabel === "function") {
    return (err as { hasErrorLabel: (l: string) => boolean }).hasErrorLabel(label);
  }
  if ("errorLabels" in err && Array.isArray((err as { errorLabels?: unknown }).errorLabels)) {
    return (err as { errorLabels: unknown[] }).errorLabels.includes(label);
  }
  return false;
}

function getChessSalt(): string {
  const salt = process.env.CHESS_HASH_SALT;
  if (salt) return salt;
  if (process.env.NODE_ENV === "production") {
    throw new Error("CHESS_HASH_SALT is not set");
  }
  return "dev-chess-salt";
}

export function getMoveCooldownMs(): number {
  const raw = process.env.CHESS_MOVE_COOLDOWN_MS;
  if (!raw) return 86_400_000;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 86_400_000;
}

function ipv4ToHextets(ipv4: string): [string, string] {
  const octets = ipv4.split(".").map((part) => Number(part));
  const high = ((octets[0]! << 8) | octets[1]!).toString(16).padStart(4, "0");
  const low = ((octets[2]! << 8) | octets[3]!).toString(16).padStart(4, "0");
  return [high, low];
}

/**
 * Normalizes an IP address to a prefix for rate-limiting and move locking:
 * full IPv4 address, or the expanded first 4 hextets (/64) of an IPv6 address.
 */
export function normalizeIpPrefix(rawIp: string): string {
  let ip = rawIp.trim();
  if (!ip) return "unknown";

  if (ip.startsWith("[")) {
    const close = ip.indexOf("]");
    if (close !== -1) ip = ip.slice(1, close);
  }

  const zoneIndex = ip.indexOf("%");
  if (zoneIndex !== -1) ip = ip.slice(0, zoneIndex);

  if (isIPv4(ip)) return ip;

  // Strip port on IPv4 like "203.0.113.10:12345"
  const colonCount = (ip.match(/:/g) ?? []).length;
  if (colonCount === 1) {
    const hostPart = ip.split(":")[0]!;
    if (isIPv4(hostPart)) return hostPart;
  }

  if (isIPv6(ip)) {
    const mappedMatch = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
    if (mappedMatch && isIPv4(mappedMatch[1]!)) {
      return mappedMatch[1]!;
    }

    const halves = ip.split("::");
    const leftRaw = halves[0] ? halves[0].split(":").filter(Boolean) : [];
    const rightRaw = halves.length > 1 && halves[1] ? halves[1].split(":").filter(Boolean) : [];

    const expandEmbeddedV4 = (parts: string[]): string[] => {
      const last = parts[parts.length - 1];
      if (last && isIPv4(last)) {
        const [h1, h2] = ipv4ToHextets(last);
        return [...parts.slice(0, -1), h1, h2];
      }
      return parts;
    };

    const left = expandEmbeddedV4(leftRaw);
    const right = expandEmbeddedV4(rightRaw);
    const missing = Math.max(0, 8 - (left.length + right.length));
    const full = [...left, ...Array<string>(missing).fill("0"), ...right]
      .slice(0, 8)
      .map((h) => h.toLowerCase().padStart(4, "0"));

    return full.slice(0, 4).join(":");
  }

  return ip.toLowerCase();
}

export function hashVisitorId(visitorId: string): string {
  return createHash("sha256").update(`${getChessSalt()}:v:${visitorId}`).digest("hex");
}

export function hashChessIp(rawIp: string): string {
  const prefix = normalizeIpPrefix(rawIp);
  return createHash("sha256").update(`${getChessSalt()}:ip:${prefix}`).digest("hex");
}

export function geoFromHeaders(headers: Headers): { city: string | null; country: string | null } {
  const rawCity = headers.get("x-vercel-ip-city");
  let city: string | null = null;
  if (rawCity) {
    try {
      city = decodeURIComponent(rawCity).trim().slice(0, 100) || null;
    } catch {
      city = rawCity.trim().slice(0, 100) || null;
    }
  }
  const rawCountry = headers.get("x-vercel-ip-country");
  const country = rawCountry ? rawCountry.trim().slice(0, 16) || null : null;
  return { city, country };
}

export { isSameOrigin } from "./request-guard";

export function matchesIfNoneMatch(headerValue: string | null, etag: string): boolean {
  if (!headerValue) return false;
  const trimmed = headerValue.trim();
  if (trimmed === "*") return true;
  return trimmed
    .split(",")
    .map((part) => part.trim().replace(/^W\//i, ""))
    .includes(etag);
}

export function formatEtag(gameNumber: number, version: number): string {
  return `"g${gameNumber}-v${version}"`;
}

export async function checkChessRateLimit(db: Db, ipHash: string, nowMs = Date.now()): Promise<boolean> {
  await ensureChessRateLimitIndex(db);
  const limits = db.collection<RateLimitDoc>(RATE_LIMITS_COLLECTION);
  const windowStart = Math.floor(nowMs / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
  const filter = { _id: `chess:${ipHash}:${windowStart}` };
  const update = {
    $inc: { count: 1 },
    $setOnInsert: { expiresAt: new Date(windowStart + 2 * RATE_LIMIT_WINDOW_MS) },
  };

  for (let attempt = 0; ; attempt++) {
    try {
      const doc = await limits.findOneAndUpdate(filter, update, {
        upsert: true,
        returnDocument: "after",
      });
      return (doc?.count ?? 1) <= RATE_LIMIT_MAX_PER_WINDOW;
    } catch (err) {
      if (attempt < 2 && isDuplicateKeyError(err)) continue;
      throw err;
    }
  }
}

export async function getActiveGameMeta(db: Db): Promise<{ number: number; version: number } | null> {
  const games = db.collection<ChessGameDoc>(GAMES_COLLECTION);
  return games.findOne({ status: "active" }, { projection: { _id: 0, number: 1, version: 1 } });
}

export async function getOrCreateActiveGame(db: Db): Promise<ChessGameDoc> {
  const games = db.collection<ChessGameDoc>(GAMES_COLLECTION);
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await games.findOne({ status: "active" });
    if (existing) return existing;

    const latest = await games
      .find({}, { projection: { number: 1 } })
      .sort({ number: -1 })
      .limit(1)
      .next();
    const nextNumber = (latest?.number ?? 0) + 1;
    const now = new Date();
    const newGame: ChessGameDoc = {
      number: nextNumber,
      status: "active",
      result: null,
      startFen: DEFAULT_POSITION,
      fen: DEFAULT_POSITION,
      version: 0,
      visitorCount: 0,
      moves: [],
      startedAt: now,
      endedAt: null,
    };

    try {
      const res = await games.insertOne(newGame);
      return { ...newGame, _id: res.insertedId };
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        const created = await games.findOne({ status: "active" });
        if (created) return created;
        continue;
      }
      throw err;
    }
  }
  throw new Error("Failed to acquire active chess game");
}

export async function getLockStatus(
  db: Db,
  visitorHash: string,
  ipHash: string,
  now: Date,
): Promise<ChessYouState> {
  const locks = db.collection<ChessMoveLockDoc>(LOCKS_COLLECTION);
  const vKey = `v:${visitorHash}`;
  const ipKey = `ip:${ipHash}`;
  const found = await locks
    .find({ _id: { $in: [vKey, ipKey] }, lockedUntil: { $gt: now } })
    .toArray();

  if (found.length === 0) {
    return { canMove: true, nextMoveAt: null, lockedBy: null };
  }

  const vLock = found.find((l) => l._id === vKey);
  const maxUntil = found.reduce(
    (max, l) => (l.lockedUntil.getTime() > max ? l.lockedUntil.getTime() : max),
    0,
  );
  return {
    canMove: false,
    nextMoveAt: new Date(maxUntil).toISOString(),
    lockedBy: vLock ? "you" : "network",
  };
}

export function serializeGamePayload(
  game: ChessGameDoc,
  visitorHash: string,
  you: ChessYouState,
  now: Date,
): ChessApiPayload {
  return {
    game: {
      number: game.number,
      status: game.status,
      result: game.result,
      fen: game.fen,
      version: game.version,
      startedAt: game.startedAt.toISOString(),
      moves: game.moves.map((m) => ({
        ply: m.ply,
        san: m.san,
        from: m.from,
        to: m.to,
        city: m.city,
        country: m.country,
        playedAt: m.playedAt.toISOString(),
        isYou: m.visitorHash === visitorHash,
      })),
    },
    visitors: game.visitorCount,
    you,
    serverNow: now.toISOString(),
  };
}

export function lockedMessage(lockedBy: LockedBy): string {
  return lockedBy === "network"
    ? "Someone on your network already moved today."
    : "You already made a move today.";
}

class StaleVersionError extends Error {}

export type MoveTxResult =
  | { ok: true; updatedGame: ChessGameDoc; lockedUntil: Date }
  | { ok: false; reason: "locked" | "stale" };

export async function commitMoveTransaction(params: {
  db: Db;
  game: ChessGameDoc;
  newMove: ChessMoveDoc;
  nextFen: string;
  nextStatus: GameStatus;
  nextResult: GameResult;
  nextEndedAt: Date | null;
  isNewVisitor: boolean;
  visitorHash: string;
  ipHash: string;
  now: Date;
  lockedUntil: Date;
}): Promise<MoveTxResult> {
  const {
    db,
    game,
    newMove,
    nextFen,
    nextStatus,
    nextResult,
    nextEndedAt,
    isNewVisitor,
    visitorHash,
    ipHash,
    now,
    lockedUntil,
  } = params;

  const games: Collection<ChessGameDoc> = db.collection(GAMES_COLLECTION);
  const locks: Collection<ChessMoveLockDoc> = db.collection(LOCKS_COLLECTION);

  for (let attempt = 1; attempt <= 3; attempt++) {
    const session = db.client.startSession();
    try {
      session.startTransaction({
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      });

      for (const key of [`v:${visitorHash}`, `ip:${ipHash}`]) {
        await locks.updateOne(
          { _id: key, lockedUntil: { $lte: now } },
          { $set: { lockedUntil, gameNumber: game.number, ply: newMove.ply } },
          { upsert: true, session },
        );
      }

      const res = await games.updateOne(
        { _id: game._id, version: game.version, status: "active" },
        {
          $push: { moves: newMove },
          $set: { fen: nextFen, status: nextStatus, result: nextResult, endedAt: nextEndedAt },
          $inc: { version: 1, visitorCount: isNewVisitor ? 1 : 0 },
        },
        { session },
      );

      if (res.matchedCount === 0) {
        throw new StaleVersionError();
      }

      for (let commitAttempt = 0; ; commitAttempt++) {
        try {
          await session.commitTransaction();
          break;
        } catch (commitErr) {
          if (commitAttempt < 3 && hasErrorLabel(commitErr, "UnknownTransactionCommitResult")) {
            continue;
          }
          throw commitErr;
        }
      }

      const updatedGame: ChessGameDoc = {
        ...game,
        status: nextStatus,
        result: nextResult,
        fen: nextFen,
        version: game.version + 1,
        visitorCount: game.visitorCount + (isNewVisitor ? 1 : 0),
        moves: [...game.moves, newMove],
        endedAt: nextEndedAt,
      };
      return { ok: true, updatedGame, lockedUntil };
    } catch (err) {
      try {
        await session.abortTransaction();
      } catch {
        // Ignore if server already aborted the transaction.
      }

      if (isDuplicateKeyError(err)) {
        return { ok: false, reason: "locked" };
      }
      if (err instanceof StaleVersionError) {
        return { ok: false, reason: "stale" };
      }
      if (hasErrorLabel(err, "TransientTransactionError") && attempt < 3) {
        const latest = await games.findOne(
          { _id: game._id },
          { projection: { version: 1, status: 1 } },
        );
        if (!latest || latest.version !== game.version || latest.status !== "active") {
          return { ok: false, reason: "stale" };
        }
        continue;
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }

  throw new Error("Transaction exhausted retries");
}

export function validateAndApplyMove(
  game: ChessGameDoc,
  input: MoveBodyInput,
  now: Date,
):
  | {
      ok: true;
      san: string;
      from: string;
      to: string;
      promotion: PromotionPiece | null;
      nextFen: string;
      nextStatus: GameStatus;
      nextResult: GameResult;
      nextEndedAt: Date | null;
    }
  | { ok: false } {
  const chess = new Chess(game.startFen);
  for (const stored of game.moves) {
    chess.move(stored.san);
  }

  try {
    const move = chess.move({
      from: input.from,
      to: input.to,
      promotion: input.promotion ?? "q",
    });

    let nextStatus: GameStatus = "active";
    let nextResult: GameResult = null;
    let nextEndedAt: Date | null = null;

    if (chess.isCheckmate()) {
      nextStatus = "checkmate";
      nextResult = move.color === "w" ? "1-0" : "0-1";
      nextEndedAt = now;
    } else if (chess.isStalemate()) {
      nextStatus = "stalemate";
      nextResult = "1/2-1/2";
      nextEndedAt = now;
    } else if (chess.isDraw()) {
      nextStatus = "draw";
      nextResult = "1/2-1/2";
      nextEndedAt = now;
    }

    return {
      ok: true,
      san: move.san,
      from: move.from,
      to: move.to,
      promotion: (move.promotion as PromotionPiece | undefined) ?? null,
      nextFen: chess.fen(),
      nextStatus,
      nextResult,
      nextEndedAt,
    };
  } catch {
    return { ok: false };
  }
}
