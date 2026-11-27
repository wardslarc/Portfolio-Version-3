import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { isBlobConfigured, queryMediaLibrary } from "@/lib/blog/media";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import MediaLibraryClient from "./MediaLibraryClient";

export const metadata: Metadata = {
  title: "Media",
};

async function MediaContent({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const { admin } = await requireAdmin("viewer");
  const sp = await searchParams;
  const q = sp.q ?? "";
  const filter = sp.filter === "unused" ? "unused" : "all";
  const canWrite = can(admin.role, "blog:write");

  if (!isMongoConfigured()) {
    return (
      <div className="admin-card">
        <p className="admin-auth-sub">Database is not configured.</p>
      </div>
    );
  }

  const db = await getDb();
  const data = await queryMediaLibrary(db, { q, filter });

  return (
    <MediaLibraryClient
      items={data.items}
      totalCount={data.totalCount}
      totalBytes={data.totalBytes}
      q={q}
      filter={filter}
      canWrite={canWrite}
      blobConfigured={isBlobConfigured()}
    />
  );
}

export default function AdminMediaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  return (
    <Suspense fallback={<div className="admin-card">Loading media…</div>}>
      <MediaContent searchParams={searchParams} />
    </Suspense>
  );
}
