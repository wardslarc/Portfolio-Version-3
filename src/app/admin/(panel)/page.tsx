import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { site } from "@/content/site";
import { requireAdmin } from "@/lib/admin/auth";
import { queryAdminOverview } from "@/lib/admin/data";
import { queryEngagementSummary } from "@/lib/blog/engagement";
import { getDb, isMongoConfigured } from "@/lib/mongodb";

export const metadata: Metadata = {
  title: "Overview",
};

async function OverviewContent() {
  await requireAdmin("viewer");

  if (!isMongoConfigured()) {
    return (
      <div className="admin-card">
        <p className="admin-auth-sub">Database is not configured.</p>
      </div>
    );
  }

  const db = await getDb();
  const [data, engagement7d] = await Promise.all([
    queryAdminOverview(db),
    queryEngagementSummary(db, { days: 7 }),
  ]);
  const maxMoves = Math.max(1, ...data.movesPerDay.map((d) => d.count));

  return (
    <div className="admin-stack">
      <div className="admin-page-head">
        <h1>Overview</h1>
      </div>

      <div className="admin-stats-grid">
        <div className="admin-card">
          <span className="k-tape admin-tape" aria-hidden="true" />
          <div className="admin-stat-label">Unread messages</div>
          <div className="admin-stat-val">{data.unreadCount}</div>
        </div>
        <div className="admin-card">
          <div className="admin-stat-label">Messages (7d)</div>
          <div className="admin-stat-val">{data.messages7d}</div>
        </div>
        <div className="admin-card">
          <div className="admin-stat-label">Moves today</div>
          <div className="admin-stat-val">{data.movesToday}</div>
        </div>
        <div className="admin-card">
          <div className="admin-stat-label">Current game</div>
          <div className="admin-stat-val">
            {data.activeGame ? `#${data.activeGame.number}` : "—"}
          </div>
          {data.activeGame ? (
            <div className="admin-meta">
              {data.activeGame.moveCount} moves · {data.activeGame.visitorCount} visitors
            </div>
          ) : null}
        </div>
        <Link href="/admin/blog/engagement" className="admin-card admin-card-link">
          <div className="admin-stat-label">Blog (7d)</div>
          <div className="admin-stat-val sm">
            {engagement7d.totals.views} views · {engagement7d.totals.likes} likes
          </div>
          <div className="admin-meta admin-ellipsis">
            {engagement7d.topPosts[0]?.title ?? "No post activity yet"}
          </div>
        </Link>
      </div>

      <div className="admin-two-col">
        <div className="admin-card">
          <h2>Moves per day (7d)</h2>
          <div className="admin-bars">
            {data.movesPerDay.map((d) => (
              <div key={d.date} className="admin-bar">
                <span className="admin-meta">{d.date.slice(5)}</span>
                <div className="admin-bar-track">
                  <div
                    className="admin-bar-fill"
                    style={{ width: `${Math.round((d.count / maxMoves) * 100)}%` }}
                  />
                </div>
                <span className="admin-bar-count">{d.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-card">
          <h2>Top countries (chess)</h2>
          {data.topCountries.length === 0 ? (
            <p className="admin-auth-sub">No country data recorded yet.</p>
          ) : (
            <div className="admin-bars">
              {data.topCountries.map((c) => (
                <div key={c.country} className="admin-kv">
                  <span>{c.country}</span>
                  <span className="mono admin-muted">{c.count} moves</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="admin-two-col">
        <div className="admin-card">
          <div className="admin-row-actions" style={{ justifyContent: "space-between" }}>
            <h2>Latest messages</h2>
            <Link href="/admin/messages" className="admin-btn sm">
              View all
            </Link>
          </div>
          {data.latestMessages.length === 0 ? (
            <p className="admin-auth-sub">No messages yet.</p>
          ) : (
            <div className="admin-msg-list">
              {data.latestMessages.map((m) => (
                <Link
                  key={m.id}
                  href={`/admin/messages?id=${m.id}`}
                  className="admin-msg-item"
                >
                  <div className="admin-msg-item-top">
                    <span className="admin-msg-sender">
                      {!m.readAt ? <span className="admin-unread-dot" aria-label="Unread" /> : null}
                      {m.name}
                    </span>
                    <span className="admin-meta faint">
                      {new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <span className="admin-msg-preview">{m.message}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="admin-card">
          <h2>Site traffic</h2>
          <p className="admin-auth-sub">
            Vercel Web Analytics and Speed Insights track the public portfolio while excluding{" "}
            <code>/admin</code>.
          </p>
          <div className="admin-row-actions">
            <a
              href={site.analyticsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="admin-btn sm primary"
            >
              Open Vercel Analytics ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminOverviewPage() {
  return (
    <Suspense fallback={<div className="admin-card">Loading overview…</div>}>
      <OverviewContent />
    </Suspense>
  );
}
