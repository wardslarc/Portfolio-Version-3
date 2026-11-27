import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { queryPostEngagement } from "@/lib/blog/engagement";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import {
  DailyEngagementChart,
  EngagementStatCards,
  ShareChannelsCard,
} from "../../_components/EngagementCharts";
import PostStatsClient from "./PostStatsClient";

export const metadata: Metadata = {
  title: "Post stats",
};

async function PostStatsContent({ params }: { params: Promise<{ id: string }> }) {
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
  const detail = await queryPostEngagement(db, id);
  if (!detail) {
    notFound();
  }

  const canManage = can(admin.role, "blog:engagement");
  const canWrite = can(admin.role, "blog:write");
  const { post, totals, daily, byChannel, likeSources } = detail;

  const displayTitle = post.title || "Untitled post";
  const confirmTitle = post.title.trim() || post.slug;

  return (
    <div className="admin-stack">
      <div className="admin-page-head">
        <div>
          <h1>{displayTitle}</h1>
          <p className="admin-blog-sub">
            <span className="mono">/blog/{post.slug}</span>
            {post.hideStats ? (
              <>
                {" · "}
                <span className="admin-badge wait">Counts hidden</span>
              </>
            ) : null}
          </p>
        </div>

        <div className="admin-row-actions">
          <Link href="/admin/blog" className="admin-btn sm">
            ← All posts
          </Link>
          <Link href="/admin/blog/engagement" className="admin-btn sm">
            Engagement
          </Link>
          {post.derivedStatus === "published" ? (
            <Link
              href={`/blog/${post.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="admin-btn sm"
            >
              View post ↗
            </Link>
          ) : null}
          {canWrite ? (
            <Link href={`/admin/blog/${post.id}`} className="admin-btn sm primary">
              Edit
            </Link>
          ) : null}
        </div>
      </div>

      <EngagementStatCards totals={totals} previousTotals={null} />

      <div className="admin-two-col">
        <DailyEngagementChart daily={daily} title="Daily engagement (30d)" />
        <ShareChannelsCard byChannel={byChannel} />
      </div>

      <PostStatsClient
        postId={post.id}
        confirmTitle={confirmTitle}
        initialHideStats={post.hideStats}
        likeSources={likeSources.map((row) => ({
          source: row.source,
          count: row.count,
          lastAt: row.lastAt,
          flagged: row.flagged,
          ...(canManage ? { ipHash: row.ipHash } : {}),
        }))}
        canManage={canManage}
      />
    </div>
  );
}

export default function AdminBlogPostStatsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="admin-card">Loading post stats…</div>}>
      <PostStatsContent params={params} />
    </Suspense>
  );
}
