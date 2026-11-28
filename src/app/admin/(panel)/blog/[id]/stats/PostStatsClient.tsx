"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  removeLikesFromSourceAction,
  resetPostStatsAction,
  setPostStatsHiddenAction,
} from "@/lib/admin/actions";
import type { EngagementCounter } from "@/lib/blog/engagement";

export interface ClientLikeSourceRow {
  source: string;
  ipHash?: string;
  count: number;
  lastAt: string;
  flagged: boolean;
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60_000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PostStatsClient({
  postId,
  confirmTitle,
  initialHideStats,
  likeSources,
  canManage,
}: {
  postId: string;
  confirmTitle: string;
  initialHideStats: boolean;
  likeSources: ClientLikeSourceRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [hideStats, setHideStats] = useState(initialHideStats);
  const [removeTarget, setRemoveTarget] = useState<ClientLikeSourceRow | null>(null);
  const [resetTargets, setResetTargets] = useState<{
    views: boolean;
    likes: boolean;
    shares: boolean;
  }>({ views: false, likes: false, shares: false });
  const [confirmInput, setConfirmInput] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [toastOpen, setToastOpen] = useState(false);

  const removeDialogRef = useRef<HTMLDialogElement>(null);
  const resetDialogRef = useRef<HTMLDialogElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    setToastMsg(msg);
    setToastOpen(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastOpen(false), 2600);
  }

  function openRemoveDialog(row: ClientLikeSourceRow) {
    setRemoveTarget(row);
    removeDialogRef.current?.showModal();
  }

  function handleConfirmRemove() {
    if (!removeTarget?.ipHash) return;
    const target = removeTarget;
    removeDialogRef.current?.close();
    startTransition(async () => {
      const res = await removeLikesFromSourceAction(postId, target.ipHash!);
      setRemoveTarget(null);
      if (!res.ok) {
        showToast(res.error);
        return;
      }
      showToast(`Removed ${res.deletedCount} like(s) from ${target.source}`);
      router.refresh();
    });
  }

  function handleToggleHide(nextHidden: boolean) {
    const prev = hideStats;
    setHideStats(nextHidden);
    startTransition(async () => {
      const res = await setPostStatsHiddenAction(postId, nextHidden);
      if (!res.ok) {
        setHideStats(prev);
        showToast(res.error);
        return;
      }
      showToast(res.hidden ? "Counts hidden on public page" : "Counts visible on public page");
      router.refresh();
    });
  }

  function openResetDialog() {
    setResetTargets({ views: false, likes: false, shares: false });
    setConfirmInput("");
    resetDialogRef.current?.showModal();
  }

  const selectedCounters: EngagementCounter[] = (["views", "likes", "shares"] as const).filter(
    (k) => resetTargets[k],
  );
  const canConfirmReset =
    selectedCounters.length > 0 && confirmInput === confirmTitle && !pending;

  function handleConfirmReset() {
    if (!canConfirmReset) return;
    const counters = [...selectedCounters];
    resetDialogRef.current?.close();
    startTransition(async () => {
      const res = await resetPostStatsAction(postId, counters);
      setConfirmInput("");
      if (!res.ok) {
        showToast(res.error);
        return;
      }
      showToast(`Reset ${res.reset.join(", ")}`);
      router.refresh();
    });
  }

  return (
    <>
      <div className="admin-card">
        <h2>Likes by source</h2>
        {likeSources.length === 0 ? (
          <p className="admin-auth-sub">No likes recorded yet.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th style={{ textAlign: "right" }}>Likes</th>
                  <th>Last liked</th>
                  <th>Status</th>
                  {canManage ? <th style={{ textAlign: "right" }}>Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {likeSources.map((row) => (
                  <tr key={row.source}>
                    <td className="mono">{row.source}</td>
                    <td className="mono" style={{ textAlign: "right" }}>
                      {row.count}
                    </td>
                    <td className="admin-muted">{formatRelativeTime(row.lastAt)}</td>
                    <td>
                      {row.flagged ? (
                        <span className="admin-badge danger">Flagged</span>
                      ) : (
                        <span className="admin-badge">Normal</span>
                      )}
                    </td>
                    {canManage ? (
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="admin-btn sm danger"
                          disabled={pending || !row.ipHash}
                          onClick={() => openRemoveDialog(row)}
                        >
                          Remove
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canManage ? (
        <div className="admin-card">
          <h2>Manage</h2>
          <div className="admin-manage-row">
            <div>
              <label htmlFor="hide-stats-switch" className="admin-manage-title">
                Hide counts on the public page
              </label>
              <p className="admin-auth-sub" style={{ margin: "2px 0 0" }}>
                Visitors can still like the post, but views, likes, and share counts are hidden publicly.
              </p>
            </div>
            <label className="admin-switch">
              <input
                id="hide-stats-switch"
                type="checkbox"
                role="switch"
                checked={hideStats}
                disabled={pending}
                onChange={(e) => handleToggleHide(e.target.checked)}
              />
              <span className="admin-switch-track" aria-hidden="true" />
            </label>
          </div>

          <div className="admin-manage-row">
            <div>
              <div className="admin-manage-title">Reset counters</div>
              <p className="admin-auth-sub" style={{ margin: "2px 0 0" }}>
                Permanently clear views, likes, or shares for this post.
              </p>
            </div>
            <button
              type="button"
              className="admin-btn sm danger"
              disabled={pending}
              onClick={openResetDialog}
            >
              Reset counters…
            </button>
          </div>
        </div>
      ) : null}

      <dialog ref={removeDialogRef} className="admin-dialog" aria-labelledby="remove-likes-title">
        <div className="admin-stack">
          <h2 id="remove-likes-title" style={{ margin: 0 }}>
            Remove likes from source?
          </h2>
          <p className="admin-auth-sub">
            Remove {removeTarget?.count ?? 0} {removeTarget?.count === 1 ? "like" : "likes"} from source{" "}
            <code className="mono">{removeTarget?.source}</code>? This can&apos;t be undone.
          </p>
          <div className="admin-row-actions" style={{ justifyContent: "flex-end" }}>
            <button
              type="button"
              className="admin-btn sm"
              onClick={() => {
                removeDialogRef.current?.close();
                setRemoveTarget(null);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="admin-btn sm danger"
              disabled={pending}
              onClick={handleConfirmRemove}
            >
              Remove
            </button>
          </div>
        </div>
      </dialog>

      <dialog ref={resetDialogRef} className="admin-dialog" aria-labelledby="reset-stats-title">
        <div className="admin-stack">
          <h2 id="reset-stats-title" style={{ margin: 0 }}>
            Reset counters
          </h2>
          <p className="admin-auth-sub" style={{ margin: 0 }}>
            Choose which counters to zero out. This also clears their history and daily records.
          </p>

          <div className="admin-check-list">
            <label className="admin-check-item">
              <input
                type="checkbox"
                checked={resetTargets.views}
                onChange={(e) => setResetTargets((prev) => ({ ...prev, views: e.target.checked }))}
              />
              <span>Views</span>
            </label>
            <label className="admin-check-item">
              <input
                type="checkbox"
                checked={resetTargets.likes}
                onChange={(e) => setResetTargets((prev) => ({ ...prev, likes: e.target.checked }))}
              />
              <span>Likes</span>
            </label>
            <label className="admin-check-item">
              <input
                type="checkbox"
                checked={resetTargets.shares}
                onChange={(e) => setResetTargets((prev) => ({ ...prev, shares: e.target.checked }))}
              />
              <span>Shares</span>
            </label>
          </div>

          <div className="admin-field">
            <label htmlFor="reset-confirm-input">
              Type <code className="mono">{confirmTitle}</code> to confirm
            </label>
            <input
              id="reset-confirm-input"
              className="admin-input"
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={confirmTitle}
              autoComplete="off"
            />
          </div>

          <div className="admin-row-actions" style={{ justifyContent: "flex-end" }}>
            <button
              type="button"
              className="admin-btn sm"
              onClick={() => resetDialogRef.current?.close()}
            >
              Cancel
            </button>
            <button
              type="button"
              className="admin-btn sm danger"
              disabled={!canConfirmReset}
              onClick={handleConfirmReset}
            >
              Reset selected
            </button>
          </div>
        </div>
      </dialog>

      <div className={`admin-toast${toastOpen ? " on" : ""}`} role="status" aria-live="polite">
        {toastMsg}
      </div>
    </>
  );
}
