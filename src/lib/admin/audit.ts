import "server-only";
import type { Db, ObjectId } from "mongodb";

export const ADMIN_AUDIT_COLLECTION = "admin_audit";

export interface AdminAuditDoc {
  _id?: ObjectId;
  adminId: ObjectId | null;
  adminName: string;
  action: string;
  target: string;
  detail: string;
  at: Date;
}

export async function logAudit(
  db: Db,
  admin: { _id?: ObjectId | null; name: string },
  action: string,
  target: string,
  detail = "",
): Promise<void> {
  await db.collection<AdminAuditDoc>(ADMIN_AUDIT_COLLECTION).insertOne({
    adminId: admin._id ?? null,
    adminName: admin.name,
    action,
    target,
    detail,
    at: new Date(),
  });
}
