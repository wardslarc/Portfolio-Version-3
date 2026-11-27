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
            <div className="mono" style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
              {data.activeGame.moveCount} moves · {data.activeGame.visitorCount} visitors
            </div>
          ) : null}
        </div>
        <Link href="/admin/blog/engagement" className="admin-card admin-card-link">
          <div className="admin-stat-label">Blog (7d)</div>
          <div className="admin-stat-val" style={{ fontSize: "1.375rem" }}>
            {engagement7d.totals.views} views · {engagement7d.totals.likes} likes
          </div>
          <div
            className="mono"
            style={{
              color: "var(--muted)",
              fontSize: "0.75rem",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {engagement7d.topPosts[0]?.title ?? "No post activity yet"}
          </div>
        </Link>
      </div>

      <div className="admin-two-col">
        <div className="admin-card">
          <h2>Moves per day (7d)</h2>
          <div style={{ display: "grid", gap: "8px" }}>
            {data.movesPerDay.map((d) => (
              <div
                key={d.date}
                style={{
                  display: "grid",
                  gridTemplateColumns: "84px minmax(0, 1fr) 32px",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span className="mono" style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                  {d.date.slice(5)}
                </span>
                <div
                  style={{
                    height: "10px",
                    borderRadius: "999px",
                    background: "var(--surface)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.round((d.count / maxMoves) * 100)}%`,
                      background: "var(--accent)",
                      borderRadius: "999px",
                    }}
                  />
                </div>
                <span className="mono" style={{ textAlign: "right", fontSize: "0.75rem" }}>
                  {d.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-card">
          <h2>Top countries (chess)</h2>
          {data.topCountries.length === 0 ? (
            <p className="admin-auth-sub">No country data recorded yet.</p>
          ) : (
            <div style={{ display: "grid", gap: "8px" }}>
              {data.topCountries.map((c) => (
                <div
                  key={c.country}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingBottom: "6px",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  <span>{c.country}</span>
                  <span className="mono" style={{ color: "var(--muted)" }}>
                    {c.count} moves
                  </span>
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
                    <span className="mono" style={{ color: "var(--faint)", fontSize: "0.75rem" }}>
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
