import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let currentDb: Db;
let currentIp = "198.51.100.1";
const cookieJar = new Map<string, { value: string; options?: Record<string, unknown> }>();
const deletedCookies: Array<{ name: string; path?: string }> = [];

vi.mock("@/lib/mongodb", () => ({
  isMongoConfigured: () => true,
  getDb: async () => currentDb,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const entry = cookieJar.get(name);
      return entry ? { name, value: entry.value } : undefined;
    },
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      cookieJar.set(name, { value, options });
    },
    delete: (arg: string | { name: string; path?: string }) => {
      if (typeof arg === "string") {
        cookieJar.delete(arg);
        deletedCookies.push({ name: arg });
      } else {
        cookieJar.delete(arg.name);
        deletedCookies.push(arg);
      }
    },
  }),
  headers: async () => new Headers({ "user-agent": "VitestBrowser/1.0", "x-forwarded-for": currentIp }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    const err = new Error(`NEXT_REDIRECT:${url}`);
    (err as Error & { digest?: string }).digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw err;
  },
}));

vi.mock("./email", () => ({
  sendLoginCodeEmail: vi.fn(async () => undefined),
  sendNewDeviceEmail: vi.fn(async () => undefined),
}));

const { hashPassword, hashBackupCode } = await import("./crypto");
const {
  ADMINS_COLLECTION,
  CHALLENGE_COOKIE_NAME,
  DEVICE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  createLoginChallenge,
  createTrustedDevice,
  ensureAdminIndexes,
} = await import("./auth");
const { loginStepOneAction, verifyLoginCodeAction, signOutAction } = await import("./auth-actions");
const { sendLoginCodeEmail } = await import("./email");
const { consumeRateLimit, peekRateLimit } = await import("./rate-limit");
const { NO_TRACK_COOKIE_NAME } = await import("@/lib/visitor");

