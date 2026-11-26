"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { requireAdminAction } from "./auth";
import { mutateMessageArchive, mutateMessageDelete, mutateMessageRead } from "./mutations";

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
