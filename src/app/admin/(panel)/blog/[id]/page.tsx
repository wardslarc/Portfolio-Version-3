import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { renderMarkdown } from "@/lib/blog/markdown";
import { isBlobConfigured } from "@/lib/blog/media";
import { getAdminPostById, getAllPostTags } from "@/lib/blog/posts";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import EditorClient from "./EditorClient";

export const metadata: Metadata = {
  title: "Edit post",
};

async function EditorContent({ params }: { params: Promise<{ id: string }> }) {
  const { admin } = await requireAdmin("viewer");
  const { id } = await params;

  if (!isMongoConfigured()) {
    return (
      <div className="admin-card">
        <p className="admin-auth-sub">Database is not configured.</p>
      </div>
    );
  }

  const db = await getDb();
  const found = await getAdminPostById(db, id);
  if (!found) {
    notFound();
  }

  const [initialPreviewHtml, existingTags] = await Promise.all([
    renderMarkdown(found.post.body),
    getAllPostTags(db),
  ]);

  return (
    <EditorClient
      initialPost={found.post}
      initialPreviewHtml={initialPreviewHtml}
      existingTags={existingTags}
      deletableMediaCount={found.deletableMediaCount}
      canWrite={can(admin.role, "blog:write")}
      blobConfigured={isBlobConfigured()}
    />
  );
}

export default function AdminBlogEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="admin-card">Loading editor…</div>}>
      <EditorContent params={params} />
    </Suspense>
  );
}
