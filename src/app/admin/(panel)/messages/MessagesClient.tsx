"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  deleteMessageAction,
  setMessageArchivedAction,
  setMessageReadAction,
} from "@/lib/admin/actions";
import type { MessageFilter, SerializedMessage } from "@/lib/admin/data";

function buildUrl(params: { filter: MessageFilter; q: string; page: number; id?: string | null }): string {
  const sp = new URLSearchParams();
  if (params.filter !== "all") sp.set("filter", params.filter);
  if (params.q.trim()) sp.set("q", params.q.trim());
  if (params.page > 1) sp.set("page", String(params.page));
  if (params.id) sp.set("id", params.id);
  const qs = sp.toString();
  return qs ? `/admin/messages?${qs}` : "/admin/messages";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const FILTERS: { key: MessageFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "noemail", label: "Email failed" },
  { key: "archived", label: "Archived" },
];

export default function MessagesClient({
  items,
  selected,
  filter,
  q,
  page,
  totalPages,
  total,
  canMutate,
}: {
  items: SerializedMessage[];
  selected: SerializedMessage | null;
  filter: MessageFilter;
  q: string;
  page: number;
  totalPages: number;
  total: number;
  canMutate: boolean;
}) {
  const router = useRouter();
  const [searchText, setSearchText] = useState(q);
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(buildUrl({ filter, q: searchText, page: 1 }));
  }

  function handleToggleRead() {
    if (!selected || !canMutate) return;
    const nextRead = !selected.readAt;
    startTransition(async () => {
      await setMessageReadAction(selected.id, nextRead);
      router.refresh();
    });
  }

  function handleToggleArchive() {
    if (!selected || !canMutate) return;
    const nextArchived = !selected.archivedAt;
    startTransition(async () => {
      await setMessageArchivedAction(selected.id, nextArchived);
      router.push(buildUrl({ filter, q, page }));
      router.refresh();
    });
  }

  function handleConfirmDelete() {
    if (!selected || !canMutate) return;
    dialogRef.current?.close();
    startTransition(async () => {
      await deleteMessageAction(selected.id);
      router.push(buildUrl({ filter, q, page }));
      router.refresh();
    });
  }

  return (
    <div className="admin-stack">
      <div className="admin-page-head">
        <div>
          <h1>Messages</h1>
          <p className="admin-auth-sub">{total} total</p>
        </div>

        <form onSubmit={handleSearch} className="admin-row-actions">
          <label htmlFor="msg-search" className="sr-only">
            Search messages
          </label>
          <input
            id="msg-search"
            type="search"
            className="admin-input"
            style={{ width: "220px" }}
            placeholder="Search name, email, text…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <button type="submit" className="admin-btn sm">
            Search
          </button>
        </form>
      </div>

      <div className="admin-row-actions" role="tablist" aria-label="Message filters">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Link
              key={f.key}
              href={buildUrl({ filter: f.key, q, page: 1 })}
              className={`admin-btn sm${active ? " primary" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="admin-msg-layout">
        <div className="admin-stack">
          {items.length === 0 ? (
            <div className="admin-card">
              <p className="admin-auth-sub">No messages match this filter.</p>
            </div>
          ) : (
            <div className="admin-msg-list">
              {items.map((m) => {
                const isActive = selected?.id === m.id;
                return (
                  <Link
                    key={m.id}
                    href={buildUrl({ filter, q, page, id: m.id })}
                    className={`admin-msg-item${isActive ? " active" : ""}`}
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
                );
              })}
            </div>
          )}

          {totalPages > 1 ? (
            <div className="admin-row-actions" style={{ justifyContent: "space-between" }}>
              <Link
                href={buildUrl({ filter, q, page: Math.max(1, page - 1) })}
                className="admin-btn sm"
                aria-disabled={page <= 1}
              >
                ← Prev
              </Link>
              <span className="mono admin-muted">
                Page {page} of {totalPages}
              </span>
              <Link
                href={buildUrl({ filter, q, page: Math.min(totalPages, page + 1) })}
                className="admin-btn sm"
                aria-disabled={page >= totalPages}
              >
                Next →
              </Link>
            </div>
          ) : null}
        </div>

        <div className="admin-card">
          {selected ? (
            <>
              <div className="admin-row-actions" style={{ justifyContent: "space-between" }}>
                <div>
                  <h2>{selected.name}</h2>
                  <div className="mono admin-muted">
                    {selected.email}
                  </div>
                </div>
                <span className={`admin-badge ${selected.emailed ? "ok" : "wait"}`}>
                  {selected.emailed ? "Emailed to you" : "Email failed"}
                </span>
              </div>

              <div className="admin-meta faint">
                {formatDate(selected.createdAt)}
                {selected.archivedAt ? " · Archived" : ""}
              </div>

              <div className="admin-msg-body">
                {selected.message}
              </div>

              <div className="admin-row-actions admin-msg-actions">
                <a
                  href={`mailto:${selected.email}?subject=${encodeURIComponent(`Re: Portfolio message`)}`}
                  className="admin-btn sm primary"
                >
                  Reply
                </a>

                {canMutate ? (
                  <>
                    <button type="button" className="admin-btn sm" onClick={handleToggleRead} disabled={pending}>
                      {selected.readAt ? "Mark unread" : "Mark read"}
                    </button>
                    <button type="button" className="admin-btn sm" onClick={handleToggleArchive} disabled={pending}>
                      {selected.archivedAt ? "Unarchive" : "Archive"}
                    </button>
                    <button
                      type="button"
                      className="admin-btn sm danger"
                      onClick={() => dialogRef.current?.showModal()}
                      disabled={pending}
                    >
                      Delete
                    </button>
                  </>
                ) : null}
              </div>
            </>
          ) : (
            <p className="admin-auth-sub">Select a message to read it.</p>
          )}
        </div>
      </div>

      <dialog ref={dialogRef} className="admin-dialog" aria-labelledby="delete-msg-title">
        <div className="admin-stack">
          <h2 id="delete-msg-title" style={{ margin: 0 }}>
            Delete message permanently?
          </h2>
          <p className="admin-auth-sub">
            This cannot be undone. Consider archiving instead if you might need it later.
          </p>
          <div className="admin-row-actions" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="admin-btn sm" onClick={() => dialogRef.current?.close()}>
              Cancel
            </button>
            <button type="button" className="admin-btn sm danger" onClick={handleConfirmDelete} disabled={pending}>
              Delete permanently
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
