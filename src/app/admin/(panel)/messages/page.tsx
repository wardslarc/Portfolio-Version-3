import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin/auth";
import { openMessageForAdmin, queryMessages, type MessageFilter } from "@/lib/admin/data";
import { can } from "@/lib/admin/permissions";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import MessagesClient from "./MessagesClient";

export const metadata: Metadata = {
  title: "Messages",
};

const VALID_FILTERS = new Set<MessageFilter>(["all", "unread", "noemail", "archived"]);

async function MessagesContent({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; q?: string; filter?: string; page?: string }>;
}) {
  const { admin } = await requireAdmin("viewer");
  const sp = await searchParams;
  const filter: MessageFilter =
    sp.filter && VALID_FILTERS.has(sp.filter as MessageFilter) ? (sp.filter as MessageFilter) : "all";
  const q = sp.q ?? "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const canMutate = can(admin.role, "messages:mutate");

  if (!isMongoConfigured()) {
    return (
      <div className="admin-card">
        <p className="admin-auth-sub">Database is not configured.</p>
      </div>
    );
  }

  const db = await getDb();
  const [list, opened] = await Promise.all([
    queryMessages(db, { filter, q, page }),
    sp.id ? openMessageForAdmin(db, sp.id, canMutate) : Promise.resolve({ message: null, markedRead: false }),
  ]);

  const items = opened.markedRead && opened.message
    ? list.items.map((item) => (item.id === opened.message!.id ? opened.message! : item))
    : list.items;

  return (
    <MessagesClient
      items={items}
      selected={opened.message}
      filter={filter}
      q={q}
      page={list.page}
      totalPages={list.totalPages}
      total={list.total}
      canMutate={canMutate}
    />
  );
}

export default function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; q?: string; filter?: string; page?: string }>;
}) {
  return (
    <Suspense fallback={<div className="admin-card">Loading messages…</div>}>
      <MessagesContent searchParams={searchParams} />
    </Suspense>
  );
}
