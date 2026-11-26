import "server-only";
import { ObjectId, type Db, type Filter } from "mongodb";
import { GAMES_COLLECTION, type ChessGameDoc } from "@/lib/chess";
import { ADMIN_AUDIT_COLLECTION, type AdminAuditDoc } from "./audit";
import {
  ADMINS_COLLECTION,
  ADMIN_INVITES_COLLECTION,
  ADMIN_SESSIONS_COLLECTION,
  type AdminDoc,
  type AdminInviteDoc,
  type AdminSessionDoc,
} from "./auth";
import type { AdminRole } from "./permissions";

export const MESSAGE_PAGE_SIZE = 25;
export type MessageFilter = "all" | "unread" | "noemail" | "archived";

export interface MessageRecord {
  _id: ObjectId;
  name: string;
  email: string;
  message: string;
  createdAt: Date;
  ipHash?: string;
  userAgent?: string;
  emailed?: boolean;
  readAt?: Date | null;
  archivedAt?: Date | null;
}

export interface SerializedMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: string;
  emailed: boolean;
  readAt: string | null;
  archivedAt: string | null;
}

export function serializeMessage(doc: MessageRecord): SerializedMessage {
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    message: doc.message,
    createdAt: doc.createdAt.toISOString(),
    emailed: Boolean(doc.emailed),
    readAt: doc.readAt ? doc.readAt.toISOString() : null,
    archivedAt: doc.archivedAt ? doc.archivedAt.toISOString() : null,
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildMessageFilter(filter: MessageFilter, q?: string): Filter<MessageRecord> {
  const clauses: Filter<MessageRecord>[] = [];

  if (filter === "archived") {
    clauses.push({ archivedAt: { $type: "date" } });
  } else {
    clauses.push({ $or: [{ archivedAt: null }, { archivedAt: { $exists: false } }] });
    if (filter === "unread") {
      clauses.push({ $or: [{ readAt: null }, { readAt: { $exists: false } }] });
    } else if (filter === "noemail") {
      clauses.push({ emailed: false });
    }
  }

  const trimmedQ = q?.trim();
  if (trimmedQ) {
    const regex = new RegExp(escapeRegex(trimmedQ), "i");
    clauses.push({
      $or: [{ name: regex }, { email: regex }, { message: regex }],
    });
  }

  return clauses.length === 1 ? clauses[0]! : { $and: clauses };
}

export async function queryMessages(
  db: Db,
  opts: { filter?: MessageFilter; q?: string; page?: number; pageSize?: number } = {},
): Promise<{
  items: SerializedMessage[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const filter = opts.filter ?? "all";
  const pageSize = opts.pageSize ?? MESSAGE_PAGE_SIZE;
  const mongoFilter = buildMessageFilter(filter, opts.q);
  const col = db.collection<MessageRecord>("messages");

  const total = await col.countDocuments(mongoFilter);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, opts.page ?? 1), totalPages);
  const skip = (page - 1) * pageSize;

  const docs = await col
    .find(mongoFilter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(pageSize)
    .toArray();

  return {
    items: docs.map(serializeMessage),
    total,
    page,
    totalPages,
  };
}

export async function openMessageForAdmin(
  db: Db,
  id: string,
  allowMarkRead: boolean,
): Promise<{ message: SerializedMessage | null; markedRead: boolean }> {
  if (!ObjectId.isValid(id)) {
    return { message: null, markedRead: false };
  }
  const _id = new ObjectId(id);
  const col = db.collection<MessageRecord>("messages");

  if (allowMarkRead) {
    const updated = await col.findOneAndUpdate(
      { _id, $or: [{ readAt: null }, { readAt: { $exists: false } }] },
      { $set: { readAt: new Date() } },
      { returnDocument: "after" },
    );
    if (updated) {
      return { message: serializeMessage(updated), markedRead: true };
    }
  }

  const existing = await col.findOne({ _id });
  return { message: existing ? serializeMessage(existing) : null, markedRead: false };
}

export interface AdminChessMove {
  ply: number;
  san: string;
  from: string;
  to: string;
  promotion: "q" | "r" | "b" | "n" | null;
  city: string | null;
  country: string | null;
  visitorPrefix: string;
  playedAt: string;
}

export interface AdminChessGame {
  number: number;
  status: string;
  result: string | null;
  startFen: string;
  fen: string;
  version: number;
  visitorCount: number;
  startedAt: string;
  endedAt: string | null;
  moves: AdminChessMove[];
}

export interface AdminChessGameSummary {
  number: number;
  status: string;
  result: string | null;
  moveCount: number;
  visitorCount: number;
  startedAt: string;
  endedAt: string | null;
}

function serializeChessGame(doc: ChessGameDoc): AdminChessGame {
  return {
    number: doc.number,
    status: doc.status,
    result: doc.result,
    startFen: doc.startFen,
    fen: doc.fen,
    version: doc.version,
    visitorCount: doc.visitorCount,
    startedAt: doc.startedAt.toISOString(),
    endedAt: doc.endedAt ? doc.endedAt.toISOString() : null,
    moves: doc.moves.map((m) => ({
      ply: m.ply,
      san: m.san,
      from: m.from,
      to: m.to,
      promotion: m.promotion,
      city: m.city,
      country: m.country,
      visitorPrefix: m.visitorHash.slice(0, 8),
      playedAt: m.playedAt.toISOString(),
    })),
  };
}

export async function queryAdminChessData(
  db: Db,
  requestedGameNumber?: number,
): Promise<{
  game: AdminChessGame | null;
  activeGameNumber: number | null;
  games: AdminChessGameSummary[];
}> {
  const col = db.collection<ChessGameDoc>(GAMES_COLLECTION);
  const allDocs = await col.find({}).sort({ number: -1 }).limit(100).toArray();

  const activeDoc = allDocs.find((g) => g.status === "active") ?? null;
  const selectedDoc =
    requestedGameNumber !== undefined
      ? (allDocs.find((g) => g.number === requestedGameNumber) ?? activeDoc ?? allDocs[0] ?? null)
      : (activeDoc ?? allDocs[0] ?? null);

  return {
    game: selectedDoc ? serializeChessGame(selectedDoc) : null,
    activeGameNumber: activeDoc?.number ?? null,
    games: allDocs.map((g) => ({
      number: g.number,
      status: g.status,
      result: g.result,
      moveCount: g.moves.length,
      visitorCount: g.visitorCount,
      startedAt: g.startedAt.toISOString(),
      endedAt: g.endedAt ? g.endedAt.toISOString() : null,
    })),
  };
}

export interface SerializedAdminRow {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  lastSignInAt: string | null;
  createdAt: string;
  disabledAt: string | null;
}

export interface SerializedInviteRow {
  email: string;
  role: AdminRole;
  createdAt: string;
  expiresAt: string;
}

export interface SerializedSessionRow {
  id: string;
  userAgent: string;
  city: string | null;
  country: string | null;
  createdAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
}

export interface SerializedAuditRow {
  id: string;
  adminName: string;
  action: string;
  target: string;
  detail: string;
  at: string;
}

export async function queryAdminsPageData(
  db: Db,
  currentAdmin: AdminDoc,
  currentSessionTokenHash: string,
  opts: { canManageAdmins: boolean; canViewAudit: boolean },
) {
  const now = new Date();
  const [adminDocs, inviteDocs, sessionDocs, auditDocs] = await Promise.all([
    opts.canManageAdmins
      ? db
          .collection<AdminDoc>(ADMINS_COLLECTION)
          .find({}, { projection: { passwordHash: 0, backupCodeHashes: 0 } })
          .sort({ createdAt: 1 })
          .toArray()
      : Promise.resolve([]),
    opts.canManageAdmins
      ? db
          .collection<AdminInviteDoc>(ADMIN_INVITES_COLLECTION)
          .find({ acceptedAt: null, expiresAt: { $gt: now } }, { projection: { _id: 0 } })
          .sort({ createdAt: -1 })
          .toArray()
      : Promise.resolve([]),
    db
      .collection<AdminSessionDoc>(ADMIN_SESSIONS_COLLECTION)
      .find({ adminId: currentAdmin._id, expiresAt: { $gt: now } })
      .sort({ lastSeenAt: -1 })
      .toArray(),
    opts.canViewAudit
      ? db.collection<AdminAuditDoc>(ADMIN_AUDIT_COLLECTION).find({}).sort({ at: -1 }).limit(50).toArray()
      : Promise.resolve([]),
  ]);

  return {
    admins: adminDocs.map((a): SerializedAdminRow => ({
      id: a._id.toString(),
      email: a.email,
      name: a.name,
      role: a.role,
      lastSignInAt: a.lastSignInAt ? a.lastSignInAt.toISOString() : null,
      createdAt: a.createdAt.toISOString(),
      disabledAt: a.disabledAt ? a.disabledAt.toISOString() : null,
    })),
    invites: inviteDocs.map((i): SerializedInviteRow => ({
      email: i.email,
      role: i.role,
      createdAt: i.createdAt.toISOString(),
      expiresAt: i.expiresAt.toISOString(),
    })),
    sessions: sessionDocs.map((s): SerializedSessionRow => ({
      id: s._id,
      userAgent: s.userAgent,
      city: s.city,
      country: s.country,
      createdAt: s.createdAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
      isCurrent: s._id === currentSessionTokenHash,
    })),
    audit: auditDocs.map((e): SerializedAuditRow => ({
      id: e._id?.toString() ?? `${e.at.getTime()}-${e.action}`,
      adminName: e.adminName,
      action: e.action,
      target: e.target,
      detail: e.detail,
      at: e.at.toISOString(),
    })),
    backupCodesRemaining: currentAdmin.backupCodeHashes.length,
  };
}

export async function queryAdminOverview(db: Db) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfTodayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const messagesCol = db.collection<MessageRecord>("messages");
  const gamesCol = db.collection<ChessGameDoc>(GAMES_COLLECTION);

  const [unreadCount, messages7d, latestMsgDocs, activeGame, recentGames] = await Promise.all([
    messagesCol.countDocuments({
      $and: [
        { $or: [{ readAt: null }, { readAt: { $exists: false } }] },
        { $or: [{ archivedAt: null }, { archivedAt: { $exists: false } }] },
      ],
    }),
    messagesCol.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    messagesCol
      .find({ $or: [{ archivedAt: null }, { archivedAt: { $exists: false } }] })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray(),
    gamesCol.findOne({ status: "active" }, { sort: { number: -1 } }),
    gamesCol.find({}).sort({ number: -1 }).limit(20).toArray(),
  ]);

  // Build 7-day buckets (oldest -> today)
  const dayBuckets = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(startOfTodayUtc.getTime() - i * 24 * 60 * 60 * 1000);
    dayBuckets.set(d.toISOString().slice(0, 10), 0);
  }

  const countryCounts = new Map<string, number>();
  let movesToday = 0;

  for (const g of recentGames) {
    for (const m of g.moves) {
      if (m.playedAt >= startOfTodayUtc) {
        movesToday++;
      }
      const dayKey = m.playedAt.toISOString().slice(0, 10);
      if (dayBuckets.has(dayKey)) {
        dayBuckets.set(dayKey, (dayBuckets.get(dayKey) ?? 0) + 1);
      }
      if (m.country) {
        countryCounts.set(m.country, (countryCounts.get(m.country) ?? 0) + 1);
      }
    }
  }

  const movesPerDay = Array.from(dayBuckets.entries()).map(([date, count]) => ({ date, count }));
  const topCountries = Array.from(countryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([country, count]) => ({ country, count }));

  return {
    unreadCount,
    messages7d,
    movesToday,
    activeGame: activeGame
      ? { number: activeGame.number, moveCount: activeGame.moves.length, visitorCount: activeGame.visitorCount }
      : null,
    latestMessages: latestMsgDocs.map(serializeMessage),
    movesPerDay,
    topCountries,
  };
}
