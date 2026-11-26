import "server-only";
import { ObjectId, type Db } from "mongodb";
import { logAudit } from "./audit";
import type { AdminDoc } from "./auth";
import type { MessageRecord } from "./data";
import { can } from "./permissions";

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
