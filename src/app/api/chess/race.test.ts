import { Chess } from "chess.js";
import { MongoClient, type Db } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Multi-round race check: every turn, a crowd of visitors (plus visitors who already moved,
// retrying from a second tab) submit moves at once. Afterwards the stored data must satisfy
// the spec's invariants, whatever order the requests landed in.

vi.mock("server-only", () => ({}));

let currentDb: Db;
vi.mock("@/lib/mongodb", () => ({
  isMongoConfigured: () => true,
  getDb: async () => currentDb,
}));

const { GET } = await import("./route");
const { POST } = await import("./move/route");
const { GAMES_COLLECTION, LOCKS_COLLECTION, ensureChessIndexes, hashChessIp, hashVisitorId } =
  await import("@/lib/chess");

let replSet: MongoMemoryReplSet;
let client: MongoClient;

beforeAll(async () => {
  process.env.CHESS_HASH_SALT = "race-test-salt";
  process.env.CHESS_MOVE_COOLDOWN_MS = "86400000";
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, ip: "127.0.0.1" } });
  client = await MongoClient.connect(replSet.getUri());
  currentDb = client.db("chess_race");
  await ensureChessIndexes(currentDb);
}, 60_000);

afterAll(async () => {
  await client?.close();
  await replSet?.stop();
});

interface Visitor {
  id: string;
  ip: string;
}

function post(v: Visitor, body: object): Promise<Response> {
  return POST(
    new Request("http://localhost/api/chess/move", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost",
        "x-forwarded-for": v.ip,
        cookie: `visitor_id=${v.id}`,
      },
      body: JSON.stringify(body),
    }),
  );
}

async function board(): Promise<{ number: number; version: number; fen: string }> {
  const res = await GET(new Request("http://localhost/api/chess", { headers: { "x-forwarded-for": "198.51.100.250" } }));
  const body = await res.json();
  return { number: body.game.number, version: body.game.version, fen: body.game.fen };
}

describe("visitor chess under concurrent load", () => {
  it("keeps one move per turn and one move per visitor across many racing rounds", async () => {
    const ROUNDS = 6;
    const CROWD = 25;
    const movedBefore: Visitor[] = [];
    let visitorSeq = 0;
    const tally = { 201: 0, 409: 0, 429: 0, other: 0 };

    for (let round = 0; round < ROUNDS; round++) {
      const { number, version, fen } = await board();
      const legal = new Chess(fen).moves({ verbose: true });

      const crowd: Visitor[] = Array.from({ length: CROWD }, () => {
        visitorSeq++;
        return { id: crypto.randomUUID(), ip: `10.${round}.${Math.floor(visitorSeq / 250)}.${visitorSeq % 250}` };
      });
      // Everyone who already won a turn tries again from a second tab at the same time.
      const contenders = [...crowd, ...movedBefore];

      const responses = await Promise.all(
        contenders.map((v, i) => {
          const m = legal[i % legal.length]!;
          return post(v, { from: m.from, to: m.to, version, gameNumber: number, moveId: crypto.randomUUID() });
        }),
      );

      const winners = contenders.filter((_, i) => responses[i]!.status === 201);
      for (const r of responses) {
        const k = r.status as 201 | 409 | 429;
        if (k in tally) tally[k]++;
        else tally.other++;
      }

      expect(winners).toHaveLength(1);
      // A visitor who already moved must never win again inside the cooldown.
      expect(movedBefore).not.toContain(winners[0]);
      movedBefore.push(winners[0]!);
    }

    expect(tally.other).toBe(0);

    const games = await currentDb.collection(GAMES_COLLECTION).find().toArray();
    expect(games).toHaveLength(1);
    const game = games[0]!;

    // Invariant 1: one move per turn, and the stored position is exactly the replayed moves.
    expect(game.moves).toHaveLength(ROUNDS);
    expect(game.version).toBe(ROUNDS);
    expect(game.moves.map((m: { ply: number }) => m.ply)).toEqual(Array.from({ length: ROUNDS }, (_, i) => i + 1));
    const replay = new Chess();
    for (const m of game.moves) replay.move(m.san);
    expect(replay.fen()).toBe(game.fen);

    // Invariant 2: every stored move has both of its locks, and no other locks exist.
    const lockIds = (await currentDb.collection(LOCKS_COLLECTION).find().toArray()).map((l) => l._id).sort();
    const expected = movedBefore.flatMap((v) => [`v:${hashVisitorId(v.id)}`, `ip:${hashChessIp(v.ip)}`]).sort();
    expect(lockIds).toEqual(expected);

    // Each winner moved exactly once.
    const movers = new Set(game.moves.map((m: { visitorHash: string }) => m.visitorHash));
    expect(movers.size).toBe(ROUNDS);
    expect(game.visitorCount).toBe(ROUNDS);

    // Refused requests all came back as 409 (lost the race) or 429 (already moved).
    expect(tally[201]).toBe(ROUNDS);
    expect(tally[409] + tally[429]).toBe(ROUNDS * CROWD + (ROUNDS * (ROUNDS - 1)) / 2 - ROUNDS);
  }, 120_000);
});
