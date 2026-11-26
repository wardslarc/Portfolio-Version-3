import "server-only";
import { ObjectId, type Db, type Filter } from "mongodb";

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
