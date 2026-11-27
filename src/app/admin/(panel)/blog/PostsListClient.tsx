"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  deletePostAction,
  duplicatePostAction,
  unpublishPostAction,
} from "@/lib/admin/actions";
import type { AdminPostSort, DerivedPostStatus, SerializedAdminPost } from "@/lib/blog/posts";

type FilterStatus = "all" | DerivedPostStatus;

function buildUrl(params: { status: FilterStatus; q: string; sort?: AdminPostSort }): string {
  const sp = new URLSearchParams();
  if (params.status !== "all") sp.set("status", params.status);
  if (params.q.trim()) sp.set("q", params.q.trim());
  if (params.sort && params.sort !== "updated") sp.set("sort", params.sort);
  const qs = sp.toString();
  return qs ? `/admin/blog?${qs}` : "/admin/blog";
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatEditedRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Edited just now";
  if (mins < 60) return `Edited ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Edited ${hours}h ago`;
  return `Edited ${new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function displayDate(post: SerializedAdminPost): string {
  if (post.derivedStatus !== "draft" && post.publishedAt) {
    return formatShortDate(post.publishedAt);
  }
  return formatEditedRelative(post.updatedAt);
}

const STATUS_META: Record<DerivedPostStatus, { label: string; badge: string }> = {
  published: { label: "Published", badge: "ok" },
  scheduled: { label: "Scheduled", badge: "accent" },
  draft: { label: "Draft", badge: "wait" },
};

export default function PostsListClient({
  items,
  counts,
  q,
  status,
  sort,
  canWrite,
}: {
  items: SerializedAdminPost[];
  counts: { all: number; published: number; scheduled: number; draft: number };
  q: string;
  status: FilterStatus;
  sort: AdminPostSort;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [searchText, setSearchText] = useState(q);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SerializedAdminPost | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const [toastOpen, setToastOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    setToastMsg(msg);
    setToastOpen(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastOpen(false), 2400);
  }

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest(".admin-more-wrap")) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("click", handleOutside);
    return () => document.removeEventListener("click", handleOutside);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchText.trim() !== q.trim()) {
        router.replace(buildUrl({ status, q: searchText, sort }));
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [searchText, q, status, sort, router]);

  function handleDuplicate(postId: string) {
    setOpenMenuId(null);
    startTransition(async () => {
      const res = await duplicatePostAction(postId);
      if (!res.ok) {
        showToast(res.error);
        return;
      }
      showToast("Draft duplicated");
      router.push(`/admin/blog/${res.id}`);
    });
  }

  function handleUnpublish(postId: string) {
    setOpenMenuId(null);
    startTransition(async () => {
      const res = await unpublishPostAction(postId);
      if (!res.ok) {
        showToast(res.error);
        return;
      }
      showToast("Moved back to drafts");
      router.refresh();
    });
  }

  function openDeleteConfirm(post: SerializedAdminPost) {
    setOpenMenuId(null);
    setDeleteTarget(post);
    dialogRef.current?.showModal();
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    dialogRef.current?.close();
    startTransition(async () => {
      const res = await deletePostAction(id);
      setDeleteTarget(null);
      if (!res.ok) {
        showToast(res.error);
        return;
      }
      if (res.failedMediaUrls.length > 0) {
        showToast("Post deleted, but some Blob images could not be removed");
      } else {
        showToast("Post deleted");
      }
      router.refresh();
    });
  }

  const filterTabs: { key: FilterStatus; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "published", label: "Published", count: counts.published },
    { key: "scheduled", label: "Scheduled", count: counts.scheduled },
    { key: "draft", label: "Draft", count: counts.draft },
  ];

  return (
    <div className="admin-stack">
      <div className="admin-page-head">
        <div>
          <h1>Blog</h1>
          <p className="admin-blog-sub">Write, schedule and publish posts on carlsdaleescalo.com/blog.</p>
        </div>
        <div className="admin-row-actions">
          <Link href="/admin/blog/engagement" className="admin-btn">
            Engagement
          </Link>
          {canWrite ? (
            <Link href="/admin/blog/new" className="admin-btn primary">
              New post
            </Link>
          ) : null}
        </div>
      </div>

      <div className="admin-blog-toolbar">
        <input
          className="admin-blog-search"
          type="search"
          placeholder="Search titles and tags"
          aria-label="Search posts"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <div className="admin-seg" role="group" aria-label="Status">
          {filterTabs.map((tab) => (
            <Link
              key={tab.key}
              href={buildUrl({ status: tab.key, q: searchText, sort })}
              aria-current={status === tab.key ? "page" : undefined}
            >
              {tab.label}
              <span>{tab.count}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="admin-ptable" role="table" aria-label="Blog posts">
        <div className="admin-prow th" role="row">
          <span role="columnheader" />
          <span role="columnheader">Title</span>
          <span role="columnheader">Status</span>
          <span
            role="columnheader"
            className="c-date"
            aria-sort={sort === "updated" ? "descending" : "none"}
          >
            <Link
              href={buildUrl({ status, q: searchText, sort: "updated" })}
              className="admin-sort-link"
              data-active={sort === "updated" ? "true" : undefined}
            >
              Date{sort === "updated" ? " ↓" : ""}
            </Link>
          </span>
          <span
            role="columnheader"
            className="r c-views"
            aria-sort={sort === "views" ? "descending" : "none"}
          >
            <Link
              href={buildUrl({ status, q: searchText, sort: "views" })}
              className="admin-sort-link"
              data-active={sort === "views" ? "true" : undefined}
            >
              Views{sort === "views" ? " ↓" : ""}
            </Link>
          </span>
          <span
            role="columnheader"
            className="r c-likes"
            aria-sort={sort === "likes" ? "descending" : "none"}
          >
            <Link
              href={buildUrl({ status, q: searchText, sort: "likes" })}
              className="admin-sort-link"
              data-active={sort === "likes" ? "true" : undefined}
            >
              Likes{sort === "likes" ? " ↓" : ""}
            </Link>
          </span>
          <span
            role="columnheader"
            className="r c-shares"
            aria-sort={sort === "shares" ? "descending" : "none"}
          >
            <Link
              href={buildUrl({ status, q: searchText, sort: "shares" })}
              className="admin-sort-link"
              data-active={sort === "shares" ? "true" : undefined}
            >
              Shares{sort === "shares" ? " ↓" : ""}
            </Link>
          </span>
          <span role="columnheader" />
        </div>

        {items.length === 0 ? (
          <div className="admin-empty">
            No posts match.{" "}
            {canWrite ? <Link href="/admin/blog/new">Start a new one.</Link> : null}
          </div>
        ) : (
          items.map((post) => {
            const meta = STATUS_META[post.derivedStatus];
            const menuOpen = openMenuId === post.id;
            return (
              <div
                key={post.id}
                className="admin-prow"
                role="row"
              >
                <span className="thumb">
                  {post.cover ? (
                    <Image
                      src={post.cover.url}
                      alt=""
                      width={144}
                      height={90}
                      sizes="72px"
                    />
                  ) : null}
                </span>

                <div>
                  <Link href={`/admin/blog/${post.id}`} className="tt">
                    {post.title || "Untitled post"}
                  </Link>
                  <div className="ex">
                    {post.tags.length > 0 ? post.tags.join(" · ") : "No tags"}
                    {post.excerpt ? "" : " · no excerpt yet"}
                  </div>
                </div>

                <span>
                  <span className={`admin-badge ${meta.badge}`}>{meta.label}</span>
                </span>

                <span className="d c-date">{displayDate(post)}</span>

                <span className="r c-views">{post.views > 0 ? post.views : "–"}</span>
                <span className="r c-likes">{post.likes > 0 ? post.likes : "–"}</span>
                <span className="r c-shares">{post.shares > 0 ? post.shares : "–"}</span>

                <div className="admin-more-wrap">
                  <button
                    type="button"
                    className="admin-more-btn"
                    aria-label={`More actions for ${post.title || "Untitled post"}`}
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                    disabled={pending}
                    onClick={() => setOpenMenuId(menuOpen ? null : post.id)}
                  >
                    ⋯
                  </button>
                  {menuOpen ? (
                    <div className="admin-menu" role="menu">
                      {canWrite ? (
                        <Link
                          href={`/admin/blog/${post.id}`}
                          role="menuitem"
                          onClick={() => setOpenMenuId(null)}
                        >
                          Edit
                        </Link>
                      ) : null}
                      <Link
                        href={`/admin/blog/${post.id}/stats`}
                        role="menuitem"
                        onClick={() => setOpenMenuId(null)}
                      >
                        Stats
                      </Link>
                      {post.derivedStatus === "published" ? (
                        <Link
                          href={`/blog/${post.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          role="menuitem"
                          onClick={() => setOpenMenuId(null)}
                        >
                          View on site ↗
                        </Link>
                      ) : null}
                      {canWrite ? (
                        <>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => handleDuplicate(post.id)}
                          >
                            Duplicate
                          </button>
                          {post.status === "published" ? (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => handleUnpublish(post.id)}
                            >
                              Unpublish
                            </button>
                          ) : null}
                          <button
                            type="button"
                            role="menuitem"
                            className="danger"
                            onClick={() => openDeleteConfirm(post)}
                          >
                            Delete
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      <dialog ref={dialogRef} className="admin-dialog" aria-labelledby="del-post-title">
        <div className="admin-stack">
          <h2 id="del-post-title" style={{ margin: 0 }}>
            Delete this post?
          </h2>
          <p className="admin-auth-sub">
            This can&apos;t be undone. Any images uploaded during this post&apos;s lifetime and used only by{" "}
            <strong>{deleteTarget?.title || "this post"}</strong> will be removed from Blob.
          </p>
          <div className="admin-row-actions" style={{ justifyContent: "flex-end" }}>
            <button
              type="button"
              className="admin-btn sm"
              onClick={() => {
                dialogRef.current?.close();
                setDeleteTarget(null);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="admin-btn sm danger"
              onClick={handleConfirmDelete}
              disabled={pending}
            >
              Delete
            </button>
          </div>
        </div>
      </dialog>

      <div className={`admin-toast${toastOpen ? " on" : ""}`} role="status" aria-live="polite">
        {toastMsg}
      </div>
    </div>
  );
}
