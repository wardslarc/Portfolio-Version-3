import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MongoClient, type Db } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

vi.mock("server-only", () => ({}));

let currentDb: Db;
let mongoConfigured = true;

vi.mock("@/lib/mongodb", () => ({
  isMongoConfigured: () => mongoConfigured,
  getDb: async () => currentDb,
}));

const { POST } = await import("./route");

const WINDOW_MS = 10 * 60 * 1000;

let mongod: MongoMemoryServer;
let client: MongoClient;
let dbCounter = 0;
let fetchMock: ReturnType<typeof vi.fn>;

function makeRequest(body: unknown, ip = "203.0.113.10"): Request {
  return new Request("http://localhost/api/contact", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
      "x-forwarded-for": ip,
      "user-agent": "vitest",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validPayload = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  message: "Hello! Interested in working together on a project.",
};

beforeAll(async () => {
  // Never use MONGODB_URI or real Resend keys from .env/.env.local
  delete process.env.MONGODB_URI;
  delete process.env.MONGODB_DB;
  process.env.IP_HASH_SALT = "test-salt";
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.CONTACT_TO_EMAIL = "owner@example.com";
  process.env.CONTACT_FROM_EMAIL = "Portfolio <noreply@example.com>";

  mongod = await MongoMemoryServer.create({
    instance: { ip: "127.0.0.1" },
  });
  client = await MongoClient.connect(mongod.getUri());
}, 60_000);

afterAll(async () => {
  await client?.close();
  await mongod?.stop();
});

beforeEach(() => {
  mongoConfigured = true;
  currentDb = client.db(`contact_test_${++dbCounter}`);
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "email_1" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/contact", () => {
  it("rejects posts from another site with 403", async () => {
    const req = makeRequest(validPayload);
    req.headers.set("origin", "https://evil.example");
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(await currentDb.collection("messages").countDocuments()).toBe(0);
  });

  it("rejects posts with no Origin header with 403", async () => {
    const req = makeRequest(validPayload);
    req.headers.delete("origin");
    expect((await POST(req)).status).toBe(403);
  });

  it("rejects a text/plain body (a cross-site form) with 415", async () => {
    const req = makeRequest(validPayload);
    req.headers.set("content-type", "text/plain");
    const res = await POST(req);
    expect(res.status).toBe(415);
    expect(await currentDb.collection("messages").countDocuments()).toBe(0);
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await POST(makeRequest("{not-json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Send the form as JSON." });
  });

  it("returns 422 with fieldErrors for invalid input", async () => {
    const res = await POST(makeRequest({ name: "", email: "bad", message: "short" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("Check the highlighted fields.");
    expect(body.fieldErrors).toMatchObject({
      name: expect.any(String),
      email: expect.any(String),
      message: expect.any(String),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("silently succeeds for honeypot submissions without writing or emailing", async () => {
    const res = await POST(makeRequest({ ...validPayload, website: "https://spam.example" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(await currentDb.collection("messages").countDocuments()).toBe(0);
    expect(await currentDb.collection("rate_limits").countDocuments()).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 503 when MongoDB is not configured", async () => {
    mongoConfigured = false;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: "The contact form isn't available right now. Please email me directly.",
    });
    expect(errorSpy).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows the first 3 requests and rejects the 4th with 429", async () => {
    for (let i = 0; i < 3; i++) {
      const res = await POST(makeRequest(validPayload, "198.51.100.1"));
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ ok: true });
    }

    const fourth = await POST(makeRequest(validPayload, "198.51.100.1"));
    expect(fourth.status).toBe(429);
    expect(await fourth.json()).toEqual({
      error: "You've sent a few messages already. Please wait a few minutes, or email me directly.",
    });

    // Different visitor IP still gets its own quota.
    const otherVisitor = await POST(makeRequest(validPayload, "198.51.100.2"));
    expect(otherVisitor.status).toBe(201);

    expect(await currentDb.collection("messages").countDocuments()).toBe(4);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("resets the count in a new fixed window", async () => {
    for (let i = 0; i < 3; i++) {
      const res = await POST(makeRequest(validPayload, "198.51.100.20"));
      expect(res.status).toBe(201);
    }

    const blocked = await POST(makeRequest(validPayload, "198.51.100.20"));
    expect(blocked.status).toBe(429);

    vi.advanceTimersByTime(WINDOW_MS);

    const nextWindow = await POST(makeRequest(validPayload, "198.51.100.20"));
    expect(nextWindow.status).toBe(201);

    const counters = await currentDb.collection("rate_limits").find().toArray();
    expect(counters).toHaveLength(2);
  });

  it("allows exactly 3 out of N parallel requests", async () => {
    const N = 10;
    const responses = await Promise.all(
      Array.from({ length: N }, () => POST(makeRequest(validPayload, "198.51.100.30"))),
    );

    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(3);
    expect(statuses.filter((s) => s === 429)).toHaveLength(N - 3);

    expect(await currentDb.collection("messages").countDocuments()).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const [counter] = await currentDb.collection<{ count: number }>("rate_limits").find().toArray();
    expect(counter?.count).toBe(N);
  });

  it("creates and caches the TTL index on expiresAt and retries on E11000 upsert race", async () => {
    const realLimits = currentDb.collection("rate_limits");
    const createIndexSpy = vi.spyOn(realLimits, "createIndex");
    const realFindOneAndUpdate = realLimits.findOneAndUpdate.bind(realLimits);

    let injectedRace = false;
    vi.spyOn(realLimits, "findOneAndUpdate").mockImplementation(async (...args) => {
      if (!injectedRace) {
        injectedRace = true;
        throw Object.assign(new Error("E11000 duplicate key error"), { code: 11000 });
      }
      return realFindOneAndUpdate(...(args as Parameters<typeof realFindOneAndUpdate>));
    });

    const realCollection = currentDb.collection.bind(currentDb);
    vi.spyOn(currentDb, "collection").mockImplementation(((name: string) => {
      if (name === "rate_limits") return realLimits;
      return realCollection(name);
    }) as typeof currentDb.collection);

    const r1 = await POST(makeRequest(validPayload, "198.51.100.40"));
    const r2 = await POST(makeRequest(validPayload, "198.51.100.40"));
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(injectedRace).toBe(true);
    expect(createIndexSpy).toHaveBeenCalledTimes(1);
    expect(createIndexSpy).toHaveBeenCalledWith({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    const indexes = await realLimits.indexes();
    expect(indexes.some((idx) => idx.key.expiresAt === 1 && idx.expireAfterSeconds === 0)).toBe(true);
  });

  it("drops cached index promise if createIndex fails so the next request retries", async () => {
    const realLimits = currentDb.collection("rate_limits");
    const realCreateIndex = realLimits.createIndex.bind(realLimits);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    let failOnce = true;
    const createIndexSpy = vi.spyOn(realLimits, "createIndex").mockImplementation((...args) => {
      if (failOnce) {
        failOnce = false;
        return Promise.reject(new Error("index build failed"));
      }
      return realCreateIndex(...(args as Parameters<typeof realCreateIndex>));
    });

    const realCollection = currentDb.collection.bind(currentDb);
    vi.spyOn(currentDb, "collection").mockImplementation(((name: string) => {
      if (name === "rate_limits") return realLimits;
      return realCollection(name);
    }) as typeof currentDb.collection);

    const failed = await POST(makeRequest(validPayload, "198.51.100.45"));
    expect(failed.status).toBe(500);
    expect(errorSpy).toHaveBeenCalled();

    const retried = await POST(makeRequest(validPayload, "198.51.100.45"));
    expect(retried.status).toBe(201);
    expect(createIndexSpy).toHaveBeenCalledTimes(2);
  });

  it("still saves the message when Resend email fails", async () => {
    fetchMock.mockResolvedValueOnce(new Response("upstream error", { status: 500 }));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(makeRequest(validPayload, "198.51.100.50"));
    expect(res.status).toBe(201);
    const saved = await currentDb.collection("messages").findOne();
    expect(saved?.emailed).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
  });
});
