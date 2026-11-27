import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { queryAdminPosts, type AdminPostSort, type DerivedPostStatus } from "@/lib/blog/posts";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import PostsListClient from "./PostsListClient";

export const metadata: Metadata = {
  title: "Blog",
};

const VALID_STATUSES = new Set<"all" | DerivedPostStatus>(["all", "published", "scheduled", "draft"]);
const VALID_SORTS = new Set<AdminPostSort>(["updated", "views", "likes", "shares"]);

async function BlogPostsContent({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string }>;
}) {
  const { admin } = await requireAdmin("viewer");
  const sp = await searchParams;
  const status: "all" | DerivedPostStatus =
    sp.status && VALID_STATUSES.has(sp.status as "all" | DerivedPostStatus)
      ? (sp.status as "all" | DerivedPostStatus)
      : "all";
  const sort: AdminPostSort =
    sp.sort && VALID_SORTS.has(sp.sort as AdminPostSort)
      ? (sp.sort as AdminPostSort)
      : "updated";
  const q = sp.q ?? "";
  const canWrite = can(admin.role, "blog:write");

  if (!isMongoConfigured()) {
    return (
      <div className="admin-card">
        <p className="admin-auth-sub">Database is not configured.</p>
      </div>
    );
  }

  const db = await getDb();
  const { items, counts } = await queryAdminPosts(db, { q, status, sort });

  return (
    <PostsListClient
      items={items}
      counts={counts}
      q={q}
      status={status}
      sort={sort}
      canWrite={canWrite}
    />
  );
}

export default function AdminBlogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string }>;
}) {
  return (
    <Suspense fallback={<div className="admin-card">Loading posts…</div>}>
      <BlogPostsContent searchParams={searchParams} />
    </Suspense>
  );
}
