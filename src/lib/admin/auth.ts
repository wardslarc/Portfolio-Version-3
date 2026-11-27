import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ObjectId, type Db } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { ADMIN_AUDIT_COLLECTION } from "./audit";
import {
  burnDummyPasswordVerify,
  generateBackupCodes,
  generateRandomToken,
  generateSixDigitCode,
  hashBackupCode,
  hashPassword,
  hmacHash,
  safeEqualHex,
  verifyPassword,
} from "./crypto";
import { can, hasMinRole, type AdminAction, type AdminRole } from "./permissions";

export const ADMINS_COLLECTION = "admins";
export const ADMIN_SESSIONS_COLLECTION = "admin_sessions";
export const ADMIN_TRUSTED_DEVICES_COLLECTION = "admin_trusted_devices";
export const ADMIN_CHALLENGES_COLLECTION = "admin_login_challenges";
export const ADMIN_INVITES_COLLECTION = "admin_invites";

export const SESSION_COOKIE_NAME = "admin_session";
export const DEVICE_COOKIE_NAME = "admin_device";
export const CHALLENGE_COOKIE_NAME = "admin_challenge";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const CHALLENGE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const CHALLENGE_MAX_LIFETIME_MS = 30 * 60 * 1000; // 30 minutes
export const CHALLENGE_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
export const CHALLENGE_MAX_ATTEMPTS = 5;
export const CHALLENGE_MAX_RESENDS = 3;
export const INVITE_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours
const SESSION_SLIDE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export interface AdminDoc {
  _id: ObjectId;
  email: string;
  name: string;
  role: AdminRole;
  passwordHash: string;
  backupCodeHashes: string[];
  createdAt: Date;
  passwordChangedAt: Date | null;
  lastSignInAt: Date | null;
  disabledAt: Date | null;
}

export interface AdminSessionDoc {
  _id: string; // tokenHash
  adminId: ObjectId;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  userAgent: string;
  city: string | null;
  country: string | null;
  ipHash: string;
}

export interface AdminTrustedDeviceDoc {
  _id: string; // tokenHash
  adminId: ObjectId;
  createdAt: Date;
  expiresAt: Date;
  userAgent: string;
}

export interface AdminLoginChallengeDoc {
  _id: string; // challengeId
  adminId: ObjectId;
  codeHash: string;
  attempts: number;
  resendCount: number;
  createdAt: Date;
  expiresAt: Date;
  resendAvailableAt: Date;
}

export interface AdminInviteDoc {
  _id: string; // tokenHash
  email: string;
  role: AdminRole;
  invitedBy: ObjectId | null;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt: Date | null;
}

const globalForAdminIndexes = globalThis as unknown as {
  _adminIndexes?: WeakMap<object, Map<string, Promise<void>>>;
};

export function ensureAdminIndexes(db: Db): Promise<void> {
  if (!globalForAdminIndexes._adminIndexes) {
    globalForAdminIndexes._adminIndexes = new WeakMap();
  }
  let perClient = globalForAdminIndexes._adminIndexes.get(db.client);
  if (!perClient) {
    perClient = new Map();
    globalForAdminIndexes._adminIndexes.set(db.client, perClient);
  }
  const existing = perClient.get(db.databaseName);
  if (existing) return existing;

  const promise = Promise.all([
    db.collection<AdminDoc>(ADMINS_COLLECTION).createIndex({ email: 1 }, { unique: true }),
    db.collection<AdminSessionDoc>(ADMIN_SESSIONS_COLLECTION).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection<AdminSessionDoc>(ADMIN_SESSIONS_COLLECTION).createIndex({ adminId: 1 }),
    db
      .collection<AdminTrustedDeviceDoc>(ADMIN_TRUSTED_DEVICES_COLLECTION)
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection<AdminTrustedDeviceDoc>(ADMIN_TRUSTED_DEVICES_COLLECTION).createIndex({ adminId: 1 }),
    db
      .collection<AdminLoginChallengeDoc>(ADMIN_CHALLENGES_COLLECTION)
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection<AdminInviteDoc>(ADMIN_INVITES_COLLECTION).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection<AdminInviteDoc>(ADMIN_INVITES_COLLECTION).createIndex({ email: 1 }),
    db.collection(ADMIN_AUDIT_COLLECTION).createIndex({ at: -1 }),
  ])
    .then(() => undefined)
    .catch((err) => {
      perClient?.delete(db.databaseName);
      throw err;
    });

  perClient.set(db.databaseName, promise);
  return promise;
}

