"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { site } from "@/content/site";
import { getDb } from "@/lib/mongodb";
import { requireAdminAction } from "./auth";
import { sendInviteEmail } from "./email";
import {
  changeAdminRole,
  changeOwnPassword,
  clearChessCooldown,
  createAdminInvite,
  endChessGame,
  mutateMessageArchive,
  mutateMessageDelete,
  mutateMessageRead,
  regenerateOwnBackupCodes,
  removeAdmin,
  resendAdminInvite,
  revokeAdminInvite,
  revokeOwnSession,
  undoLastChessMove,
} from "./mutations";

const idSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid message ID.");

export async function setMessageReadAction(id: string, read: boolean): Promise<void> {
  const parsedId = idSchema.parse(id);
  const { admin } = await requireAdminAction("messages:mutate");
  const db = await getDb();
  await mutateMessageRead(db, admin, parsedId, read);
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/messages");
}

export async function setMessageArchivedAction(id: string, archived: boolean): Promise<void> {
  const parsedId = idSchema.parse(id);
  const { admin } = await requireAdminAction("messages:mutate");
  const db = await getDb();
  await mutateMessageArchive(db, admin, parsedId, archived);
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/messages");
}

export async function deleteMessageAction(id: string): Promise<void> {
  const parsedId = idSchema.parse(id);
  const { admin } = await requireAdminAction("messages:mutate");
  const db = await getDb();
  await mutateMessageDelete(db, admin, parsedId);
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/messages");
}

export async function undoLastChessMoveAction(gameNumber: number): Promise<{ ok: boolean; message?: string }> {
  const num = z.number().int().min(1).parse(gameNumber);
  const { admin } = await requireAdminAction("chess:mutate");
  const db = await getDb();
  const res = await undoLastChessMove(db, admin, num);
  revalidatePath("/admin/chess");
  revalidatePath("/admin");
  if (!res.ok) {
    return { ok: false, message: res.reason === "stale" ? "Board changed concurrently; refresh and try again." : "No move to undo." };
  }
  return { ok: true, message: `Undid ${res.undoneSan}.` };
}

export async function clearChessCooldownAction(visitorPrefix: string): Promise<{ deletedCount: number }> {
  const clean = z.string().trim().regex(/^[0-9a-fA-F]{8,64}$/).parse(visitorPrefix);
  const { admin } = await requireAdminAction("chess:mutate");
  const db = await getDb();
  const res = await clearChessCooldown(db, admin, clean);
  revalidatePath("/admin/chess");
  return res;
}

export async function endChessGameAction(gameNumber: number): Promise<{ ok: boolean; nextGameNumber?: number }> {
  const num = z.number().int().min(1).parse(gameNumber);
  const { admin } = await requireAdminAction("chess:mutate");
  const db = await getDb();
  const res = await endChessGame(db, admin, num);
  revalidatePath("/admin/chess");
  revalidatePath("/admin");
  if (!res.ok) return { ok: false };
  return { ok: true, nextGameNumber: res.nextGameNumber };
}

const roleSchema = z.enum(["owner", "admin", "viewer"]);
const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email.").max(200);

async function getOriginUrl(): Promise<string> {
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : site.url;
}

export async function inviteAdminAction(
  email: string,
  role: "owner" | "admin" | "viewer",
): Promise<{ ok: boolean; error?: string; emailed?: boolean }> {
  const parsedEmail = emailSchema.safeParse(email);
  if (!parsedEmail.success) {
    return { ok: false, error: parsedEmail.error.issues[0]?.message ?? "Invalid email." };
  }
  const parsedRole = roleSchema.parse(role);
  const { admin } = await requireAdminAction("admins:manage");
  const db = await getDb();
  const res = await createAdminInvite(db, admin, { email: parsedEmail.data, role: parsedRole });
  if (!res.ok) return { ok: false, error: res.error };

  const origin = await getOriginUrl();
  const emailed = await sendInviteEmail(res.email, `${origin}/admin/invite/${res.token}`, res.role, admin.name);
  revalidatePath("/admin/admins");
  return { ok: true, emailed };
}

export async function resendInviteAction(email: string): Promise<{ ok: boolean; error?: string; emailed?: boolean }> {
  const parsedEmail = emailSchema.parse(email);
  const { admin } = await requireAdminAction("admins:manage");
  const db = await getDb();
  const res = await resendAdminInvite(db, admin, parsedEmail);
  if (!res.ok) return { ok: false, error: res.error };

  const origin = await getOriginUrl();
  const emailed = await sendInviteEmail(res.email, `${origin}/admin/invite/${res.token}`, res.role, admin.name);
  revalidatePath("/admin/admins");
  return { ok: true, emailed };
}

export async function revokeInviteAction(email: string): Promise<void> {
  const parsedEmail = emailSchema.parse(email);
  const { admin } = await requireAdminAction("admins:manage");
  const db = await getDb();
  await revokeAdminInvite(db, admin, parsedEmail);
  revalidatePath("/admin/admins");
}

export async function changeAdminRoleAction(
  targetId: string,
  newRole: "owner" | "admin" | "viewer",
): Promise<{ ok: boolean; error?: string }> {
  const id = idSchema.parse(targetId);
  const role = roleSchema.parse(newRole);
  const { admin } = await requireAdminAction("admins:manage");
  const db = await getDb();
  const res = await changeAdminRole(db, admin, id, role);
  revalidatePath("/admin/admins");
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

export async function removeAdminAction(targetId: string): Promise<{ ok: boolean; error?: string }> {
  const id = idSchema.parse(targetId);
  const { admin } = await requireAdminAction("admins:manage");
  const db = await getDb();
  const res = await removeAdmin(db, admin, id);
  revalidatePath("/admin/admins");
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

export async function changeOwnPasswordAction(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  const { admin, session } = await requireAdminAction("security:self");
  const db = await getDb();
  const res = await changeOwnPassword(db, admin, session._id, { currentPassword, newPassword });
  revalidatePath("/admin/admins");
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

export async function regenerateBackupCodesAction(): Promise<{ codes: string[] }> {
  const { admin } = await requireAdminAction("security:self");
  const db = await getDb();
  const codes = await regenerateOwnBackupCodes(db, admin);
  revalidatePath("/admin/admins");
  return { codes };
}

export async function revokeOwnSessionAction(sessionTokenHash: string): Promise<void> {
  const hash = z.string().min(10).max(128).parse(sessionTokenHash);
  const { admin } = await requireAdminAction("security:self");
  const db = await getDb();
  await revokeOwnSession(db, admin, hash);
  revalidatePath("/admin/admins");
}
