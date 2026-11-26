"use client";

import { upload } from "@vercel/blob/client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { deleteMediaAction, registerMediaAction } from "@/lib/admin/actions";
import { prepareImageForUpload } from "@/lib/blog/image-prep";
import type { SerializedMedia } from "@/lib/blog/media";

type MediaFilter = "all" | "unused";

interface UploadProgressItem {
  id: string;
  name: string;
  previewUrl: string;
  percent: number;
  status: string;
  state: "working" | "ok" | "err";
}

function buildUrl(params: { filter: MediaFilter; q: string }): string {
  const sp = new URLSearchParams();
  if (params.filter !== "all") sp.set("filter", params.filter);
  if (params.q.trim()) sp.set("q", params.q.trim());
  const qs = sp.toString();
  return qs ? `/admin/media?${qs}` : "/admin/media";
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function MediaLibraryClient({
  items,
  totalCount,
  totalBytes,
  q,
  filter,
  canWrite,
  blobConfigured,
}: {
  items: SerializedMedia[];
  totalCount: number;
  totalBytes: number;
  q: string;
  filter: MediaFilter;
  canWrite: boolean;
  blobConfigured: boolean;
}) {
  const router = useRouter();
  const [searchText, setSearchText] = useState(q);
  const [uploads, setUploads] = useState<UploadProgressItem[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<SerializedMedia | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const [toastOpen, setToastOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastOpen(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastOpen(false), 2400);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchText.trim() !== q.trim()) {
        router.replace(buildUrl({ filter, q: searchText }));
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [searchText, q, filter, router]);

  async function handleUploadFiles(files: FileList) {
    if (!canWrite) return;
    if (!blobConfigured) {
      showToast("Image uploads aren't configured.");
      return;
    }

    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;

    for (const file of list) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const previewUrl = URL.createObjectURL(file);
      setUploads((prev) => [
        ...prev,
        { id, name: file.name, previewUrl, percent: 8, status: "Optimising…", state: "working" },
      ]);

      try {
        const prepared = await prepareImageForUpload(file);
        setUploads((prev) =>
          prev.map((u) =>
            u.id === id
              ? { ...u, name: prepared.filename, percent: 20, status: "Uploading 0%" }
              : u,
          ),
        );

        const blobResult = await upload(`blog/${prepared.filename}`, prepared.blob, {
          access: "public",
          handleUploadUrl: "/admin/api/blob",
          multipart: prepared.blob.size > 4_000_000,
          clientPayload: JSON.stringify({ contentType: prepared.blob.type }),
          onUploadProgress: ({ percentage }) => {
            const pct = Math.max(20, Math.min(95, Math.round(percentage)));
            setUploads((prev) =>
              prev.map((u) =>
                u.id === id
                  ? { ...u, percent: pct, status: `Uploading ${Math.round(percentage)}%` }
                  : u,
              ),
            );
          },
        });

        const reg = await registerMediaAction({
          url: blobResult.url,
          width: prepared.width,
          height: prepared.height,
        });

        if (!reg.ok) {
          throw new Error(reg.error);
        }

        setUploads((prev) =>
          prev.map((u) =>
            u.id === id ? { ...u, percent: 100, status: "Uploaded", state: "ok" } : u,
          ),
        );
        router.refresh();
        setTimeout(() => {
          URL.revokeObjectURL(previewUrl);
          setUploads((prev) => prev.filter((u) => u.id !== id));
        }, 2200);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setUploads((prev) =>
          prev.map((u) => (u.id === id ? { ...u, status: msg, state: "err" } : u)),
        );
        showToast(msg);
        setTimeout(() => {
          URL.revokeObjectURL(previewUrl);
          setUploads((prev) => prev.filter((u) => u.id !== id));
        }, 3500);
      }
    }
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    dialogRef.current?.close();
    startTransition(async () => {
      const res = await deleteMediaAction(id);
      setDeleteTarget(null);
      if (!res.ok) {
        showToast(res.error);
        return;
      }
      showToast("Image deleted");
      router.refresh();
    });
  }

  // Visual quota bar against a 500 MB hobby store reference, min 2% when non-empty
  const barPercent =
    totalBytes === 0 ? 0 : Math.min(100, Math.max(2, (totalBytes / (500 * 1024 * 1024)) * 100));

  return (
    <div className="admin-stack">
      <div className="admin-page-head">
        <div>
          <h1>Media</h1>
          <p className="admin-blog-sub">
            Images stored in Vercel Blob. Converted to WebP and resized to 2400px wide before upload.
          </p>
        </div>
        {canWrite ? (
          <>
            <button
              type="button"
              className="admin-btn primary"
              disabled={!blobConfigured}
              title={!blobConfigured ? "Image uploads aren't configured" : undefined}
              onClick={() => fileInputRef.current?.click()}
            >
              Upload images
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) void handleUploadFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </>
        ) : null}
      </div>

      {!blobConfigured ? (
        <div className="admin-alert">
          Image uploads aren&apos;t configured. Set <code>BLOB_READ_WRITE_TOKEN</code> to enable Blob uploads.
        </div>
      ) : null}

      <div className="admin-usage">
        <span>
          <b style={{ color: "var(--ink)" }}>
            {totalCount} {totalCount === 1 ? "image" : "images"}
          </b>{" "}
          · {formatBytes(totalBytes)} in the blob store
        </span>
        <div className="bar" aria-hidden="true">
          <i style={{ width: `${barPercent}%` }} />
        </div>
        <span>Unused images can be deleted</span>
      </div>

      {uploads.length > 0 ? (
        <div className="admin-card" style={{ padding: "12px 14px" }}>
          <div style={{ display: "grid", gap: "8px" }}>
            {uploads.map((u) => (
              <div key={u.id} className="admin-up">
                <Image src={u.previewUrl} alt="" width={40} height={40} unoptimized />
                <div>
                  <div className="nm">{u.name}</div>
                  <div className="pg">
                    <i style={{ width: `${u.percent}%` }} />
                  </div>
                </div>
                <span className={`st ${u.state === "ok" ? "ok" : u.state === "err" ? "err" : ""}`}>
                  {u.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="admin-blog-toolbar">
        <input
          className="admin-blog-search"
          type="search"
          placeholder="Search file names"
          aria-label="Search media"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <div className="admin-seg" role="group" aria-label="Filter">
          <Link
            href={buildUrl({ filter: "all", q: searchText })}
            aria-current={filter === "all" ? "page" : undefined}
          >
            All
          </Link>
          <Link
            href={buildUrl({ filter: "unused", q: searchText })}
            aria-current={filter === "unused" ? "page" : undefined}
          >
            Unused
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="admin-card">
          <div className="admin-empty">No images here.</div>
        </div>
      ) : (
        <div className="admin-mgrid">
          {items.map((item) => {
            const inUse = item.usedByCount > 0;
            return (
              <div key={item.id} className="admin-mitem">
                <div className="im">
                  <Image
                    src={item.url}
                    alt={item.filename}
                    fill
                    sizes="(max-width: 760px) 50vw, 240px"
                  />
                </div>
                <div className="mi">
                  <b title={item.filename}>{item.filename}</b>
                  <span>
                    {formatBytes(item.size)} ·{" "}
                    {inUse
                      ? `used in ${item.usedByCount} ${item.usedByCount === 1 ? "post" : "posts"}`
                      : "unused"}
                  </span>
                </div>
                <div className="ma">
                  <button
                    type="button"
                    className="admin-btn sm"
                    onClick={() => {
                      navigator.clipboard?.writeText(item.url).catch(() => {});
                      showToast("URL copied");
                    }}
                  >
                    Copy URL
                  </button>
                  {canWrite ? (
                    <button
                      type="button"
                      className="admin-btn sm danger"
                      disabled={inUse || pending}
                      title={inUse ? "Remove it from posts first" : undefined}
                      onClick={() => {
                        setDeleteTarget(item);
                        dialogRef.current?.showModal();
                      }}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <dialog ref={dialogRef} className="admin-dialog" aria-labelledby="del-media-title">
        <div className="admin-stack">
          <h2 id="del-media-title" style={{ margin: 0 }}>
            Delete this image?
          </h2>
          <p className="admin-auth-sub">
            It&apos;s removed from Vercel Blob. No post uses{" "}
            <strong>{deleteTarget?.filename}</strong>.
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
              disabled={pending}
              onClick={handleConfirmDelete}
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
