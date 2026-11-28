import "server-only";
import { Chess } from "chess.js";
import { ObjectId, type ClientSession, type Db } from "mongodb";
import {
  GAMES_COLLECTION,
  LOCKS_COLLECTION,
  getOrCreateActiveGame,
  type ChessGameDoc,
  type ChessMoveLockDoc,
} from "@/lib/chess";
import { logAudit } from "./audit";
import {
  ADMINS_COLLECTION,
  ADMIN_INVITES_COLLECTION,
  ADMIN_SESSIONS_COLLECTION,
  INVITE_TTL_MS,
  generateAndStoreBackupCodes,
  revokeAllAdminDevices,
  revokeAllAdminSessions,
  type AdminDoc,
  type AdminInviteDoc,
  type AdminSessionDoc,
} from "./auth";
import { generateRandomToken, hashPassword, hmacHash, verifyPassword } from "./crypto";
import type { MessageRecord } from "./data";
import { can, type AdminRole } from "./permissions";

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

export async function createAdminInvite(
  db: Db,
  actor: AdminDoc,
  input: { email: string; role: AdminRole },
  now = new Date(),
): Promise<{ ok: true; token: string; email: string; role: AdminRole } | { ok: false; error: string }> {
  if (!can(actor.role, "admins:manage")) throw new Error("Forbidden");
  const email = input.email.trim().toLowerCase();

  const existing = await db.collection<AdminDoc>(ADMINS_COLLECTION).findOne({ email });
  if (existing) {
    return { ok: false, error: "An admin account with this email already exists." };
  }

  const invites = db.collection<AdminInviteDoc>(ADMIN_INVITES_COLLECTION);
  await invites.deleteMany({ email, acceptedAt: null });

  const token = generateRandomToken(32);
  const tokenHash = hmacHash("invite", token);
  await invites.insertOne({
    _id: tokenHash,
    email,
    role: input.role,
    invitedBy: actor._id,
    createdAt: now,
    expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
    acceptedAt: null,
  });

  await logAudit(db, actor, "admin.invite", email, `Role: ${input.role}`);
  return { ok: true, token, email, role: input.role };
}

export async function resendAdminInvite(
  db: Db,
  actor: AdminDoc,
  emailInput: string,
  now = new Date(),
): Promise<{ ok: true; token: string; email: string; role: AdminRole } | { ok: false; error: string }> {
  if (!can(actor.role, "admins:manage")) throw new Error("Forbidden");
  const email = emailInput.trim().toLowerCase();
  const invites = db.collection<AdminInviteDoc>(ADMIN_INVITES_COLLECTION);
  const existing = await invites.findOne({ email, acceptedAt: null });
  if (!existing) {
    return { ok: false, error: "No pending invite found for this email." };
  }

  await invites.deleteMany({ email, acceptedAt: null });
  const token = generateRandomToken(32);
  const tokenHash = hmacHash("invite", token);
  await invites.insertOne({
    _id: tokenHash,
    email,
    role: existing.role,
    invitedBy: actor._id,
    createdAt: now,
    expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
    acceptedAt: null,
  });

  await logAudit(db, actor, "admin.invite_resent", email, `Role: ${existing.role}`);
  return { ok: true, token, email, role: existing.role };
}

export async function revokeAdminInvite(
  db: Db,
  actor: AdminDoc,
  emailInput: string,
): Promise<boolean> {
  if (!can(actor.role, "admins:manage")) throw new Error("Forbidden");
  const email = emailInput.trim().toLowerCase();
  const res = await db.collection<AdminInviteDoc>(ADMIN_INVITES_COLLECTION).deleteMany({
    email,
    acceptedAt: null,
  });
  if (res.deletedCount > 0) {
    await logAudit(db, actor, "admin.invite_revoked", email);
    return true;
  }
  return false;
}

const ADMIN_META_COLLECTION = "admin_meta";

async function touchOwnerGuard(db: Db, session: ClientSession) {
  await db
    .collection<{ _id: string; v: number }>(ADMIN_META_COLLECTION)
    .updateOne({ _id: "owner-guard" }, { $inc: { v: 1 } }, { upsert: true, session });
}

async function runWithTxRetry<T>(
  db: Db,
  fn: (session: ClientSession) => Promise<{ commit: true; value: T } | { commit: false; value: T }>,
): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const session = db.client.startSession();
    try {
      session.startTransaction({
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      });
      const result = await fn(session);
      if (!result.commit) {
        await session.abortTransaction();
        return result.value;
      }
      await session.commitTransaction();
      return result.value;
    } catch (err) {
      await session.abortTransaction().catch(() => {});
      if (attempt < 3 && isTransientTxError(err)) continue;
      throw err;
    } finally {
      await session.endSession();
    }
  }
  throw new Error("Transaction failed after retries");
}

