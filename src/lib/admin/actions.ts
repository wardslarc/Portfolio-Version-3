"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { site } from "@/content/site";
import { deleteMediaItem, registerMedia, type SerializedMedia } from "@/lib/blog/media";
import { deletePost, duplicatePost, unpublishPost } from "@/lib/blog/posts";
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

function inviteUrl(token: string): string {
  const base = (process.env.SITE_URL?.trim() || site.url).replace(/\/+$/, "");
  return `${base}/admin/invite/${token}`;
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

  const emailed = await sendInviteEmail(res.email, inviteUrl(res.token), res.role, admin.name);
  revalidatePath("/admin/admins");
  return { ok: true, emailed };
}

export async function resendInviteAction(email: string): Promise<{ ok: boolean; error?: string; emailed?: boolean }> {
  const parsedEmail = emailSchema.parse(email);
  const { admin } = await requireAdminAction("admins:manage");
  const db = await getDb();
  const res = await resendAdminInvite(db, admin, parsedEmail);
  if (!res.ok) return { ok: false, error: res.error };

  const emailed = await sendInviteEmail(res.email, inviteUrl(res.token), res.role, admin.name);
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

const registerMediaSchema = z.object({
  url: z.string().trim().url().max(1000),
  width: z.number().int().min(1).max(20_000),
  height: z.number().int().min(1).max(20_000),
});

export async function registerMediaAction(input: {
  url: string;
  width: number;
  height: number;
}): Promise<{ ok: true; media: SerializedMedia } | { ok: false; error: string }> {
  const parsed = registerMediaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid media metadata." };
  }
  const { admin } = await requireAdminAction("blog:write");
  const db = await getDb();
  const res = await registerMedia(db, admin, parsed.data);
  if (res.ok) {
    revalidatePath("/admin/media");
  }
  return res;
}

export async function deleteMediaAction(
  mediaId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsedId = idSchema.safeParse(mediaId);
  if (!parsedId.success) {
    return { ok: false, error: "Invalid media ID." };
  }
  const { admin } = await requireAdminAction("blog:write");
  const db = await getDb();
  const res = await deleteMediaItem(db, admin, parsedId.data);
  if (res.ok) {
    revalidatePath("/admin/media");
  }
  return res;
}

export async function unpublishPostAction(
  postId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsedId = idSchema.safeParse(postId);
  if (!parsedId.success) {
    return { ok: false, error: "Invalid post ID." };
  }
  const { admin } = await requireAdminAction("blog:write");
  const db = await getDb();
  const res = await unpublishPost(db, admin, parsedId.data);
  if (!res.ok) return res;
  updateTag("posts");
  updateTag(`post:${res.post.slug}`);
  revalidatePath("/admin/blog");
  revalidatePath(`/admin/blog/${parsedId.data}`);
  return { ok: true };
}

export async function duplicatePostAction(
  postId: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsedId = idSchema.safeParse(postId);
  if (!parsedId.success) {
    return { ok: false, error: "Invalid post ID." };
  }
  const { admin } = await requireAdminAction("blog:write");
  const db = await getDb();
  const res = await duplicatePost(db, admin, parsedId.data);
  if (!res.ok) return res;
  revalidatePath("/admin/blog");
  return { ok: true, id: res.post._id.toString() };
}

export async function deletePostAction(
  postId: string,
): Promise<{ ok: true; deletedMediaCount: number; failedMediaUrls: string[] } | { ok: false; error: string }> {
  const parsedId = idSchema.safeParse(postId);
  if (!parsedId.success) {
    return { ok: false, error: "Invalid post ID." };
  }
  const { admin } = await requireAdminAction("blog:write");
  const db = await getDb();
  const res = await deletePost(db, admin, parsedId.data);
  if (!res.ok) return res;
  updateTag("posts");
  updateTag(`post:${res.slug}`);
  revalidatePath("/admin/blog");
  revalidatePath("/admin/media");
  return {
    ok: true,
    deletedMediaCount: res.deletedMediaCount,
    failedMediaUrls: res.failedMediaUrls,
  };
}