export function adminCookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/admin",
    maxAge: maxAgeSec,
  };
}

export async function verifyAdminCredentials(
  db: Db,
  email: string,
  password: string,
): Promise<AdminDoc | null> {
  const normalized = email.trim().toLowerCase();
  const admin = await db.collection<AdminDoc>(ADMINS_COLLECTION).findOne({ email: normalized });
  if (!admin) {
    await burnDummyPasswordVerify(password);
    return null;
  }
  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid || admin.disabledAt !== null) {
    return null;
  }
  return admin;
}

export async function hasValidTrustedDevice(
  db: Db,
  adminId: ObjectId,
  rawDeviceToken: string | undefined,
  now = new Date(),
): Promise<boolean> {
  if (!rawDeviceToken) return false;
  const tokenHash = hmacHash("device", rawDeviceToken);
  const doc = await db.collection<AdminTrustedDeviceDoc>(ADMIN_TRUSTED_DEVICES_COLLECTION).findOne({
    _id: tokenHash,
    adminId,
    expiresAt: { $gt: now },
  });
  return doc !== null;
}

export async function createTrustedDevice(
  db: Db,
  adminId: ObjectId,
  userAgent: string,
  now = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateRandomToken(32);
  const tokenHash = hmacHash("device", token);
  const expiresAt = new Date(now.getTime() + DEVICE_TTL_MS);
  await db.collection<AdminTrustedDeviceDoc>(ADMIN_TRUSTED_DEVICES_COLLECTION).insertOne({
    _id: tokenHash,
    adminId,
    createdAt: now,
    expiresAt,
    userAgent: userAgent.slice(0, 300),
  });
  return { token, expiresAt };
}

export async function createLoginChallenge(
  db: Db,
  adminId: ObjectId,
  now = new Date(),
): Promise<{ challengeId: string; code: string; expiresAt: Date; resendAvailableAt: Date }> {
  const challengeId = generateRandomToken(24);
  const code = generateSixDigitCode();
  const codeHash = hmacHash("challenge", code);
  const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS);
  const resendAvailableAt = new Date(now.getTime() + CHALLENGE_RESEND_COOLDOWN_MS);

  await db.collection<AdminLoginChallengeDoc>(ADMIN_CHALLENGES_COLLECTION).insertOne({
    _id: challengeId,
    adminId,
    codeHash,
    attempts: 0,
    resendCount: 0,
    createdAt: now,
    expiresAt,
    resendAvailableAt,
  });

  return { challengeId, code, expiresAt, resendAvailableAt };
}

export async function resendLoginChallenge(
  db: Db,
  challengeId: string,
  now = new Date(),
): Promise<
  | { ok: true; adminId: ObjectId; code: string; resendAvailableAt: Date }
  | { ok: false; reason: "not_found" | "expired" | "cooldown" | "resend_limit"; retryAfterSec?: number }
