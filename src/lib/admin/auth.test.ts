import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminLoginChallengeDoc } from "./auth";

vi.mock("server-only", () => ({}));

const {
  generateBackupCodes,
  hashBackupCode,
  hashPassword,
  hmacHash,
  safeEqualHex,
  verifyPassword,
} = await import("./crypto");

const { can, hasMinRole } = await import("./permissions");

const {
  ADMINS_COLLECTION,
  ADMIN_CHALLENGES_COLLECTION,
  createLoginChallenge,
  createSession,
  createTrustedDevice,
  ensureAdminIndexes,
  generateAndStoreBackupCodes,
  getSessionAndAdmin,
  hasValidTrustedDevice,
  resendLoginChallenge,
  verifyAdminCredentials,
  verifyLoginChallengeCode,
} = await import("./auth");

describe("admin auth core", () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;

  beforeAll(async () => {
    process.env.ADMIN_SECRET = "test-admin-secret-for-vitest";
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
    db = client.db("admin_auth_test");
    await ensureAdminIndexes(db);
  });

  afterAll(async () => {
    await client?.close();
    await mongod?.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      db.collection(ADMINS_COLLECTION).deleteMany({}),
      db.collection(ADMIN_CHALLENGES_COLLECTION).deleteMany({}),
      db.collection("admin_sessions").deleteMany({}),
      db.collection("admin_trusted_devices").deleteMany({}),
    ]);
  });

  async function insertTestAdmin(overrides: Partial<{
    email: string;
    role: "owner" | "admin" | "viewer";
    disabledAt: Date | null;
    password: string;
  }> = {}) {
    const passwordHash = await hashPassword(overrides.password ?? "correct-horse-battery-staple");
    const doc = {
      _id: new ObjectId(),
      email: (overrides.email ?? "owner@example.com").toLowerCase(),
      name: "Test Owner",
      role: overrides.role ?? ("owner" as const),
      passwordHash,
      backupCodeHashes: [] as string[],
      createdAt: new Date(),
      passwordChangedAt: null,
      lastSignInAt: null,
      disabledAt: overrides.disabledAt ?? null,
    };
    await db.collection(ADMINS_COLLECTION).insertOne(doc);
    return doc;
  }

  it("hashes and verifies passwords with scrypt", async () => {
    const hash = await hashPassword("my-super-secret-passphrase");
    expect(hash.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(await verifyPassword("my-super-secret-passphrase", hash)).toBe(true);
    expect(await verifyPassword("wrong-passphrase", hash)).toBe(false);
    expect(await verifyPassword("anything", "invalid-format")).toBe(false);
  });

  it("performs constant-time hex comparisons safely", () => {
    const a = hmacHash("test", "value-1");
    const b = hmacHash("test", "value-1");
    const c = hmacHash("test", "value-2");
    expect(safeEqualHex(a, b)).toBe(true);
    expect(safeEqualHex(a, c)).toBe(false);
    expect(safeEqualHex(a, "abcd")).toBe(false);
    expect(safeEqualHex("", "")).toBe(false);
  });

  it("enforces role permissions matrix", () => {
    expect(can("owner", "admins:manage")).toBe(true);
    expect(can("admin", "admins:manage")).toBe(false);
    expect(can("admin", "messages:mutate")).toBe(true);
    expect(can("admin", "chess:mutate")).toBe(true);
    expect(can("admin", "audit:view")).toBe(true);
    expect(can("viewer", "overview:view")).toBe(true);
    expect(can("viewer", "messages:mutate")).toBe(false);
    expect(can("viewer", "chess:mutate")).toBe(false);
    expect(can("viewer", "audit:view")).toBe(false);
    expect(hasMinRole("owner", "admin")).toBe(true);
    expect(hasMinRole("viewer", "admin")).toBe(false);
  });

  it("verifies credentials and rejects disabled admins", async () => {
    await insertTestAdmin({ email: "active@example.com", password: "password-123456" });
    await insertTestAdmin({
      email: "disabled@example.com",
      password: "password-123456",
      disabledAt: new Date(),
    });

    const ok = await verifyAdminCredentials(db, "ACTIVE@example.com", "password-123456");
    expect(ok?.email).toBe("active@example.com");

    expect(await verifyAdminCredentials(db, "active@example.com", "wrong-password")).toBeNull();
    expect(await verifyAdminCredentials(db, "unknown@example.com", "password-123456")).toBeNull();
    expect(await verifyAdminCredentials(db, "disabled@example.com", "password-123456")).toBeNull();
  });

  it("enforces code expiry, attempt limits, and single-use codes", async () => {
    const admin = await insertTestAdmin();
    const now = new Date("2026-11-26T12:00:00Z");
    const challenge = await createLoginChallenge(db, admin._id, now);

    // Code cannot be used after expiry
    const expired = await verifyLoginChallengeCode(
      db,
      challenge.challengeId,
      challenge.code,
      new Date(now.getTime() + 11 * 60 * 1000),
    );
    expect(expired).toEqual({ ok: false, reason: "expired" });

    // Fresh challenge: 5 wrong attempts lock it out
    const c2 = await createLoginChallenge(db, admin._id, now);
    for (let i = 0; i < 5; i++) {
      const bad = await verifyLoginChallengeCode(db, c2.challengeId, "000000", now);
      expect(bad).toEqual({ ok: false, reason: "invalid_code" });
    }
    const locked = await verifyLoginChallengeCode(db, c2.challengeId, c2.code, now);
    expect(locked).toEqual({ ok: false, reason: "too_many_attempts" });

    // Fresh challenge: valid code works once, then cannot be reused
    const c3 = await createLoginChallenge(db, admin._id, now);
    const first = await verifyLoginChallengeCode(db, c3.challengeId, c3.code, now);
    expect(first.ok).toBe(true);
    const replay = await verifyLoginChallengeCode(db, c3.challengeId, c3.code, now);
    expect(replay).toEqual({ ok: false, reason: "not_found" });
  });

  it("invalidates old code on resend and respects 60s cooldown", async () => {
    const admin = await insertTestAdmin();
    const now = new Date("2026-11-26T12:00:00Z");
    const c = await createLoginChallenge(db, admin._id, now);

    const tooSoon = await resendLoginChallenge(db, c.challengeId, new Date(now.getTime() + 10_000));
    expect(tooSoon.ok).toBe(false);

    const resent = await resendLoginChallenge(db, c.challengeId, new Date(now.getTime() + 61_000));
    expect(resent.ok).toBe(true);
    if (!resent.ok) return;

    const oldCheck = await verifyLoginChallengeCode(db, c.challengeId, c.code, new Date(now.getTime() + 62_000));
    expect(oldCheck).toEqual({ ok: false, reason: "invalid_code" });

    const newCheck = await verifyLoginChallengeCode(db, c.challengeId, resent.code, new Date(now.getTime() + 63_000));
    expect(newCheck.ok).toBe(true);
  });

  it("allows each backup code to be used only once", async () => {
    const admin = await insertTestAdmin();
    const codes = await generateAndStoreBackupCodes(db, admin._id);
    expect(codes).toHaveLength(10);
    expect(generateBackupCodes(10)).toHaveLength(10);
    expect(hashBackupCode(codes[0]!)).toBe(hashBackupCode(codes[0]!.toLowerCase().replace("-", "")));

    const now = new Date();
    const c1 = await createLoginChallenge(db, admin._id, now);
    const res1 = await verifyLoginChallengeCode(db, c1.challengeId, codes[0]!.toLowerCase().replace("-", ""), now);
    expect(res1.ok).toBe(true);
    if (res1.ok) expect(res1.usedBackupCode).toBe(true);

    const c2 = await createLoginChallenge(db, admin._id, now);
    const res2 = await verifyLoginChallengeCode(db, c2.challengeId, codes[0]!, now);
    expect(res2).toEqual({ ok: false, reason: "invalid_code" });
  });

  it("validates trusted devices and skips expired or wrong-admin tokens", async () => {
    const admin1 = await insertTestAdmin({ email: "a1@example.com" });
    const admin2 = await insertTestAdmin({ email: "a2@example.com" });
    const now = new Date("2026-11-26T12:00:00Z");

    const device = await createTrustedDevice(db, admin1._id, "Mozilla/5.0", now);
    expect(await hasValidTrustedDevice(db, admin1._id, device.token, now)).toBe(true);
    expect(await hasValidTrustedDevice(db, admin2._id, device.token, now)).toBe(false);
    expect(
      await hasValidTrustedDevice(db, admin1._id, device.token, new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000)),
    ).toBe(false);
  });

  it("rejects sessions for disabled admins and deletes the session", async () => {
    const admin = await insertTestAdmin();
    const now = new Date("2026-11-26T12:00:00Z");
    const session = await createSession(
      db,
      admin._id,
      { userAgent: "UA", city: "Makati", country: "PH", ipHash: "abc" },
      now,
    );

    const loaded = await getSessionAndAdmin(db, session.token, now);
    expect(loaded?.admin._id.equals(admin._id)).toBe(true);

    await db.collection(ADMINS_COLLECTION).updateOne(
      { _id: admin._id },
      { $set: { disabledAt: new Date() } },
    );

    const rejected = await getSessionAndAdmin(db, session.token, now);
    expect(rejected).toBeNull();
    expect(await db.collection("admin_sessions").countDocuments({})).toBe(0);
  });

  it("caps parallel wrong code attempts atomically at 5", async () => {
    const admin = await insertTestAdmin();
    const now = new Date("2026-11-26T12:00:00Z");
    const c = await createLoginChallenge(db, admin._id, now);

    const results = await Promise.all(
      Array.from({ length: 20 }, () => verifyLoginChallengeCode(db, c.challengeId, "000000", now)),
    );

    const invalidCount = results.filter((r) => !r.ok && r.reason === "invalid_code").length;
    const lockedCount = results.filter((r) => !r.ok && r.reason === "too_many_attempts").length;
    expect(invalidCount).toBe(5);
    expect(lockedCount).toBe(15);

    const stored = await db
      .collection<AdminLoginChallengeDoc>(ADMIN_CHALLENGES_COLLECTION)
      .findOne({ _id: c.challengeId });
    expect(stored?.attempts).toBe(5);
  });

  it("does not reset attempt count on resend", async () => {
    const admin = await insertTestAdmin();
    const now = new Date("2026-11-26T12:00:00Z");
    const c = await createLoginChallenge(db, admin._id, now);

    for (let i = 0; i < 4; i++) {
      const bad = await verifyLoginChallengeCode(db, c.challengeId, "000000", now);
      expect(bad).toEqual({ ok: false, reason: "invalid_code" });
    }

    const resent = await resendLoginChallenge(db, c.challengeId, new Date(now.getTime() + 61_000));
    expect(resent.ok).toBe(true);
    if (!resent.ok) return;

    const fifth = await verifyLoginChallengeCode(
      db,
      c.challengeId,
      resent.code,
      new Date(now.getTime() + 62_000),
    );
    expect(fifth.ok).toBe(true);

    const sixth = await verifyLoginChallengeCode(
      db,
      c.challengeId,
      resent.code,
      new Date(now.getTime() + 63_000),
    );
    expect(sixth.ok).toBe(false);
  });

  it("enforces max 3 resends and caps expiresAt at createdAt + 30 min", async () => {
    const admin = await insertTestAdmin();
    const createdAt = new Date("2026-11-26T12:00:00Z");
    const c = await createLoginChallenge(db, admin._id, createdAt);

    // Resend 1 at +9m, Resend 2 at +18m, Resend 3 at +27m -> expiresAt capped at +30m
    const r1 = await resendLoginChallenge(db, c.challengeId, new Date(createdAt.getTime() + 9 * 60_000));
    expect(r1.ok).toBe(true);
    const r2 = await resendLoginChallenge(db, c.challengeId, new Date(createdAt.getTime() + 18 * 60_000));
    expect(r2.ok).toBe(true);
    const r3 = await resendLoginChallenge(db, c.challengeId, new Date(createdAt.getTime() + 27 * 60_000));
    expect(r3.ok).toBe(true);

    const stored = await db
      .collection<AdminLoginChallengeDoc>(ADMIN_CHALLENGES_COLLECTION)
      .findOne({ _id: c.challengeId });
    expect(stored?.expiresAt.getTime()).toBeLessThanOrEqual(createdAt.getTime() + 30 * 60_000);
    expect(stored?.expiresAt.getTime()).toBe(createdAt.getTime() + 30 * 60_000);

    const r4 = await resendLoginChallenge(db, c.challengeId, new Date(createdAt.getTime() + 28 * 60_000 + 61_000));
    expect(r4).toEqual({ ok: false, reason: "resend_limit" });
  });

  it("allows parallel submissions of the correct code to succeed only once", async () => {
    const admin = await insertTestAdmin();
    const now = new Date("2026-11-26T12:00:00Z");
    const c = await createLoginChallenge(db, admin._id, now);

    const [a, b] = await Promise.all([
      verifyLoginChallengeCode(db, c.challengeId, c.code, now),
      verifyLoginChallengeCode(db, c.challengeId, c.code, now),
    ]);

    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
  });

  it("allows parallel submissions of the same backup code to succeed only once", async () => {
    const admin = await insertTestAdmin();
    const codes = await generateAndStoreBackupCodes(db, admin._id);
    const now = new Date("2026-11-26T12:00:00Z");
    const c1 = await createLoginChallenge(db, admin._id, now);
    const c2 = await createLoginChallenge(db, admin._id, now);

    const [a, b] = await Promise.all([
      verifyLoginChallengeCode(db, c1.challengeId, codes[0]!, now),
      verifyLoginChallengeCode(db, c2.challengeId, codes[0]!, now),
    ]);

    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
  });
});
