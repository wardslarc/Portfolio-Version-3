import "server-only";
import { Chess } from "chess.js";
import { ObjectId, type Db } from "mongodb";
import {
  GAMES_COLLECTION,
  LOCKS_COLLECTION,
  getOrCreateActiveGame,
  type ChessGameDoc,
  type ChessMoveLockDoc,
} from "@/lib/chess";
import { logAudit } from "./audit";
import type { AdminDoc } from "./auth";
import type { MessageRecord } from "./data";
import { can } from "./permissions";

export async function mutateMessageRead(
  db: Db,
  admin: AdminDoc,
  id: string,
  read: boolean,
): Promise<boolean> {
  if (!can(admin.role, "messages:mutate")) throw new Error("Forbidden");
  if (!ObjectId.isValid(id)) throw new Error("Invalid message id");

  const res = await db.collection<MessageRecord>("messages").updateOne(
    { _id: new ObjectId(id) },
    { $set: { readAt: read ? new Date() : null } },
  );
  if (res.matchedCount === 0) return false;
  await logAudit(db, admin, read ? "message.mark_read" : "message.mark_unread", id);
  return true;
}

export async function mutateMessageArchive(
  db: Db,
  admin: AdminDoc,
  id: string,
  archived: boolean,
): Promise<boolean> {
  if (!can(admin.role, "messages:mutate")) throw new Error("Forbidden");
  if (!ObjectId.isValid(id)) throw new Error("Invalid message id");

  const res = await db.collection<MessageRecord>("messages").updateOne(
    { _id: new ObjectId(id) },
    { $set: { archivedAt: archived ? new Date() : null } },
  );
  if (res.matchedCount === 0) return false;
  await logAudit(db, admin, archived ? "message.archive" : "message.unarchive", id);
  return true;
}

export async function mutateMessageDelete(
  db: Db,
  admin: AdminDoc,
  id: string,
): Promise<boolean> {
  if (!can(admin.role, "messages:mutate")) throw new Error("Forbidden");
  if (!ObjectId.isValid(id)) throw new Error("Invalid message id");

  const res = await db.collection<MessageRecord>("messages").deleteOne({ _id: new ObjectId(id) });
  if (res.deletedCount === 0) return false;
  await logAudit(db, admin, "message.delete", id);
  return true;
}

function isTransientTxError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "errorLabels" in err &&
    Array.isArray((err as { errorLabels?: unknown }).errorLabels) &&
    ((err as { errorLabels: string[] }).errorLabels.includes("TransientTransactionError") ||
      (err as { errorLabels: string[] }).errorLabels.includes("UnknownTransactionCommitResult"))
  );
}

export async function undoLastChessMove(
  db: Db,
  admin: AdminDoc,
  gameNumber: number,
  expectedVersion?: number,
): Promise<{ ok: true; newVersion: number; undoneSan: string } | { ok: false; reason: "nothing_to_undo" | "stale" }> {
  if (!can(admin.role, "chess:mutate")) throw new Error("Forbidden");

  const games = db.collection<ChessGameDoc>(GAMES_COLLECTION);
  const locks = db.collection<ChessMoveLockDoc>(LOCKS_COLLECTION);

  for (let attempt = 1; attempt <= 3; attempt++) {
    const session = db.client.startSession();
    try {
      session.startTransaction({
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      });

      const game = await games.findOne({ number: gameNumber }, { session });
      if (!game || game.status !== "active" || game.moves.length === 0) {
        await session.abortTransaction();
        return { ok: false, reason: "nothing_to_undo" };
      }
      if (expectedVersion !== undefined && game.version !== expectedVersion) {
        await session.abortTransaction();
        return { ok: false, reason: "stale" };
      }

      const lastMove = game.moves[game.moves.length - 1]!;
      const remainingMoves = game.moves.slice(0, -1);

      const chess = new Chess(game.startFen);
      for (const m of remainingMoves) {
        chess.move({
          from: m.from,
          to: m.to,
          ...(m.promotion ? { promotion: m.promotion } : {}),
        });
      }

      const res = await games.updateOne(
        { _id: game._id, version: game.version, status: "active" },
        {
          $set: { moves: remainingMoves, fen: chess.fen() },
          $inc: { version: 1 },
        },
        { session },
      );

      if (res.matchedCount === 0) {
        await session.abortTransaction();
        return { ok: false, reason: "stale" };
      }

      await locks.deleteMany(
        {
          _id: { $in: [`v:${lastMove.visitorHash}`, `ip:${lastMove.ipHash}`] },
          gameNumber: game.number,
          ply: lastMove.ply,
        },
        { session },
      );

      await session.commitTransaction();
      await logAudit(
        db,
        admin,
        "chess.undo_move",
        `Game ${game.number}`,
        `Undid ply ${lastMove.ply} (${lastMove.san})`,
      );
      return { ok: true, newVersion: game.version + 1, undoneSan: lastMove.san };
    } catch (err) {
      await session.abortTransaction().catch(() => {});
      if (attempt < 3 && isTransientTxError(err)) continue;
      throw err;
    } finally {
      await session.endSession();
    }
  }

  return { ok: false, reason: "stale" };
}

export async function clearChessCooldown(
  db: Db,
  admin: AdminDoc,
  visitorHashOrPrefix: string,
): Promise<{ deletedCount: number }> {
  if (!can(admin.role, "chess:mutate")) throw new Error("Forbidden");
  const clean = visitorHashOrPrefix.trim().toLowerCase();
  if (!/^[0-9a-f]{8,64}$/.test(clean)) {
    throw new Error("Invalid visitor hash.");
  }

  const locks = db.collection<ChessMoveLockDoc>(LOCKS_COLLECTION);
  const session = db.client.startSession();
  try {
    session.startTransaction({
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
    });

    const filter =
      clean.length === 64
        ? { _id: `v:${clean}` }
        : { _id: { $regex: new RegExp(`^v:${clean}`) } };
    const res = await locks.deleteMany(filter, { session });
    await session.commitTransaction();
    await logAudit(
      db,
      admin,
      "chess.clear_cooldown",
      clean.slice(0, 8),
      `Cleared ${res.deletedCount} lock(s)`,
    );
    return { deletedCount: res.deletedCount };
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    throw err;
  } finally {
    await session.endSession();
  }
}

export async function endChessGame(
  db: Db,
  admin: AdminDoc,
  gameNumber: number,
): Promise<{ ok: true; nextGameNumber: number } | { ok: false; reason: "not_active" }> {
  if (!can(admin.role, "chess:mutate")) throw new Error("Forbidden");
  const games = db.collection<ChessGameDoc>(GAMES_COLLECTION);

  const session = db.client.startSession();
  try {
    session.startTransaction({
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
    });

    const res = await games.updateOne(
      { number: gameNumber, status: "active" },
      {
        $set: { status: "draw", result: "1/2-1/2", endedAt: new Date() },
        $inc: { version: 1 },
      },
      { session },
    );

    if (res.matchedCount === 0) {
      await session.abortTransaction();
      return { ok: false, reason: "not_active" };
    }

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    throw err;
  } finally {
    await session.endSession();
  }

  const nextGame = await getOrCreateActiveGame(db);
  await logAudit(
    db,
    admin,
    "chess.end_game",
    `Game ${gameNumber}`,
    `Ended as draw; started Game ${nextGame.number}`,
  );
  return { ok: true, nextGameNumber: nextGame.number };
}