> {
  const col = db.collection<AdminLoginChallengeDoc>(ADMIN_CHALLENGES_COLLECTION);
  const existing = await col.findOne({ _id: challengeId }, { projection: { createdAt: 1 } });
  if (!existing) return { ok: false, reason: "not_found" };

  const code = generateSixDigitCode();
  const codeHash = hmacHash("challenge", code);
  const maxExpiresAt = existing.createdAt.getTime() + CHALLENGE_MAX_LIFETIME_MS;
  const expiresAt = new Date(Math.min(now.getTime() + CHALLENGE_TTL_MS, maxExpiresAt));
  const resendAvailableAt = new Date(now.getTime() + CHALLENGE_RESEND_COOLDOWN_MS);

  const updated = await col.findOneAndUpdate(
    {
      _id: challengeId,
      expiresAt: { $gt: now },
      resendAvailableAt: { $lte: now },
      resendCount: { $lt: CHALLENGE_MAX_RESENDS },
    },
    { $set: { codeHash, expiresAt, resendAvailableAt }, $inc: { resendCount: 1 } },
    { returnDocument: "after" },
  );

  if (!updated) {
    const current = await col.findOne({ _id: challengeId });
    if (!current) return { ok: false, reason: "not_found" };
    if (current.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
    if (current.resendCount >= CHALLENGE_MAX_RESENDS) return { ok: false, reason: "resend_limit" };
    const remainingMs = current.resendAvailableAt.getTime() - now.getTime();
    return {
      ok: false,
      reason: "cooldown",
      retryAfterSec: Math.max(1, Math.ceil(remainingMs / 1000)),
    };
  }

  return { ok: true, adminId: updated.adminId, code, resendAvailableAt };
}

export async function verifyLoginChallengeCode(
  db: Db,
  challengeId: string,
  inputCode: string,
  now = new Date(),
): Promise<
  | { ok: true; admin: AdminDoc; usedBackupCode: boolean }
  | { ok: false; reason: "not_found" | "expired" | "too_many_attempts" | "invalid_code" | "disabled" }
> {
  const challenges = db.collection<AdminLoginChallengeDoc>(ADMIN_CHALLENGES_COLLECTION);
  const challenge = await challenges.findOneAndUpdate(
    { _id: challengeId, expiresAt: { $gt: now }, attempts: { $lt: CHALLENGE_MAX_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { returnDocument: "after" },
  );
  if (!challenge) {
    const existing = await challenges.findOne({ _id: challengeId });
    if (!existing) return { ok: false, reason: "not_found" };
    if (existing.expiresAt.getTime() <= now.getTime()) {
      await challenges.deleteOne({ _id: challengeId });
      return { ok: false, reason: "expired" };
    }
    return { ok: false, reason: "too_many_attempts" };
  }

  const admins = db.collection<AdminDoc>(ADMINS_COLLECTION);
  const admin = await admins.findOne({ _id: challenge.adminId });
  if (!admin || admin.disabledAt !== null) {
    await challenges.deleteOne({ _id: challengeId });
    return { ok: false, reason: "disabled" };
  }

  const trimmed = inputCode.trim();
  const candidateCodeHash = hmacHash("challenge", trimmed);
  if (safeEqualHex(candidateCodeHash, challenge.codeHash)) {
    const claimed = await challenges.findOneAndDelete({ _id: challengeId, codeHash: challenge.codeHash });
    if (!claimed) return { ok: false, reason: "not_found" };
    return { ok: true, admin, usedBackupCode: false };
  }

  // Check backup codes without short-circuiting so timing doesn't leak array position.
  const candidateBackupHash = hashBackupCode(trimmed);
  let matchedBackupHash: string | null = null;
  for (const storedHash of admin.backupCodeHashes) {
    if (safeEqualHex(candidateBackupHash, storedHash)) {
      matchedBackupHash = storedHash;
    }
  }

  if (matchedBackupHash) {
    const pullRes = await admins.updateOne(
      { _id: admin._id, backupCodeHashes: matchedBackupHash },
      { $pull: { backupCodeHashes: matchedBackupHash } },
    );
    if (pullRes.modifiedCount === 1) {
      const claimed = await challenges.findOneAndDelete({ _id: challengeId });
      if (!claimed) return { ok: false, reason: "not_found" };
      return { ok: true, admin, usedBackupCode: true };
    }
  }

  return { ok: false, reason: "invalid_code" };
}

export async function generateAndStoreBackupCodes(db: Db, adminId: ObjectId): Promise<string[]> {
  const codes = generateBackupCodes(10);
  const hashes = codes.map(hashBackupCode);
  await db.collection<AdminDoc>(ADMINS_COLLECTION).updateOne(
    { _id: adminId },
    { $set: { backupCodeHashes: hashes } },
  );
  return codes;
}

export async function createSession(
  db: Db,
  adminId: ObjectId,
  meta: { userAgent: string; city: string | null; country: string | null; ipHash: string },
  now = new Date(),
): Promise<{ token: string; tokenHash: string; expiresAt: Date }> {
  const token = generateRandomToken(32);
  const tokenHash = hmacHash("session", token);
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  await db.collection<AdminSessionDoc>(ADMIN_SESSIONS_COLLECTION).insertOne({
    _id: tokenHash,
    adminId,
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
    userAgent: meta.userAgent.slice(0, 300),
    city: meta.city,
    country: meta.country,
    ipHash: meta.ipHash,
  });

  await db.collection<AdminDoc>(ADMINS_COLLECTION).updateOne(
    { _id: adminId },
    { $set: { lastSignInAt: now } },
  );

  return { token, tokenHash, expiresAt };
}

export async function getSessionAndAdmin(
  db: Db,
  rawToken: string | undefined,
  now = new Date(),
): Promise<{ session: AdminSessionDoc; admin: AdminDoc } | null> {
  if (!rawToken) return null;
  const tokenHash = hmacHash("session", rawToken);
  const sessions = db.collection<AdminSessionDoc>(ADMIN_SESSIONS_COLLECTION);
  const session = await sessions.findOne({ _id: tokenHash, expiresAt: { $gt: now } });
  if (!session) return null;

  const admin = await db.collection<AdminDoc>(ADMINS_COLLECTION).findOne({ _id: session.adminId });
  if (!admin || admin.disabledAt !== null) {
    await sessions.deleteOne({ _id: tokenHash });
    return null;
  }

  if (now.getTime() - session.lastSeenAt.getTime() >= SESSION_SLIDE_INTERVAL_MS) {
    const newExpiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await sessions.updateOne(
      { _id: tokenHash },
      { $set: { lastSeenAt: now, expiresAt: newExpiresAt } },
    );
    session.lastSeenAt = now;
    session.expiresAt = newExpiresAt;
  }

  return { session, admin };
}

export async function revokeSession(db: Db, rawToken: string): Promise<void> {
  const tokenHash = hmacHash("session", rawToken);
  await db.collection<AdminSessionDoc>(ADMIN_SESSIONS_COLLECTION).deleteOne({ _id: tokenHash });
}

export async function revokeAllAdminSessions(
  db: Db,
  adminId: ObjectId,
  exceptTokenHash?: string,
): Promise<void> {
  const filter = exceptTokenHash
    ? { adminId, _id: { $ne: exceptTokenHash } }
    : { adminId };
  await db.collection<AdminSessionDoc>(ADMIN_SESSIONS_COLLECTION).deleteMany(filter);
}

export async function revokeAllAdminDevices(db: Db, adminId: ObjectId): Promise<void> {
  await db.collection<AdminTrustedDeviceDoc>(ADMIN_TRUSTED_DEVICES_COLLECTION).deleteMany({ adminId });
}

export async function getCurrentAdmin(): Promise<{ admin: AdminDoc; session: AdminSessionDoc } | null> {
  // Session checks read the current time, which Next only allows at request time.
  await connection();
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return null;
  const db = await getDb();
  await ensureAdminIndexes(db);
  return getSessionAndAdmin(db, rawToken);
}

export async function requireAdmin(minRole: AdminRole = "viewer"): Promise<{ admin: AdminDoc; session: AdminSessionDoc }> {
  const current = await getCurrentAdmin();
  if (!current) {
    redirect("/admin/login");
  }
  if (!hasMinRole(current.admin.role, minRole)) {
    redirect("/admin");
  }
  return current;
}

export async function requireAdminAction(action: AdminAction): Promise<{ admin: AdminDoc; session: AdminSessionDoc }> {
  const current = await getCurrentAdmin();
  if (!current) {
    throw new Error("Unauthorized");
  }
  if (!can(current.admin.role, action)) {
    throw new Error("Forbidden");
  }
  return current;
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === 11000
  );
}

export async function acceptInvite(
  db: Db,
  input: { token: string; name: string; password: string; now?: Date },
): Promise<{ ok: true; admin: AdminDoc } | { ok: false; error: string }> {
  const now = input.now ?? new Date();
  const passwordHash = await hashPassword(input.password);
  const tokenHash = hmacHash("invite", input.token);

  const invites = db.collection<AdminInviteDoc>(ADMIN_INVITES_COLLECTION);
  const invite = await invites.findOneAndUpdate(
    { _id: tokenHash, acceptedAt: null, expiresAt: { $gt: now } },
    { $set: { acceptedAt: now } },
    { returnDocument: "after" },
  );
  if (!invite) {
    return { ok: false, error: "This invite link is invalid or has expired." };
  }

  const admins = db.collection<AdminDoc>(ADMINS_COLLECTION);
  const existing = await admins.findOne({ email: invite.email });
  if (existing) {
    await invites.updateOne({ _id: tokenHash }, { $set: { acceptedAt: null } });
    return { ok: false, error: "An admin account with this email already exists." };
  }

  const newAdmin: AdminDoc = {
    _id: new ObjectId(),
    email: invite.email,
    name: input.name,
    role: invite.role,
    passwordHash,
    backupCodeHashes: [],
    createdAt: now,
    passwordChangedAt: now,
    lastSignInAt: null,
    disabledAt: null,
  };

  try {
    await admins.insertOne(newAdmin);
  } catch (err) {
    await invites.updateOne({ _id: tokenHash }, { $set: { acceptedAt: null } });
    if (isDuplicateKeyError(err)) {
      return { ok: false, error: "An admin account with this email already exists." };
    }
    throw err;
  }

  return { ok: true, admin: newAdmin };
}
