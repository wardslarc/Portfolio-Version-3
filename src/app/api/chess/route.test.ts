import { Chess } from "chess.js";
import { MongoClient, type Db } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let currentDb: Db;
let mongoConfigured = true;

vi.mock("@/lib/mongodb", () => ({
  isMongoConfigured: () => mongoConfigured,
  getDb: async () => currentDb,
}));

const { GET } = await import("./route");
const { POST } = await import("./move/route");
const {
  GAMES_COLLECTION,
  LOCKS_COLLECTION,
  ensureChessIndexes,
  hashChessIp,
  hashVisitorId,
} = await import("@/lib/chess");

let replSet: MongoMemoryReplSet;
let client: MongoClient;
let dbCounter = 0;

function makeGetRequest(opts?: {
  visitorId?: string;
  ip?: string;
  ifNoneMatch?: string;
}): Request {
  const headers = new Headers();
  if (opts?.ip) headers.set("x-forwarded-for", opts.ip);
  if (opts?.visitorId) headers.set("cookie", `visitor_id=${opts.visitorId}`);
  if (opts?.ifNoneMatch) headers.set("if-none-match", opts.ifNoneMatch);
  return new Request("http://localhost/api/chess", { method: "GET", headers });
}

function makeMoveRequest(
  body: unknown,
  opts?: {
    visitorId?: string;
    ip?: string;
    origin?: string | null;
    contentType?: string | null;
    city?: string;
    country?: string;
  },
): Request {
  const headers = new Headers();
  if (opts?.contentType !== null) {
    headers.set("content-type", opts?.contentType ?? "application/json");
  }
  if (opts?.origin !== null) {
    headers.set("origin", opts?.origin ?? "http://localhost");
  }
  headers.set("x-forwarded-for", opts?.ip ?? "203.0.113.10");
  if (opts?.visitorId) headers.set("cookie", `visitor_id=${opts.visitorId}`);
  if (opts?.city) headers.set("x-vercel-ip-city", opts.city);
  if (opts?.country) headers.set("x-vercel-ip-country", opts.country);

  // Moves default to Game 1 unless a test names another game.
  const payload =
    typeof body === "object" && body !== null && !("gameNumber" in body) ? { gameNumber: 1, ...body } : body;
  return new Request("http://localhost/api/chess/move", {
    method: "POST",
    headers,
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

function extractVisitorIdFromSetCookie(res: Response): string {
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = /visitor_id=([^;]+)/.exec(setCookie);
  if (!match) throw new Error(`Missing visitor_id Set-Cookie: ${setCookie}`);
  return match[1]!;
}

beforeAll(async () => {
  delete process.env.MONGODB_URI;
  delete process.env.MONGODB_DB;
  process.env.CHESS_HASH_SALT = "test-chess-salt";
  process.env.CHESS_MOVE_COOLDOWN_MS = "86400000";

  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, ip: "127.0.0.1" },
  });
  client = await MongoClient.connect(replSet.getUri());
}, 60_000);

afterAll(async () => {
  await client?.close();
  await replSet?.stop();
});