describe("admin auth-actions blog_notrack cookie", () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;

  beforeAll(async () => {
    process.env.ADMIN_SECRET = "test-admin-secret-for-vitest";
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
    currentDb = client.db("admin_auth_actions_test");
    await ensureAdminIndexes(currentDb);
  });

  afterAll(async () => {
    await client?.close();
    await mongod?.stop();
  });

  beforeEach(async () => {
    currentIp = "198.51.100.1";
    cookieJar.clear();
    deletedCookies.length = 0;
    vi.mocked(sendLoginCodeEmail).mockClear();
    await Promise.all([
      currentDb.collection(ADMINS_COLLECTION).deleteMany({}),
      currentDb.collection("admin_sessions").deleteMany({}),
      currentDb.collection("admin_trusted_devices").deleteMany({}),
      currentDb.collection("admin_login_challenges").deleteMany({}),
      currentDb.collection("rate_limits").deleteMany({}),
    ]);
  });

  async function seedAdmin() {
    const passwordHash = await hashPassword("correct-horse-battery-staple");
    const doc = {
      _id: new ObjectId(),
      email: "owner@example.com",
      name: "Owner",
      role: "owner" as const,
      passwordHash,
      backupCodeHashes: [hashBackupCode("ABCD-1234")],
      createdAt: new Date(),
      passwordChangedAt: null,
      lastSignInAt: null,
      disabledAt: null,
    };
    await currentDb.collection(ADMINS_COLLECTION).insertOne(doc);
    return doc;
  }

  it("sets blog_notrack on trusted-device sign-in and keeps it on sign-out", async () => {
    const admin = await seedAdmin();
    const device = await createTrustedDevice(currentDb, admin._id, "VitestBrowser/1.0");
    cookieJar.set(DEVICE_COOKIE_NAME, { value: device.token });

    const form = new FormData();
    form.set("email", "owner@example.com");
    form.set("password", "correct-horse-battery-staple");

    await expect(loginStepOneAction({ step: "credentials", error: null }, form)).rejects.toThrow(
      "NEXT_REDIRECT:/admin",
    );

    expect(cookieJar.get(SESSION_COOKIE_NAME)?.value).toBeTruthy();
    const noTrack = cookieJar.get(NO_TRACK_COOKIE_NAME);
    expect(noTrack?.value).toBe("1");
    expect(noTrack?.options).toMatchObject({
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });

    await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT:/admin/login");
    expect(deletedCookies.some((c) => c.name === NO_TRACK_COOKIE_NAME)).toBe(false);
    expect(cookieJar.get(NO_TRACK_COOKIE_NAME)?.value).toBe("1");
  });

  it("sets blog_notrack on 2FA code verification sign-in", async () => {
    const admin = await seedAdmin();
    await createLoginChallenge(currentDb, admin._id);
    const challenge = await currentDb.collection("admin_login_challenges").findOne({ adminId: admin._id });
    expect(challenge).toBeTruthy();
    cookieJar.set(CHALLENGE_COOKIE_NAME, { value: String(challenge!._id) });

    const form = new FormData();
    form.set("code", "ABCD-1234");

    await expect(
      verifyLoginCodeAction(
        {
          step: "code",
          maskedEmail: "o***@example.com",
          resendAvailableAt: new Date().toISOString(),
          error: null,
        },
        form,
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/admin");

    expect(cookieJar.get(SESSION_COOKIE_NAME)?.value).toBeTruthy();
    const noTrack = cookieJar.get(NO_TRACK_COOKIE_NAME);
    expect(noTrack?.value).toBe("1");
    expect(noTrack?.options).toMatchObject({
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
  });
});

describe("admin login email rate limit (failures only)", () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;

  beforeAll(async () => {
    process.env.ADMIN_SECRET = "test-admin-secret-for-vitest";
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
    currentDb = client.db("admin_auth_rate_limit_test");
    await ensureAdminIndexes(currentDb);
  });

  afterAll(async () => {
    await client?.close();
    await mongod?.stop();
  });

  beforeEach(async () => {
    currentIp = "198.51.100.1";
    cookieJar.clear();
    deletedCookies.length = 0;
    vi.mocked(sendLoginCodeEmail).mockClear();
    await Promise.all([
      currentDb.collection(ADMINS_COLLECTION).deleteMany({}),
      currentDb.collection("admin_sessions").deleteMany({}),
      currentDb.collection("admin_trusted_devices").deleteMany({}),
      currentDb.collection("admin_login_challenges").deleteMany({}),
      currentDb.collection("rate_limits").deleteMany({}),
    ]);
  });

  async function seedAdmin() {
    const passwordHash = await hashPassword("correct-horse-battery-staple");
    const doc = {
      _id: new ObjectId(),
      email: "owner@example.com",
      name: "Owner",
      role: "owner" as const,
      passwordHash,
      backupCodeHashes: [hashBackupCode("ABCD-1234")],
      createdAt: new Date(),
      passwordChangedAt: null,
      lastSignInAt: null,
      disabledAt: null,
    };
    await currentDb.collection(ADMINS_COLLECTION).insertOne(doc);
    return doc;
  }

  function makeCredsForm(password: string) {
    const form = new FormData();
    form.set("email", "owner@example.com");
    form.set("password", password);
    return form;
  }

  it("peekRateLimit does not create or increment documents", async () => {
    const windowMs = 60_000;
    const nowMs = 1_700_000_000_000;
    expect(await peekRateLimit(currentDb, "test-key", windowMs, 2, nowMs)).toBe(true);
    expect(await currentDb.collection("rate_limits").countDocuments({})).toBe(0);

    await consumeRateLimit(currentDb, "test-key", windowMs, 2, nowMs);
    expect(await peekRateLimit(currentDb, "test-key", windowMs, 2, nowMs)).toBe(true);

    await consumeRateLimit(currentDb, "test-key", windowMs, 2, nowMs);
    expect(await peekRateLimit(currentDb, "test-key", windowMs, 2, nowMs)).toBe(false);

    const doc = await currentDb.collection("rate_limits").findOne({});
    expect(doc?.count).toBe(2);
  });

  it("refuses 6th attempt with correct password and no trusted device after 5 failures", async () => {
    await seedAdmin();

    for (let i = 0; i < 5; i++) {
      currentIp = `198.51.100.${i + 10}`;
      const res = await loginStepOneAction({ step: "credentials", error: null }, makeCredsForm("wrong-password"));
      expect(res).toEqual({ step: "credentials", error: "Invalid email or password." });
    }

    currentIp = "198.51.100.99";
    const blocked = await loginStepOneAction(
      { step: "credentials", error: null },
      makeCredsForm("correct-horse-battery-staple"),
    );
    expect(blocked).toEqual({
      step: "credentials",
      error: "Too many sign-in attempts. Wait 15 minutes and try again.",
    });
    expect(await currentDb.collection("admin_login_challenges").countDocuments({})).toBe(0);
    expect(sendLoginCodeEmail).not.toHaveBeenCalled();
  });

  it("allows sign-in with a valid trusted-device cookie even when email bucket is full", async () => {
    const admin = await seedAdmin();

    for (let i = 0; i < 5; i++) {
      currentIp = `198.51.100.${i + 20}`;
      await loginStepOneAction({ step: "credentials", error: null }, makeCredsForm("wrong-password"));
    }

    const device = await createTrustedDevice(currentDb, admin._id, "VitestBrowser/1.0");
    cookieJar.set(DEVICE_COOKIE_NAME, { value: device.token });
    currentIp = "198.51.100.99";

    await expect(
      loginStepOneAction({ step: "credentials", error: null }, makeCredsForm("correct-horse-battery-staple")),
    ).rejects.toThrow("NEXT_REDIRECT:/admin");
    expect(cookieJar.get(SESSION_COOKIE_NAME)?.value).toBeTruthy();
  });

  it("does not increment email bucket on correct-password sign-ins", async () => {
    await seedAdmin();

    for (let i = 0; i < 6; i++) {
      currentIp = `198.51.100.${i + 30}`;
      const res = await loginStepOneAction(
        { step: "credentials", error: null },
        makeCredsForm("correct-horse-battery-staple"),
      );
      expect(res.step).toBe("code");
    }
  });
});