export async function changeAdminRole(
  db: Db,
  actor: AdminDoc,
  targetAdminId: string,
  newRole: AdminRole,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!can(actor.role, "admins:manage")) throw new Error("Forbidden");
  if (!ObjectId.isValid(targetAdminId)) return { ok: false, error: "Invalid admin ID." };

  const admins = db.collection<AdminDoc>(ADMINS_COLLECTION);
  const res = await runWithTxRetry<
    { ok: true; target?: AdminDoc; changed: boolean } | { ok: false; error: string }
  >(db, async (session) => {
    await touchOwnerGuard(db, session);

    const target = await admins.findOne({ _id: new ObjectId(targetAdminId) }, { session });
    if (!target) return { commit: false, value: { ok: false, error: "Admin not found." } };

    if (target.role === "owner" && newRole !== "owner") {
      const ownerCount = await admins.countDocuments({ role: "owner", disabledAt: null }, { session });
      if (ownerCount <= 1) {
        return { commit: false, value: { ok: false, error: "Cannot demote the last Owner." } };
      }
    }

    if (target.role === newRole) {
      return { commit: false, value: { ok: true, changed: false } };
    }

    await admins.updateOne({ _id: target._id }, { $set: { role: newRole } }, { session });
    return { commit: true, value: { ok: true, target, changed: true } };
  });

  if (!res.ok) return res;
  if (res.changed && res.target) {
    await logAudit(db, actor, "admin.role_changed", res.target.email, `${res.target.role} -> ${newRole}`);
  }
  return { ok: true };
}

export async function removeAdmin(
  db: Db,
  actor: AdminDoc,
  targetAdminId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!can(actor.role, "admins:manage")) throw new Error("Forbidden");
  if (!ObjectId.isValid(targetAdminId)) return { ok: false, error: "Invalid admin ID." };

  const admins = db.collection<AdminDoc>(ADMINS_COLLECTION);
  const res = await runWithTxRetry<{ ok: true; target: AdminDoc } | { ok: false; error: string }>(
    db,
    async (session) => {
      await touchOwnerGuard(db, session);

      const target = await admins.findOne({ _id: new ObjectId(targetAdminId) }, { session });
      if (!target) return { commit: false, value: { ok: false, error: "Admin not found." } };

      if (target.role === "owner") {
        const ownerCount = await admins.countDocuments({ role: "owner", disabledAt: null }, { session });
        if (ownerCount <= 1) {
          return { commit: false, value: { ok: false, error: "Cannot remove the last Owner." } };
        }
      }

      await admins.deleteOne({ _id: target._id }, { session });
      return { commit: true, value: { ok: true, target } };
    },
  );

  if (!res.ok) return res;
  await Promise.all([
    revokeAllAdminSessions(db, res.target._id),
    revokeAllAdminDevices(db, res.target._id),
  ]);
  await logAudit(db, actor, "admin.removed", res.target.email, `Was ${res.target.role}`);
  return { ok: true };
}

export async function changeOwnPassword(
  db: Db,
  actor: AdminDoc,
  currentSessionTokenHash: string,
  input: { currentPassword: string; newPassword: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!can(actor.role, "security:self")) throw new Error("Forbidden");
  const valid = await verifyPassword(input.currentPassword, actor.passwordHash);
  if (!valid) {
    return { ok: false, error: "Current password is incorrect." };
  }
  if (input.newPassword.length < 12) {
    return { ok: false, error: "New password must be at least 12 characters." };
  }
  if (input.newPassword.length > 200) {
    return { ok: false, error: "New password must be 200 characters or fewer." };
  }

  const passwordHash = await hashPassword(input.newPassword);
  await db.collection<AdminDoc>(ADMINS_COLLECTION).updateOne(
    { _id: actor._id },
    { $set: { passwordHash, passwordChangedAt: new Date() } },
  );
  // Trusted devices skip the email code, so a password change must end them too.
  await Promise.all([
    revokeAllAdminSessions(db, actor._id, currentSessionTokenHash),
    revokeAllAdminDevices(db, actor._id),
  ]);
  await logAudit(
    db,
    actor,
    "security.password_changed",
    actor.email,
    "Signed out other sessions and forgot trusted devices",
  );
  return { ok: true };
}

export async function regenerateOwnBackupCodes(db: Db, actor: AdminDoc): Promise<string[]> {
  if (!can(actor.role, "security:self")) throw new Error("Forbidden");
  const codes = await generateAndStoreBackupCodes(db, actor._id);
  await logAudit(db, actor, "security.backup_codes_regenerated", actor.email);
  return codes;
}

export async function revokeOwnSession(
  db: Db,
  actor: AdminDoc,
  sessionTokenHash: string,
): Promise<boolean> {
  if (!can(actor.role, "security:self")) throw new Error("Forbidden");
  const res = await db.collection<AdminSessionDoc>(ADMIN_SESSIONS_COLLECTION).deleteOne({
    _id: sessionTokenHash,
    adminId: actor._id,
  });
  if (res.deletedCount > 0) {
    await logAudit(db, actor, "security.session_revoked", actor.email);
    return true;
  }
  return false;
}