beforeEach(async () => {
  mongoConfigured = true;
  currentDb = client.db(`chess_test_${++dbCounter}`);
  await ensureChessIndexes(currentDb);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Visitor Chess API", () => {
  it("1. handles 20 parallel POSTs from different visitors with exactly one 201 and nineteen 409s", async () => {
    const initial = await GET(makeGetRequest({ ip: "198.51.100.1" }));
    expect(initial.status).toBe(200);

    const N = 20;
    const visitors = Array.from({ length: N }, (_, i) => ({
      visitorId: crypto.randomUUID(),
      ip: `198.51.100.${i + 10}`,
      moveId: crypto.randomUUID(),
    }));

    const responses = await Promise.all(
      visitors.map((v) =>
        POST(
          makeMoveRequest(
            { from: "e2", to: "e4", version: 0, moveId: v.moveId },
            { visitorId: v.visitorId, ip: v.ip },
          ),
        ),
      ),
    );

    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(N - 1);

    const winnerIdx = statuses.indexOf(201);
    const winner = visitors[winnerIdx]!;

    const game = await currentDb.collection(GAMES_COLLECTION).findOne({ status: "active" });
    expect(game?.moves).toHaveLength(1);
    expect(game?.version).toBe(1);

    const locks = await currentDb.collection(LOCKS_COLLECTION).find().toArray();
    expect(locks).toHaveLength(2);
    const lockIds = locks.map((l) => l._id).sort();
    expect(lockIds).toEqual(
      [`ip:${hashChessIp(winner.ip)}`, `v:${hashVisitorId(winner.visitorId)}`].sort(),
    );
  });

  it("2. handles 10 parallel POSTs from one visitor with different moveIds: one 201, rest 429 or 409, one move", async () => {
    await GET(makeGetRequest({ ip: "198.51.100.50" }));
    const visitorId = crypto.randomUUID();
    const ip = "198.51.100.50";

    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        POST(
          makeMoveRequest(
            { from: "e2", to: "e4", version: 0, moveId: crypto.randomUUID() },
            { visitorId, ip },
          ),
        ),
      ),
    );

    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.every((s) => s === 201 || s === 429 || s === 409)).toBe(true);

    const game = await currentDb.collection(GAMES_COLLECTION).findOne({ status: "active" });
    expect(game?.moves).toHaveLength(1);
  });

  it("3. blocks a visitor from moving both White and Black immediately at the new version", async () => {
    const visitorA = crypto.randomUUID();
    const visitorB = crypto.randomUUID();

    // Visitor A plays White (1. e4)
    const r1 = await POST(
      makeMoveRequest(
        { from: "e2", to: "e4", version: 0, moveId: crypto.randomUUID() },
        { visitorId: visitorA, ip: "203.0.113.1" },
      ),
    );
    expect(r1.status).toBe(201);

    // Visitor B plays Black (1... e5)
    const r2 = await POST(
      makeMoveRequest(
        { from: "e7", to: "e5", version: 1, moveId: crypto.randomUUID() },
        { visitorId: visitorB, ip: "203.0.113.2" },
      ),
    );
    expect(r2.status).toBe(201);

    // Visitor B immediately tries to play White (2. Nf3) at version 2 -> 429
    const r3 = await POST(
      makeMoveRequest(
        { from: "g1", to: "f3", version: 2, moveId: crypto.randomUUID() },
        { visitorId: visitorB, ip: "203.0.113.2" },
      ),
    );
    expect(r3.status).toBe(429);
    const body3 = await r3.json();
    expect(body3.lockedBy).toBe("you");
  });

  it("4. treats the same moveId twice from the same visitor as an idempotent retry (201 then 200)", async () => {
    const visitorId = crypto.randomUUID();
    const moveId = crypto.randomUUID();

    const first = await POST(
      makeMoveRequest(
        { from: "d2", to: "d4", version: 0, moveId },
        { visitorId, ip: "203.0.113.20" },
      ),
    );
    expect(first.status).toBe(201);
    const firstBody = await first.json();

    const retry = await POST(
      makeMoveRequest(
        { from: "d2", to: "d4", version: 0, moveId },
        { visitorId, ip: "203.0.113.20" },
      ),
    );
    expect(retry.status).toBe(200);
    const retryBody = await retry.json();
    expect(retryBody.game.version).toBe(1);
    expect(retryBody.game.moves).toHaveLength(1);
    expect(retryBody.game.fen).toBe(firstBody.game.fen);
  });

  it("5. rolls back both lock documents and the move if an error occurs inside the transaction after lock claim", async () => {
    await GET(makeGetRequest({ ip: "203.0.113.30" }));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const realGames = currentDb.collection(GAMES_COLLECTION);
    vi.spyOn(realGames, "updateOne").mockRejectedValueOnce(new Error("Injected games update failure"));

    const realCollection = currentDb.collection.bind(currentDb);
    vi.spyOn(currentDb, "collection").mockImplementation(((name: string) => {
      if (name === GAMES_COLLECTION) return realGames;
      return realCollection(name);
    }) as typeof currentDb.collection);

    const res = await POST(
      makeMoveRequest(
        { from: "e2", to: "e4", version: 0, moveId: crypto.randomUUID() },
        { visitorId: crypto.randomUUID(), ip: "203.0.113.30" },
      ),
    );
    expect(res.status).toBe(503);
    expect(errorSpy).toHaveBeenCalled();

    expect(await currentDb.collection(LOCKS_COLLECTION).countDocuments()).toBe(0);
    const game = await realGames.findOne({ status: "active" });
    expect(game?.moves).toHaveLength(0);
    expect(game?.version).toBe(0);
  });

  it("6. blocks a new cookie on a locked IP with lockedBy='network', including same IPv6 /64", async () => {
    const cookie1 = crypto.randomUUID();
    const res1 = await POST(
      makeMoveRequest(
        { from: "e2", to: "e4", version: 0, moveId: crypto.randomUUID() },
        { visitorId: cookie1, ip: "2001:db8:abcd:1::10" },
      ),
    );
    expect(res1.status).toBe(201);

    const cookie2 = crypto.randomUUID();
    const res2 = await POST(
      makeMoveRequest(
        { from: "e7", to: "e5", version: 1, moveId: crypto.randomUUID() },
        { visitorId: cookie2, ip: "2001:db8:abcd:1:ffff::99" },
      ),
    );
    expect(res2.status).toBe(429);
    const body2 = await res2.json();
    expect(body2.lockedBy).toBe("network");
    expect(body2.error).toBe("Someone on your network already moved today.");
  });

  it("7. allows moving and renews the lock when an expired lock document is still present", async () => {
    const visitorId = crypto.randomUUID();
    const ip = "203.0.113.70";
    const past = new Date(Date.now() - 60_000);

    await currentDb.collection<{ _id: string; lockedUntil: Date; gameNumber: number; ply: number }>(LOCKS_COLLECTION).insertMany([
      { _id: `v:${hashVisitorId(visitorId)}`, lockedUntil: past, gameNumber: 1, ply: 0 },
      { _id: `ip:${hashChessIp(ip)}`, lockedUntil: past, gameNumber: 1, ply: 0 },
    ]);

    const res = await POST(
      makeMoveRequest(
        { from: "c2", to: "c4", version: 0, moveId: crypto.randomUUID() },
        { visitorId, ip },
      ),
    );
    expect(res.status).toBe(201);

    const locks = await currentDb.collection(LOCKS_COLLECTION).find().toArray();
    expect(locks).toHaveLength(2);
    for (const lock of locks) {
      expect(lock.lockedUntil.getTime()).toBeGreaterThan(Date.now());
    }
  });

  it("8. marks checkmate (0-1) on fool's mate and creates exactly one Game 2 across 5 parallel GETs", async () => {
    const p1 = await POST(
      makeMoveRequest(
        { from: "f2", to: "f3", version: 0, moveId: crypto.randomUUID() },
        { visitorId: crypto.randomUUID(), ip: "203.0.113.81" },
      ),
    );
    expect(p1.status).toBe(201);

    const p2 = await POST(
      makeMoveRequest(
        { from: "e7", to: "e5", version: 1, moveId: crypto.randomUUID() },
        { visitorId: crypto.randomUUID(), ip: "203.0.113.82" },
      ),
    );
    expect(p2.status).toBe(201);

    const p3 = await POST(
      makeMoveRequest(
        { from: "g2", to: "g4", version: 2, moveId: crypto.randomUUID() },
        { visitorId: crypto.randomUUID(), ip: "203.0.113.83" },
      ),
    );
    expect(p3.status).toBe(201);

    const mate = await POST(
      makeMoveRequest(
        { from: "d8", to: "h4", version: 3, moveId: crypto.randomUUID() },
        { visitorId: crypto.randomUUID(), ip: "203.0.113.84" },
      ),
    );
    expect(mate.status).toBe(201);
    const mateBody = await mate.json();
    expect(mateBody.game.status).toBe("checkmate");
    expect(mateBody.game.result).toBe("0-1");

    const getResponses = await Promise.all(
      Array.from({ length: 5 }, (_, i) => GET(makeGetRequest({ ip: `203.0.113.${90 + i}` }))),
    );
    for (const r of getResponses) {
      expect(r.status).toBe(200);
      const b = await r.json();
      expect(b.game.number).toBe(2);
      expect(b.game.status).toBe("active");
      expect(b.game.version).toBe(0);
    }

    expect(await currentDb.collection(GAMES_COLLECTION).countDocuments()).toBe(2);
  });

  it("9. detects threefold repetition by replaying moves and sets status='draw'", async () => {
    const seq: Array<[string, string]> = [
      ["g1", "f3"],
      ["g8", "f6"],
      ["f3", "g1"],
      ["f6", "g8"],
      ["g1", "f3"],
      ["g8", "f6"],
      ["f3", "g1"],
      ["f6", "g8"],
    ];

    let lastRes: Response | null = null;
    for (let i = 0; i < seq.length; i++) {
      const [from, to] = seq[i]!;
      lastRes = await POST(
        makeMoveRequest(
          { from, to, version: i, moveId: crypto.randomUUID() },
          { visitorId: crypto.randomUUID(), ip: `192.0.2.${i + 1}` },
        ),
      );
      expect(lastRes.status).toBe(201);
    }

    const body = await lastRes!.json();
    expect(body.game.status).toBe("draw");
    expect(body.game.result).toBe("1/2-1/2");
  });

  it("10. never leaks visitorHash, ipHash, or raw IP in any response body", async () => {
    const rawIp = "198.51.100.244";
    const visitorId = crypto.randomUUID();
    const vHash = hashVisitorId(visitorId);
    const iHash = hashChessIp(rawIp);

    const postRes = await POST(
      makeMoveRequest(
        { from: "e2", to: "e4", version: 0, moveId: crypto.randomUUID() },
        { visitorId, ip: rawIp, city: "Quezon%20City", country: "PH" },
      ),
    );
    expect(postRes.status).toBe(201);
    const postText = await postRes.text();

    const getRes = await GET(makeGetRequest({ visitorId, ip: rawIp }));
    expect(getRes.status).toBe(200);
    const getText = await getRes.text();

    for (const text of [postText, getText]) {
      expect(text).not.toContain(rawIp);
      expect(text).not.toContain(vHash);
      expect(text).not.toContain(iHash);
      expect(text).not.toContain("visitorHash");
      expect(text).not.toContain("ipHash");
    }

    const parsed = JSON.parse(getText);
    expect(parsed.game.moves[0].city).toBe("Quezon City");
    expect(parsed.game.moves[0].country).toBe("PH");
    expect(parsed.game.moves[0].isYou).toBe(true);
  });

  it("rejects a move aimed at a different game number with 409, even when the version matches", async () => {
    const res = await POST(
      makeMoveRequest(
        { from: "e2", to: "e4", version: 0, gameNumber: 7, moveId: crypto.randomUUID() },
        { visitorId: crypto.randomUUID(), ip: "203.0.113.77" },
      ),
    );
    expect(res.status).toBe(409);
    const game = await currentDb.collection(GAMES_COLLECTION).findOne({ status: "active" });
    expect(game?.moves).toHaveLength(0);
    expect(await currentDb.collection(LOCKS_COLLECTION).countDocuments()).toBe(0);
  });

  it("rejects illegal moves (400), stale version (409), cross-origin (403), wrong content-type (415), and handles 304 + 503 + auto-promotion", async () => {
    // 403 cross-origin & missing origin
    const crossOrigin = await POST(
      makeMoveRequest(
        { from: "e2", to: "e4", version: 0, moveId: crypto.randomUUID() },
        { origin: "https://evil.example" },
      ),
    );
    expect(crossOrigin.status).toBe(403);

    const noOrigin = await POST(
      makeMoveRequest(
        { from: "e2", to: "e4", version: 0, moveId: crypto.randomUUID() },
        { origin: null },
      ),
    );
    expect(noOrigin.status).toBe(403);

    // 415 wrong content-type
    const wrongCt = await POST(
      makeMoveRequest("{}", { contentType: "text/plain" }),
    );
    expect(wrongCt.status).toBe(415);

    // GET sets cookie + ETag, matching If-None-Match returns 304
    const get1 = await GET(makeGetRequest({ ip: "203.0.113.100" }));
    expect(get1.status).toBe(200);
    const cookie = extractVisitorIdFromSetCookie(get1);
    const etag = get1.headers.get("etag")!;
    expect(etag).toBe('"g1-v0"');

    const get304 = await GET(
      makeGetRequest({ visitorId: cookie, ip: "203.0.113.100", ifNoneMatch: etag }),
    );
    expect(get304.status).toBe(304);

    // 400 illegal move
    const illegal = await POST(
      makeMoveRequest(
        { from: "e2", to: "e5", version: 0, moveId: crypto.randomUUID() },
        { visitorId: cookie, ip: "203.0.113.100" },
      ),
    );
    expect(illegal.status).toBe(400);

    // Valid move advances version to 1
    const okMove = await POST(
      makeMoveRequest(
        { from: "e2", to: "e4", version: 0, moveId: crypto.randomUUID() },
        { visitorId: cookie, ip: "203.0.113.100" },
      ),
    );
    expect(okMove.status).toBe(201);

    // 409 stale version
    const stale = await POST(
      makeMoveRequest(
        { from: "d2", to: "d4", version: 0, moveId: crypto.randomUUID() },
        { visitorId: crypto.randomUUID(), ip: "203.0.113.101" },
      ),
    );
    expect(stale.status).toBe(409);
    const staleBody = await stale.json();
    expect(staleBody.game.version).toBe(1);

    // 503 when MongoDB is not configured
    mongoConfigured = false;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const get503 = await GET(makeGetRequest());
    expect(get503.status).toBe(503);
    const post503 = await POST(
      makeMoveRequest({ from: "e7", to: "e5", version: 1, moveId: crypto.randomUUID() }),
    );
    expect(post503.status).toBe(503);
    expect(errorSpy).toHaveBeenCalled();

    // Auto-promotion to queen when promotion is omitted
    mongoConfigured = true;
    const promoChess = new Chess("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
    await currentDb.collection(GAMES_COLLECTION).updateOne(
      { status: "active" },
      {
        $set: {
          startFen: promoChess.fen(),
          fen: promoChess.fen(),
          moves: [],
          version: 0,
        },
      },
    );
    const promoRes = await POST(
      makeMoveRequest(
        { from: "a7", to: "a8", version: 0, moveId: crypto.randomUUID() },
        { visitorId: crypto.randomUUID(), ip: "203.0.113.102" },
      ),
    );
    expect(promoRes.status).toBe(201);
    const promoBody = await promoRes.json();
    expect(promoBody.game.moves[0].san).toBe("a8=Q+");
  });

  it("enforces the 10 POSTs per 15 min IP rate limit", async () => {
    await GET(makeGetRequest({ ip: "203.0.113.200" }));
    const ip = "203.0.113.200";
    for (let i = 0; i < 10; i++) {
      const r = await POST(
        makeMoveRequest(
          { from: "e2", to: "e5", version: 0, moveId: crypto.randomUUID() },
          { visitorId: crypto.randomUUID(), ip },
        ),
      );
      expect(r.status).toBe(400);
    }

    const eleventh = await POST(
      makeMoveRequest(
        { from: "e2", to: "e4", version: 0, moveId: crypto.randomUUID() },
        { visitorId: crypto.randomUUID(), ip },
      ),
    );
    expect(eleventh.status).toBe(429);
  });
});
