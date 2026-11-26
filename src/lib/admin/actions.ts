"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { requireAdminAction } from "./auth";
import {
  clearChessCooldown,
  endChessGame,
  mutateMessageArchive,
  mutateMessageDelete,
  mutateMessageRead,
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
