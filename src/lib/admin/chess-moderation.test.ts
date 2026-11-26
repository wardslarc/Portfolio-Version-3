import { Chess } from "chess.js";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChessMoveLockDoc } from "@/lib/chess";

vi.mock("server-only", () => ({}));

const {
  GAMES_COLLECTION,
  LOCKS_COLLECTION,
  commitMoveTransaction,
  ensureChessIndexes,
  formatEtag,
  getOrCreateActiveGame,
} = await import("@/lib/chess");

const { clearChessCooldown, endChessGame, undoLastChessMove } = await import("./mutations");

describe("admin chess moderation", () => {
  let replSet: MongoMemoryReplSet;
  let client: MongoClient;
  let db: Db;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    client = await MongoClient.connect(replSet.getUri());
    db = client.db("admin_chess_mod_test");
    await ensureChessIndexes(db);
  });

  afterAll(async () => {
    await client?.close();
    await replSet?.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      db.collection(GAMES_COLLECTION).deleteMany({}),
      db.collection(LOCKS_COLLECTION).deleteMany({}),
      db.collection("admin_audit").deleteMany({}),
    ]);
  });

  const adminUser = {
    _id: new ObjectId(),
    email: "admin@example.com",
    name: "Admin",
    role: "admin" as const,
    passwordHash: "x",
    backupCodeHashes: [],
    createdAt: new Date(),
    passwordChangedAt: null,
    lastSignInAt: null,
    disabledAt: null,
  };

  const viewerUser = {
    ...adminUser,
    _id: new ObjectId(),
    email: "viewer@example.com",
    name: "Viewer",
    role: "viewer" as const,
  };

  it("undoes the last move, increments version, recomputes fen, and deletes ply locks", async () => {
    const game = await getOrCreateActiveGame(db);
    const chess = new Chess(game.startFen);
    const m1 = chess.move({ from: "e2", to: "e4" });
    const now = new Date();
    const visitorHash = "a".repeat(64);
    const ipHash = "b".repeat(64);

    const tx = await commitMoveTransaction({
      db,
      game,
      newMove: {
        ply: 1,
        san: m1.san,
        from: "e2",
        to: "e4",
        promotion: null,
        moveId: "11111111-1111-4111-8111-111111111111",
        city: "Makati",
        country: "PH",
        playedAt: now,
        visitorHash,
        ipHash,
      },
      nextFen: chess.fen(),
      nextStatus: "active",
      nextResult: null,
      nextEndedAt: null,
      isNewVisitor: true,
      visitorHash,
      ipHash,
      now,
      lockedUntil: new Date(now.getTime() + 86_400_000),
    });
    expect(tx.ok).toBe(true);
    if (!tx.ok) return;

    const undone = await undoLastChessMove(db, adminUser, game.number);
    expect(undone).toEqual({ ok: true, newVersion: 2, undoneSan: "e4" });

    const reloaded = await db.collection(GAMES_COLLECTION).findOne({ number: game.number });
    expect(reloaded?.version).toBe(2);
    expect(reloaded?.fen).toBe(game.startFen);
    expect(reloaded?.moves).toHaveLength(0);
    expect(formatEtag(reloaded!.number, reloaded!.version)).toBe('"g1-v2"');

    // Locks for ply 1 were removed
    expect(await db.collection(LOCKS_COLLECTION).countDocuments({})).toBe(0);

    // Audit entry recorded
    const audit = await db.collection("admin_audit").findOne({ action: "chess.undo_move" });
    expect(audit?.detail).toContain("e4");
  });

  it("handles a concurrent visitor move during undo cleanly via optimistic version check", async () => {
    const game = await getOrCreateActiveGame(db);
    const chess = new Chess(game.startFen);
    const m1 = chess.move({ from: "e2", to: "e4" });
    const now = new Date();

    const tx1 = await commitMoveTransaction({
      db,
      game,
      newMove: {
        ply: 1,
        san: m1.san,
        from: "e2",
        to: "e4",
        promotion: null,
        moveId: "11111111-1111-4111-8111-111111111111",
        city: null,
        country: null,
        playedAt: now,
        visitorHash: "a".repeat(64),
        ipHash: "b".repeat(64),
      },
      nextFen: chess.fen(),
      nextStatus: "active",
      nextResult: null,
      nextEndedAt: null,
      isNewVisitor: true,
      visitorHash: "a".repeat(64),
      ipHash: "b".repeat(64),
      now,
      lockedUntil: new Date(now.getTime() + 86_400_000),
    });
    expect(tx1.ok).toBe(true);
    if (!tx1.ok) return;

    // Visitor 2 prepares a move at version 1, racing against admin undo at version 1
    const m2 = chess.move({ from: "e7", to: "e5" });
    const [visitorRes, undoRes] = await Promise.all([
      commitMoveTransaction({
        db,
        game: tx1.updatedGame,
        newMove: {
          ply: 2,
          san: m2.san,
          from: "e7",
          to: "e5",
          promotion: null,
          moveId: "22222222-2222-4222-8222-222222222222",
          city: null,
          country: null,
          playedAt: now,
          visitorHash: "c".repeat(64),
          ipHash: "d".repeat(64),
        },
        nextFen: chess.fen(),
        nextStatus: "active",
        nextResult: null,
        nextEndedAt: null,
        isNewVisitor: true,
        visitorHash: "c".repeat(64),
        ipHash: "d".repeat(64),
        now,
        lockedUntil: new Date(now.getTime() + 86_400_000),
      }),
      undoLastChessMove(db, adminUser, game.number, tx1.updatedGame.version),
    ]);

    // Exactly one succeeds, the other fails cleanly with reason: "stale"
    const successes = [visitorRes.ok, undoRes.ok].filter(Boolean);
    expect(successes).toHaveLength(1);
    if (!visitorRes.ok) expect(visitorRes.reason).toBe("stale");
    if (!undoRes.ok) expect(undoRes.reason).toBe("stale");
  });

  it("clears cooldown locks, ends games cleanly, and blocks Viewer", async () => {
    const game = await getOrCreateActiveGame(db);
    const visitorHash = "deadbeef".repeat(8);
    await db.collection<ChessMoveLockDoc>(LOCKS_COLLECTION).insertOne({
      _id: `v:${visitorHash}`,
      lockedUntil: new Date(Date.now() + 86_400_000),
      gameNumber: game.number,
      ply: 1,
    });

    await expect(undoLastChessMove(db, viewerUser, game.number)).rejects.toThrow("Forbidden");
    await expect(clearChessCooldown(db, viewerUser, "deadbeef")).rejects.toThrow("Forbidden");
    await expect(endChessGame(db, viewerUser, game.number)).rejects.toThrow("Forbidden");

    const cleared = await clearChessCooldown(db, adminUser, "deadbeef");
    expect(cleared.deletedCount).toBe(1);

    const ended = await endChessGame(db, adminUser, game.number);
    expect(ended).toEqual({ ok: true, nextGameNumber: 2 });

    const g1 = await db.collection(GAMES_COLLECTION).findOne({ number: 1 });
    const g2 = await db.collection(GAMES_COLLECTION).findOne({ number: 2 });
    expect(g1?.status).toBe("draw");
    expect(g2?.status).toBe("active");
  });
});
