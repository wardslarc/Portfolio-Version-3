import type { DailyEngagementRow, EngagementTotals } from "@/lib/blog/engagement";
import type { PostShares } from "@/lib/blog/engagement-types";

const NUMBER_FMT = new Intl.NumberFormat("en-US");

function formatDelta(current: number, previous: number, days: number): {
  text: string;
  tone: "up" | "down" | "flat";
} {
  if (previous === 0) {
    if (current > 0) {
      return { text: `▲ New vs prev ${days} days`, tone: "up" };
    }
    if (current < 0) {
      return { text: `▼ ${NUMBER_FMT.format(current)} vs prev ${days} days`, tone: "down" };
    }
    return { text: `0% vs prev ${days} days`, tone: "flat" };
  }

  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100);
  if (pct > 0) {
    return { text: `▲ ${pct}% vs prev ${days} days`, tone: "up" };
  }
  if (pct < 0) {
    return { text: `▼ ${Math.abs(pct)}% vs prev ${days} days`, tone: "down" };
  }
  return { text: `0% vs prev ${days} days`, tone: "flat" };
}

export function EngagementStatCards({
  totals,
  previousTotals,
  days,
}: {
  totals: EngagementTotals;
  previousTotals: EngagementTotals | null;
  days?: 7 | 30 | 0;
}) {
  const cards: { key: keyof EngagementTotals; label: string; value: number; prev?: number }[] = [
    { key: "views", label: "Views", value: totals.views, prev: previousTotals?.views },
    { key: "likes", label: "Likes", value: totals.likes, prev: previousTotals?.likes },
    { key: "shares", label: "Shares", value: totals.shares, prev: previousTotals?.shares },
  ];

  return (
    <div className="admin-stats-grid cols-3">
      {cards.map((card) => {
        const delta =
          previousTotals !== null && card.prev !== undefined && days
            ? formatDelta(card.value, card.prev, days)
            : null;
        return (
          <div key={card.key} className="admin-card">
            <div className="admin-stat-label">{card.label}</div>
            <div className="admin-stat-val">{NUMBER_FMT.format(card.value)}</div>
            {delta ? (
              <div className={`admin-stat-delta ${delta.tone}`}>{delta.text}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function DailyEngagementChart({
  daily,
  title = "Daily engagement",
}: {
  daily: DailyEngagementRow[];
  title?: string;
}) {
  const maxViews = Math.max(1, ...daily.map((d) => d.views));
  const maxLikes = Math.max(1, ...daily.map((d) => Math.abs(d.likes)));
  const maxShares = Math.max(1, ...daily.map((d) => d.shares));

  return (
    <div className="admin-card">
      <div className="admin-row-actions" style={{ justifyContent: "space-between" }}>
        <h2>{title}</h2>
        <div className="admin-eng-legend" aria-label="Chart legend">
          <span>
            <i className="dot views" aria-hidden="true" />
            Views
          </span>
          <span>
            <i className="dot likes" aria-hidden="true" />
            Likes
          </span>
          <span>
            <i className="dot shares" aria-hidden="true" />
            Shares
          </span>
        </div>
      </div>

      <div className="admin-eng-bars">
        {daily.map((d) => {
          const viewsPct = d.views > 0 ? Math.max(2, Math.round((d.views / maxViews) * 100)) : 0;
          const likesPct =
            d.likes !== 0 ? Math.max(2, Math.round((Math.abs(d.likes) / maxLikes) * 100)) : 0;
          const sharesPct = d.shares > 0 ? Math.max(2, Math.round((d.shares / maxShares) * 100)) : 0;

          return (
            <div key={d.date} className="admin-eng-row">
              <span className="mono admin-eng-date">{d.date.slice(5)}</span>
              <div className="admin-eng-tracks">
                <div
                  className="admin-eng-track"
                  title={`${d.date}: ${NUMBER_FMT.format(d.views)} views`}
                >
                  <div className="admin-eng-fill views" style={{ width: `${viewsPct}%` }} />
                </div>
                <div
                  className="admin-eng-track"
                  title={`${d.date}: ${NUMBER_FMT.format(d.likes)} net likes`}
                >
                  <div
                    className={`admin-eng-fill ${d.likes < 0 ? "neg" : "likes"}`}
                    style={{ width: `${likesPct}%` }}
                  />
                </div>
                <div
                  className="admin-eng-track"
                  title={`${d.date}: ${NUMBER_FMT.format(d.shares)} shares`}
                >
                  <div className="admin-eng-fill shares" style={{ width: `${sharesPct}%` }} />
                </div>
              </div>
              <span className="mono admin-eng-vals">
                {d.views} / {d.likes} / {d.shares}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const CHANNEL_ROWS: { key: keyof PostShares; label: string }[] = [
  { key: "copy", label: "Copy link" },
  { key: "x", label: "Post on X" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "native", label: "Share…" },
];

export function ShareChannelsCard({ byChannel }: { byChannel: PostShares }) {
  const maxVal = Math.max(1, byChannel.copy, byChannel.x, byChannel.linkedin, byChannel.native);

  return (
    <div className="admin-card">
      <h2>Share channels</h2>
      <div style={{ display: "grid", gap: "12px" }}>
        {CHANNEL_ROWS.map((row) => {
          const val = byChannel[row.key];
          const pct = val > 0 ? Math.max(3, Math.round((val / maxVal) * 100)) : 0;
          return (
            <div key={row.key} className="admin-channel-row">
              <span>{row.label}</span>
              <div className="admin-eng-track lg" title={`${row.label}: ${NUMBER_FMT.format(val)}`}>
                <div className="admin-eng-fill shares" style={{ width: `${pct}%` }} />
              </div>
              <span className="mono" style={{ textAlign: "right", fontSize: "0.8125rem" }}>
                {NUMBER_FMT.format(val)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
