import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import ArticleView from "@/components/blog/ArticleView";
import { requireAdmin } from "@/lib/admin/auth";
import { extractToc, renderMarkdown } from "@/lib/blog/markdown";
import { getAdminPostById } from "@/lib/blog/posts";
import { getDb, isMongoConfigured } from "@/lib/mongodb";

export const metadata: Metadata = {
  title: "Preview post",
};

async function PreviewContent({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("viewer");
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

  const { post } = found;
  const html = await renderMarkdown(post.body);
  const toc = extractToc(post.body);

  const statusText =
    post.derivedStatus === "published"
      ? "Published"
      : post.derivedStatus === "scheduled" && post.publishedAt
        ? `Scheduled for ${new Date(post.publishedAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}`
        : "Draft preview · only admins can see this";

  return (
    <div>
      <div className="admin-preview-banner">
        <span>
          <strong>Preview</strong> · {statusText}
        </span>
        <div className="admin-row-actions">
          <Link href={`/admin/blog/${post.id}`} className="admin-btn sm">
            ← Back to editor
          </Link>
          {post.derivedStatus === "published" ? (
            <Link
              href={`/blog/${post.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="admin-btn sm primary"
            >
              View live ↗
            </Link>
          ) : null}
        </div>
      </div>

      <div className="wrap" style={{ paddingLeft: 0, paddingRight: 0 }}>
        <ArticleView
          post={post}
          html={html}
          toc={toc}
          backHref={`/admin/blog/${post.id}`}
          backLabel="← Back to editor"
          showShare={false}
        />
      </div>
    </div>
  );
}

export default function AdminBlogPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="admin-card">Loading preview…</div>}>
      <PreviewContent params={params} />
    </Suspense>
  );
}
