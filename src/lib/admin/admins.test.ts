import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminInviteDoc, AdminSessionDoc } from "./auth";

vi.mock("server-only", () => ({}));

const {
  ADMINS_COLLECTION,
  ADMIN_INVITES_COLLECTION,
  ADMIN_SESSIONS_COLLECTION,
  ADMIN_TRUSTED_DEVICES_COLLECTION,
  createSession,
  createTrustedDevice,
  ensureAdminIndexes,
} = await import("./auth");

const { hashPassword, hmacHash } = await import("./crypto");
const {
  changeAdminRole,
  changeOwnPassword,
  createAdminInvite,
  removeAdmin,
  resendAdminInvite,
} = await import("./mutations");

describe("admin management guards", () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;

  beforeAll(async () => {
    process.env.ADMIN_SECRET = "test-admin-secret-for-admins";
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
    db = client.db("admin_guards_test");
    await ensureAdminIndexes(db);
  });

  afterAll(async () => {
    await client?.close();
    await mongod?.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      db.collection(ADMINS_COLLECTION).deleteMany({}),
      db.collection(ADMIN_INVITES_COLLECTION).deleteMany({}),
      db.collection(ADMIN_SESSIONS_COLLECTION).deleteMany({}),
      db.collection(ADMIN_TRUSTED_DEVICES_COLLECTION).deleteMany({}),
      db.collection("admin_audit").deleteMany({}),
    ]);
  });

  async function seedAdmin(email: string, role: "owner" | "admin" | "viewer", password = "password-123456") {
    const doc = {
      _id: new ObjectId(),
      email,
      name: email.split("@")[0]!,
      role,
      passwordHash: await hashPassword(password),
      backupCodeHashes: [],
      createdAt: new Date(),
      passwordChangedAt: null,
      lastSignInAt: null,
      disabledAt: null,
    };
    await db.collection(ADMINS_COLLECTION).insertOne(doc);
    return doc;
  }

  it("prevents non-owners from managing admins", async () => {
    const owner = await seedAdmin("owner@example.com", "owner");
    const admin = await seedAdmin("admin@example.com", "admin");
    const viewer = await seedAdmin("viewer@example.com", "viewer");

    await expect(createAdminInvite(db, admin, { email: "new@example.com", role: "viewer" })).rejects.toThrow("Forbidden");
    await expect(createAdminInvite(db, viewer, { email: "new@example.com", role: "viewer" })).rejects.toThrow("Forbidden");
    await expect(changeAdminRole(db, admin, owner._id.toString(), "viewer")).rejects.toThrow("Forbidden");
    await expect(removeAdmin(db, viewer, owner._id.toString())).rejects.toThrow("Forbidden");
  });

  it("blocks inviting an existing admin and replaces token on resend", async () => {
    const owner = await seedAdmin("owner@example.com", "owner");
    const dup = await createAdminInvite(db, owner, { email: "owner@example.com", role: "admin" });
    expect(dup).toEqual({ ok: false, error: "An admin account with this email already exists." });

    const inv1 = await createAdminInvite(db, owner, { email: "new@example.com", role: "admin" });
    expect(inv1.ok).toBe(true);
    if (!inv1.ok) return;

    const inv2 = await resendAdminInvite(db, owner, "new@example.com");
    expect(inv2.ok).toBe(true);
    if (!inv2.ok) return;

    expect(inv2.token).not.toBe(inv1.token);
    const oldRow = await db.collection<AdminInviteDoc>(ADMIN_INVITES_COLLECTION).findOne({ _id: hmacHash("invite", inv1.token) });
    const newRow = await db.collection<AdminInviteDoc>(ADMIN_INVITES_COLLECTION).findOne({ _id: hmacHash("invite", inv2.token) });
    expect(oldRow).toBeNull();
    expect(newRow).not.toBeNull();
  });

  it("protects the last Owner from demotion and removal, and cleans up removed admin sessions/devices", async () => {
    const owner1 = await seedAdmin("owner1@example.com", "owner");
    const admin1 = await seedAdmin("admin1@example.com", "admin");

    expect(await changeAdminRole(db, owner1, owner1._id.toString(), "admin")).toEqual({
      ok: false,
      error: "Cannot demote the last Owner.",
    });
    expect(await removeAdmin(db, owner1, owner1._id.toString())).toEqual({
      ok: false,
      error: "Cannot remove the last Owner.",
    });

    // Removing admin1 deletes their sessions and trusted devices
    await createSession(db, admin1._id, { userAgent: "UA", city: null, country: null, ipHash: "h" });
    await createTrustedDevice(db, admin1._id, "UA");
    expect(await removeAdmin(db, owner1, admin1._id.toString())).toEqual({ ok: true });
    expect(await db.collection(ADMIN_SESSIONS_COLLECTION).countDocuments({ adminId: admin1._id })).toBe(0);
    expect(await db.collection(ADMIN_TRUSTED_DEVICES_COLLECTION).countDocuments({ adminId: admin1._id })).toBe(0);
  });

  it("signs out other sessions when changing own password", async () => {
    const admin = await seedAdmin("sec@example.com", "viewer", "old-password-123");
    const s1 = await createSession(db, admin._id, { userAgent: "Browser 1", city: null, country: null, ipHash: "h1" });
    const s2 = await createSession(db, admin._id, { userAgent: "Browser 2", city: null, country: null, ipHash: "h2" });

    const bad = await changeOwnPassword(db, admin, s1.tokenHash, {
      currentPassword: "wrong-password",
      newPassword: "new-password-1234",
    });
    expect(bad).toEqual({ ok: false, error: "Current password is incorrect." });

    const ok = await changeOwnPassword(db, admin, s1.tokenHash, {
      currentPassword: "old-password-123",
      newPassword: "new-password-1234",
    });
    expect(ok).toEqual({ ok: true });

    expect(await db.collection<AdminSessionDoc>(ADMIN_SESSIONS_COLLECTION).findOne({ _id: s1.tokenHash })).not.toBeNull();
    expect(await db.collection<AdminSessionDoc>(ADMIN_SESSIONS_COLLECTION).findOne({ _id: s2.tokenHash })).toBeNull();
  });
});
