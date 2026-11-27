import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin/auth";
import { queryEngagementSummary } from "@/lib/blog/engagement";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import {
  DailyEngagementChart,
  EngagementStatCards,
  ShareChannelsCard,
} from "../_components/EngagementCharts";

export const metadata: Metadata = {
  title: "Blog engagement",
};

type RangeKey = "7" | "30" | "all";

const RANGE_OPTIONS: { key: RangeKey; label: string; days: 7 | 30 | 0 }[] = [
  { key: "7", label: "7 days", days: 7 },
  { key: "30", label: "30 days", days: 30 },
  { key: "all", label: "All time", days: 0 },
];

const NUMBER_FMT = new Intl.NumberFormat("en-US");

function parseRange(raw: string | undefined): { key: RangeKey; days: 7 | 30 | 0 } {
  const match = RANGE_OPTIONS.find((opt) => opt.key === raw);
  return match ?? RANGE_OPTIONS[1]!;
}

async function EngagementContent({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireAdmin("viewer");
  const sp = await searchParams;
  const range = parseRange(sp.range);

  if (!isMongoConfigured()) {
    return (
      <div className="admin-card">
        <p className="admin-auth-sub">Database is not configured.</p>
      </div>
    );
  }

  const db = await getDb();
  const summary = await queryEngagementSummary(db, { days: range.days });

  const isEmpty =
    summary.totals.views === 0 &&
    summary.totals.likes === 0 &&
    summary.totals.shares === 0 &&
    summary.topPosts.length === 0;

  return (
    <div className="admin-stack">
      <div className="admin-page-head">
        <div>
          <h1>Blog engagement</h1>
          <p className="admin-blog-sub">Views, likes, and shares across published posts.</p>
        </div>
        <div className="admin-row-actions">
          <div className="admin-seg" role="group" aria-label="Date range">
            {RANGE_OPTIONS.map((opt) => (
              <Link
                key={opt.key}
                href={opt.key === "30" ? "/admin/blog/engagement" : `/admin/blog/engagement?range=${opt.key}`}
                aria-current={range.key === opt.key ? "page" : undefined}
              >
                {opt.label}
              </Link>
            ))}
          </div>
          <Link href="/admin/blog" className="admin-btn sm">
            ← All posts
          </Link>
        </div>
      </div>

      {isEmpty ? (
        <div className="admin-card">
          <p className="admin-empty" style={{ padding: "28px 12px", margin: 0 }}>
            No engagement yet. Stats appear once your posts get readers.
          </p>
        </div>
      ) : (
        <>
          <EngagementStatCards
            totals={summary.totals}
            previousTotals={summary.previousTotals}
            days={summary.days}
          />

          <div className="admin-two-col">
            <DailyEngagementChart
              daily={summary.daily}
              title={`Daily engagement (${summary.days === 7 ? "7d" : "30d"})`}
            />
            <ShareChannelsCard byChannel={summary.byChannel} />
          </div>

          <div className="admin-card">
            <h2>Top posts</h2>
            {summary.topPosts.length === 0 ? (
              <p className="admin-auth-sub">No post activity in this period.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Post</th>
                      <th style={{ textAlign: "right" }}>Views</th>
                      <th style={{ textAlign: "right" }}>Likes</th>
                      <th style={{ textAlign: "right" }}>Shares</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.topPosts.map((post) => (
                      <tr key={post.id}>
                        <td>
                          <Link href={`/admin/blog/${post.id}/stats`} className="admin-eng-post-link">
                            {post.title}
                          </Link>
                        </td>
                        <td className="mono" style={{ textAlign: "right" }}>
                          {NUMBER_FMT.format(post.views)}
                        </td>
                        <td className="mono" style={{ textAlign: "right" }}>
                          {NUMBER_FMT.format(post.likes)}
                        </td>
                        <td className="mono" style={{ textAlign: "right" }}>
                          {NUMBER_FMT.format(post.shares)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminBlogEngagementPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  return (
    <Suspense fallback={<div className="admin-card">Loading engagement…</div>}>
      <EngagementContent searchParams={searchParams} />
    </Suspense>
  );
}
