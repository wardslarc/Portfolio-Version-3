"use client";

import { upload } from "@vercel/blob/client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import InkScope from "@/components/ink/InkScope";
import {
  deletePostAction,
  publishPostAction,
  registerMediaAction,
  renderPreviewAction,
  savePostAction,
  unpublishPostAction,
} from "@/lib/admin/actions";
import { prepareImageForUpload } from "@/lib/blog/image-prep";
import type { DerivedPostStatus, PostCover, SerializedAdminPost } from "@/lib/blog/posts";
import { isValidSlug, slugify } from "@/lib/blog/slug";

type ViewMode = "w" | "s" | "p";
type PublishChoice = "draft" | "scheduled" | "published";

interface UploadProgressItem {
  id: string;
  name: string;
  previewUrl: string;
  percent: number;
  status: string;
  state: "working" | "ok" | "err";
}

interface DialogState {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
}

const WRAP_MAP: Record<string, [string, string, string]> = {
  b: ["**", "**", "bold text"],
  i: ["*", "*", "italic text"],
  a: ["[", "](https://)", "link text"],
  h2: ["\n## ", "", "Heading"],
  q: ["\n> ", "", "Quote"],
  ul: ["\n- ", "", "List item"],
  code: ["\n```ts\n", "\n```\n", "code"],
};

function hasBodyImageWithoutAlt(markdown: string): boolean {
  const withoutFences = markdown.replace(/```[\s\S]*?```/g, "");
  for (const match of withoutFences.matchAll(/!\[([^\]]*)\]\([^)\s]+\)/g)) {
    const alt = (match[1] ?? "").trim();
    if (!alt || alt.toLowerCase() === "describe this image") {
      return true;
    }
  }
  return false;
}

function toLocalDateTimeInput(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (!iso) {
    d.setHours(9, 0, 0, 0);
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditorClient({
  initialPost,
  initialPreviewHtml,
  existingTags,
  deletableMediaCount,
  canWrite,
  blobConfigured,
}: {
  initialPost: SerializedAdminPost;
  initialPreviewHtml: string;
  existingTags: string[];
  deletableMediaCount: number;
  canWrite: boolean;
  blobConfigured: boolean;
}) {
  const router = useRouter();
  const [postStatus, setPostStatus] = useState(initialPost.status);
  const [derivedStatus, setDerivedStatus] = useState<DerivedPostStatus>(initialPost.derivedStatus);
  const [savedSlug, setSavedSlug] = useState(initialPost.slug);

  const [title, setTitle] = useState(initialPost.title);
  const [slug, setSlug] = useState(initialPost.slug);
  const [slugTouched, setSlugTouched] = useState(
    Boolean(initialPost.title.trim()) && initialPost.slug !== slugify(initialPost.title),
  );
  const [slugError, setSlugError] = useState<string | null>(null);
  const [excerpt, setExcerpt] = useState(initialPost.excerpt);
  const [body, setBody] = useState(initialPost.body);
  const [cover, setCover] = useState<PostCover | null>(initialPost.cover);
  const [tags, setTags] = useState<string[]>(initialPost.tags);
  const [tagDraft, setTagDraft] = useState("");

  const [publishChoice, setPublishChoice] = useState<PublishChoice>(
    initialPost.derivedStatus === "scheduled"
      ? "scheduled"
      : initialPost.derivedStatus === "published"
        ? "published"
        : "draft",
  );
  const [scheduledLocal, setScheduledLocal] = useState<string>(() =>
    initialPost.derivedStatus === "scheduled" && initialPost.publishedAt
      ? toLocalDateTimeInput(initialPost.publishedAt)
      : "",
  );

  const [viewMode, setViewMode] = useState<ViewMode>("s");
  const [previewHtml, setPreviewHtml] = useState(initialPreviewHtml);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState<string>(() => {
    if (initialPost.derivedStatus === "published") return "Published";
    if (initialPost.derivedStatus === "scheduled") return "Scheduled";
    return "Draft · saved";
  });

  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadProgressItem[]>([]);
  const [toastMsg, setToastMsg] = useState("");
  const [toastOpen, setToastOpen] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [pending, startTransition] = useTransition();

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const bodyFileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPayloadRef = useRef({ title, slug, excerpt, body, cover, tags });

  useEffect(() => {
    latestPayloadRef.current = { title, slug, excerpt, body, cover, tags };
  }, [title, slug, excerpt, body, cover, tags]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastOpen(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastOpen(false), 2400);
  }, []);

  // Warn before closing tab with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Debounced server-side Markdown preview
  useEffect(() => {
    if (viewMode === "w") return;
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      try {
        const res = await renderPreviewAction(body);
        setPreviewHtml(res.html);
      } catch {
        // Ignore transient preview errors while typing
      }
    }, 400);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [body, viewMode]);

  const runSaveDraft = useCallback(
    async (explicit = false) => {
      if (!canWrite || postStatus !== "draft") return;
      const payload = latestPayloadRef.current;
      if (!isValidSlug(payload.slug)) {
        setSlugError("Slug must use lowercase letters, numbers, and hyphens.");
        return;
      }

      setSaving(true);
      setSaveLabel("Saving…");
      try {
        const res = await savePostAction(initialPost.id, payload, { audit: explicit });
        if (!res.ok) {
          if (res.field === "slug") setSlugError(res.error);
          if (explicit) showToast(res.error);
          setSaveLabel("Unsaved changes");
          return;
        }
        setSlugError(null);
        setSavedSlug(res.slug);
        setDirty(false);
        setSaveLabel("Draft · saved just now");
        if (explicit) showToast("Draft saved");
      } finally {
        setSaving(false);
      }
    },
    [canWrite, initialPost.id, postStatus, showToast],
  );

  // Autosave drafts 2 seconds after last change
  useEffect(() => {
    if (!dirty || !canWrite || postStatus !== "draft") return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void runSaveDraft(false);
    }, 2000);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [dirty, canWrite, postStatus, title, slug, excerpt, body, cover, tags, runSaveDraft]);

  function markDirty() {
    if (!canWrite) return;
    setDirty(true);
    setSaveLabel("Unsaved changes");
  }

  function handleTitleChange(val: string) {
    setTitle(val);
    if (!slugTouched) {
      const nextSlug = slugify(val) || "untitled-post";
      setSlug(nextSlug);
      setSlugError(null);
    }
    if (titleRef.current) {
      titleRef.current.style.height = "auto";
      titleRef.current.style.height = `${titleRef.current.scrollHeight}px`;
    }
    markDirty();
  }

  function handleSlugChange(val: string) {
    setSlugTouched(true);
    const cleaned = val.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    setSlug(cleaned);
    setSlugError(cleaned && !isValidSlug(cleaned) ? "Use lowercase letters, numbers, and hyphens." : null);
    markDirty();
  }

  function applyToolbar(key: string) {
    if (!canWrite) return;
    const el = bodyRef.current;
    const spec = WRAP_MAP[key];
    if (!el || !spec) return;
    const [before, after, placeholder] = spec;
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const selected = body.slice(start, end) || placeholder;
    const nextBody = body.slice(0, start) + before + selected + after + body.slice(end);
    setBody(nextBody);
    markDirty();
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + before.length + selected.length + after.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  async function handleImageFiles(files: FileList | File[], target: "body" | "cover") {
    if (!canWrite) return;
    if (!blobConfigured) {
      showToast("Image uploads aren't configured.");
      return;
    }
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;

    const toProcess = target === "cover" ? list.slice(0, 1) : list;

    for (const file of toProcess) {
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

        if (target === "cover") {
          setCover((prev) => ({
            url: blobResult.url,
            alt: prev?.alt ?? "",
            width: prepared.width,
            height: prepared.height,
          }));
          markDirty();
          showToast("Cover uploaded to Blob");
        } else {
          const el = bodyRef.current;
          const snippet = `\n![Describe this image](${blobResult.url})\n`;
          setBody((prev) => {
            if (!el) return prev + snippet;
            const pos = el.selectionStart ?? prev.length;
            return prev.slice(0, pos) + snippet + prev.slice(pos);
          });
          markDirty();
        }

        setTimeout(() => {
          URL.revokeObjectURL(previewUrl);
          setUploads((prev) => prev.filter((u) => u.id !== id));
        }, 2500);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setUploads((prev) =>
          prev.map((u) => (u.id === id ? { ...u, status: msg, state: "err" } : u)),
        );
        showToast(msg);
        setTimeout(() => {
          URL.revokeObjectURL(previewUrl);
          setUploads((prev) => prev.filter((u) => u.id !== id));
        }, 4000);
      }
    }
  }

  function addTag(raw: string) {
    const clean = raw.trim();
    if (!clean || clean.length > 24 || tags.length >= 5) return;
    if (tags.some((t) => t.toLowerCase() === clean.toLowerCase())) return;
    setTags([...tags, clean]);
    setTagDraft("");
    markDirty();
  }

  function openConfirm(state: DialogState) {
    setDialogState(state);
    dialogRef.current?.showModal();
  }

  function handlePrimaryAction() {
    if (!canWrite) return;

    if (postStatus === "published" && publishChoice === "draft") {
      openConfirm({
        title: "Move post back to drafts?",
        body: `/${slug} will be unpublished and removed from /blog and RSS.`,
        confirmLabel: "Unpublish",
        onConfirm: () => {
          startTransition(async () => {
            const res = await unpublishPostAction(initialPost.id);
            if (!res.ok) {
              showToast(res.error);
              return;
            }
            setPostStatus("draft");
            setDerivedStatus("draft");
            setSaveLabel("Draft · saved");
            showToast("Moved back to drafts");
            router.refresh();
          });
        },
      });
      return;
    }

    if (publishChoice === "scheduled") {
      const targetIso = new Date(scheduledLocal).toISOString();
      if (!scheduledLocal || Number.isNaN(Date.parse(targetIso)) || Date.parse(targetIso) <= Date.now()) {
        showToast("Choose a future date and time to schedule.");
        return;
      }
      openConfirm({
        title: "Schedule this post?",
        body: `It goes live at /blog/${slug} on ${scheduledLocal.replace("T", " at ")}.`,
        confirmLabel: postStatus === "published" ? "Update schedule" : "Schedule",
        onConfirm: () => {
          startTransition(async () => {
            const res = await publishPostAction(initialPost.id, {
              mode: "schedule",
              scheduledAt: targetIso,
              patch: latestPayloadRef.current,
            });
            if (!res.ok) {
              if (res.field === "slug") setSlugError(res.error);
              showToast(res.error);
              return;
            }
            setPostStatus("published");
            setDerivedStatus("scheduled");
            setSavedSlug(res.slug);
            setSlug(res.slug);
            setDirty(false);
            setSaveLabel("Scheduled");
            showToast("Scheduled");
            router.refresh();
          });
        },
      });
      return;
    }

    if (postStatus === "published") {
      openConfirm({
        title: "Update published post?",
        body: `Changes will go live immediately at /blog/${slug} and refresh the cache.`,
        confirmLabel: "Update",
        onConfirm: () => {
          startTransition(async () => {
            const res = await publishPostAction(initialPost.id, {
              mode: "now",
              patch: latestPayloadRef.current,
            });
            if (!res.ok) {
              if (res.field === "slug") setSlugError(res.error);
              showToast(res.error);
              return;
            }
            setPostStatus("published");
            setDerivedStatus("published");
            setSavedSlug(res.slug);
            setSlug(res.slug);
            setDirty(false);
            setSaveLabel("Published");
            showToast("Updated · cache refreshed");
            router.refresh();
          });
        },
      });
      return;
    }

    openConfirm({
      title: "Publish this post?",
      body: `It goes live now at /blog/${slug}, appears on /blog and in the RSS feed.`,
      confirmLabel: "Publish",
      onConfirm: () => {
        startTransition(async () => {
          const res = await publishPostAction(initialPost.id, {
            mode: "now",
            patch: latestPayloadRef.current,
          });
          if (!res.ok) {
            if (res.field === "slug") setSlugError(res.error);
            showToast(res.error);
            return;
          }
          setPostStatus("published");
          setDerivedStatus("published");
          setSavedSlug(res.slug);
          setSlug(res.slug);
          setDirty(false);
          setSaveLabel("Published");
          showToast("Published · cache refreshed");
          router.refresh();
        });
      },
    });
  }

  function handleDelete() {
    if (!canWrite) return;
    openConfirm({
      title: "Delete this post?",
      body: `This can't be undone. ${deletableMediaCount} image${deletableMediaCount === 1 ? "" : "s"} used only by this post will be deleted from Blob.`,
      confirmLabel: "Delete",
      danger: true,
      onConfirm: () => {
        startTransition(async () => {
          const res = await deletePostAction(initialPost.id);
          if (!res.ok) {
            showToast(res.error);
            return;
          }
          setDirty(false);
          router.push("/admin/blog");
          router.refresh();
        });
      },
    });
  }

  const checklist: { label: string; ok: boolean }[] = [
    { label: "Title", ok: title.trim().length >= 1 && title.trim().length <= 140 },
    { label: "Excerpt under 160 characters", ok: excerpt.trim().length >= 1 && excerpt.trim().length <= 160 },
    { label: "Cover image with alt text", ok: Boolean(cover?.url) && Boolean(cover?.alt.trim()) },
    { label: "Every image has alt text", ok: !hasBodyImageWithoutAlt(body) },
    { label: "At least one tag", ok: tags.length > 0 },
  ];
  const readyToPublish = checklist.every((c) => c.ok) && isValidSlug(slug);

  const primaryLabel =
    postStatus === "published"
      ? publishChoice === "draft"
        ? "Unpublish"
        : "Update"
      : publishChoice === "scheduled"
        ? "Schedule"
        : publishChoice === "published"
          ? "Publish now"
          : "Publish";

  const primaryDisabled =
    !canWrite ||
    pending ||
    saving ||
    (postStatus === "published" && publishChoice === "draft" ? false : !readyToPublish);

  return (
    <div>
      <div className="admin-ebar">
        <Link className="admin-btn sm" href="/admin/blog">
          ← Posts
        </Link>
        <span className={`saved${dirty ? " dirty" : ""}`}>
          <i aria-hidden="true" />
          <span>{canWrite ? saveLabel : "Read-only"}</span>
        </span>
        <Link
          className="admin-btn sm hide-s"
          href={`/admin/blog/${initialPost.id}/preview`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Preview ↗
        </Link>
        {canWrite && postStatus === "draft" ? (
          <button
            className="admin-btn sm"
            type="button"
            disabled={pending || saving}
            onClick={() => void runSaveDraft(true)}
          >
            Save draft
          </button>
        ) : null}
        {canWrite ? (
          <button
            className="admin-btn sm primary"
            type="button"
            disabled={primaryDisabled}
            onClick={handlePrimaryAction}
          >
            {primaryLabel}
          </button>
        ) : null}
      </div>

      {!blobConfigured ? (
        <div className="admin-alert" style={{ marginBottom: "16px" }}>
          Image uploads aren&apos;t configured. Set <code>BLOB_READ_WRITE_TOKEN</code> to enable Blob uploads.
        </div>
      ) : null}

      <div className="admin-egrid">
        <div>
          <textarea
            ref={titleRef}
            className="admin-titlein"
            rows={1}
            maxLength={140}
            placeholder="Post title"
            aria-label="Title"
            value={title}
            readOnly={!canWrite}
            onChange={(e) => handleTitleChange(e.target.value)}
            onBlur={() => {
              if (dirty && postStatus === "draft") void runSaveDraft(false);
            }}
          />

          <div className="admin-pane">
            <div className="admin-mdbar" role="toolbar" aria-label="Formatting">
              <button type="button" title="Heading" disabled={!canWrite} onClick={() => applyToolbar("h2")}>
                H2
              </button>
              <button type="button" title="Bold" disabled={!canWrite} onClick={() => applyToolbar("b")}>
                <b>B</b>
              </button>
              <button type="button" title="Italic" disabled={!canWrite} onClick={() => applyToolbar("i")}>
                <i>I</i>
              </button>
              <button type="button" title="Link" disabled={!canWrite} onClick={() => applyToolbar("a")}>
                Link
              </button>
              <span className="sep" aria-hidden="true" />
              <button type="button" title="Quote" disabled={!canWrite} onClick={() => applyToolbar("q")}>
                “ ”
              </button>
              <button type="button" title="List" disabled={!canWrite} onClick={() => applyToolbar("ul")}>
                •
              </button>
              <button type="button" title="Code block" disabled={!canWrite} onClick={() => applyToolbar("code")}>
                {"{ }"}
              </button>
              <button
                type="button"
                title={blobConfigured ? "Insert image" : "Image uploads aren't configured"}
                disabled={!canWrite || !blobConfigured}
                onClick={() => bodyFileRef.current?.click()}
              >
                Image
              </button>
              <input
                ref={bodyFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) void handleImageFiles(e.target.files, "body");
                  e.target.value = "";
                }}
              />

              <div className="admin-seg" role="group" aria-label="View">
                <button
                  type="button"
                  aria-pressed={viewMode === "w"}
                  onClick={() => setViewMode("w")}
                >
                  Write
                </button>
                <button
                  type="button"
                  className="sp-only"
                  aria-pressed={viewMode === "s"}
                  onClick={() => setViewMode("s")}
                >
                  Split
                </button>
                <button
                  type="button"
                  aria-pressed={viewMode === "p"}
                  onClick={() => setViewMode("p")}
                >
                  Preview
                </button>
              </div>
            </div>

            <div className={`admin-split ${viewMode}`}>
              <div
                className="admin-src"
                onDragOver={(e) => {
                  if (!canWrite || !blobConfigured) return;
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    setDragging(false);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  if (canWrite && blobConfigured && e.dataTransfer.files.length > 0) {
                    void handleImageFiles(e.dataTransfer.files, "body");
                  }
                }}
              >
                <textarea
                  ref={bodyRef}
                  aria-label="Post body (Markdown)"
                  spellCheck
                  readOnly={!canWrite}
                  value={body}
                  onChange={(e) => {
                    setBody(e.target.value);
                    markDirty();
                  }}
                  onBlur={() => {
                    if (dirty && postStatus === "draft") void runSaveDraft(false);
                  }}
                  onPaste={(e) => {
                    if (!canWrite || !blobConfigured) return;
                    const files = Array.from(e.clipboardData.files).filter((f) =>
                      f.type.startsWith("image/"),
                    );
                    if (files.length > 0) {
                      e.preventDefault();
                      void handleImageFiles(files, "body");
                    }
                  }}
                />
                <div className="admin-drop" hidden={!dragging}>
                  Drop images to upload
                </div>
              </div>

              <div className="admin-pv">
                <InkScope contained>
                  <div className="blog-prose">
                    <h1 className="pv-title">{title || "Untitled post"}</h1>
                    <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  </div>
                </InkScope>
              </div>
            </div>

            {uploads.length > 0 ? (
              <div className="admin-uploads">
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
            ) : null}

            <div className="admin-editor-hint">
              {blobConfigured
                ? "Markdown. Drop, paste or pick images: they upload to Vercel Blob and the link goes in at the cursor."
                : "Markdown. Image uploads aren't configured."}
            </div>
          </div>
        </div>

        <aside className="admin-eside">
          <section className="admin-card">
            <h2>Publishing</h2>
            <div className="admin-radio">
              <label>
                <input
                  type="radio"
                  name="pub-mode"
                  value="draft"
                  disabled={!canWrite}
                  checked={publishChoice === "draft"}
                  onChange={() => setPublishChoice("draft")}
                />
                Draft, only admins see it
              </label>
              <label>
                <input
                  type="radio"
                  name="pub-mode"
                  value="scheduled"
                  disabled={!canWrite}
                  checked={publishChoice === "scheduled"}
                  onChange={() => {
                    setPublishChoice("scheduled");
                    if (!scheduledLocal) {
                      setScheduledLocal(toLocalDateTimeInput(initialPost.publishedAt));
                    }
                  }}
                />
                Schedule for later
              </label>
              <label>
                <input
                  type="radio"
                  name="pub-mode"
                  value="published"
                  disabled={!canWrite}
                  checked={publishChoice === "published"}
                  onChange={() => setPublishChoice("published")}
                />
                Publish now
              </label>
            </div>

            {publishChoice === "scheduled" ? (
              <div className="admin-efield" style={{ marginTop: "4px" }}>
                <label htmlFor="pub-when">Goes live</label>
                <input
                  id="pub-when"
                  type="datetime-local"
                  disabled={!canWrite}
                  value={scheduledLocal}
                  onChange={(e) => setScheduledLocal(e.target.value)}
                />
              </div>
            ) : null}

            <ul className="admin-checklist" style={{ marginTop: "6px" }}>
              {checklist.map((item) => (
                <li key={item.label} className={item.ok ? "ok" : undefined}>
                  {item.label}
                </li>
              ))}
            </ul>
          </section>

          <section className="admin-card">
            <h2>Post details</h2>
            <div className="admin-efield">
              <label htmlFor="post-slug">URL</label>
              <div className="admin-slug-row">
                <span>/blog/</span>
                <input
                  id="post-slug"
                  maxLength={80}
                  readOnly={!canWrite}
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  onBlur={() => {
                    if (dirty && postStatus === "draft") void runSaveDraft(false);
                  }}
                />
              </div>
              {slugError ? (
                <span className="admin-hint danger">{slugError}</span>
              ) : null}
              {derivedStatus !== "draft" && slug !== savedSlug ? (
                <span className="admin-hint wait">
                  Changing the slug of a live post breaks old links.
                </span>
              ) : null}
            </div>

            <div className="admin-efield">
              <label htmlFor="post-excerpt">
                Excerpt
                <span className={excerpt.length > 160 ? "admin-hint danger" : undefined}>
                  {excerpt.length}/160
                </span>
              </label>
              <textarea
                id="post-excerpt"
                maxLength={200}
                readOnly={!canWrite}
                value={excerpt}
                onChange={(e) => {
                  setExcerpt(e.target.value);
                  markDirty();
                }}
                onBlur={() => {
                  if (dirty && postStatus === "draft") void runSaveDraft(false);
                }}
              />
            </div>

            <div className="admin-efield">
              <label htmlFor="post-tag-in">Tags</label>
              <div className="admin-tags-input">
                {tags.map((t, i) => (
                  <span key={t} className="chip">
                    {t}
                    {canWrite ? (
                      <button
                        type="button"
                        aria-label={`Remove ${t}`}
                        onClick={() => {
                          setTags(tags.filter((_, idx) => idx !== i));
                          markDirty();
                        }}
                      >
                        ×
                      </button>
                    ) : null}
                  </span>
                ))}
                {canWrite && tags.length < 5 ? (
                  <input
                    id="post-tag-in"
                    list="blog-tag-list"
                    placeholder="Add tag"
                    aria-label="Add tag"
                    maxLength={24}
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addTag(tagDraft);
                      }
                    }}
                    onBlur={() => {
                      if (tagDraft.trim()) addTag(tagDraft);
                    }}
                  />
                ) : null}
              </div>
              <datalist id="blog-tag-list">
                {existingTags.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          </section>

          <section className="admin-card">
            <h2>Cover image</h2>
            <div
              className="admin-cover-box"
              role="button"
              tabIndex={0}
              aria-label="Choose cover image"
              onClick={() => {
                if (canWrite && blobConfigured) coverFileRef.current?.click();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canWrite && blobConfigured) {
                  coverFileRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                if (canWrite && blobConfigured) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (canWrite && blobConfigured && e.dataTransfer.files.length > 0) {
                  void handleImageFiles(e.dataTransfer.files, "cover");
                }
              }}
            >
              {cover ? (
                <>
                  <Image src={cover.url} alt="" fill sizes="320px" />
                  {canWrite ? (
                    <button
                      type="button"
                      className="admin-btn sm rm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCover(null);
                        markDirty();
                      }}
                    >
                      Remove
                    </button>
                  ) : null}
                </>
              ) : (
                <span>
                  {blobConfigured
                    ? "Drop a cover image or click to choose\n16:9, at least 1600px wide"
                    : "Image uploads aren't configured"}
                </span>
              )}
            </div>
            <input
              ref={coverFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              hidden
              onChange={(e) => {
                if (e.target.files) void handleImageFiles(e.target.files, "cover");
                e.target.value = "";
              }}
            />

            <div className="admin-efield">
              <label htmlFor="cover-alt">
                Alt text <span>required</span>
              </label>
              <input
                id="cover-alt"
                maxLength={300}
                readOnly={!canWrite}
                value={cover?.alt ?? ""}
                placeholder={cover ? "Describe the cover image" : "Upload a cover image first"}
                disabled={!cover}
                onChange={(e) => {
                  if (!cover) return;
                  setCover({ ...cover, alt: e.target.value });
                  markDirty();
                }}
                onBlur={() => {
                  if (dirty && postStatus === "draft") void runSaveDraft(false);
                }}
              />
            </div>
          </section>

          <section className="admin-card">
            <h2>Search preview</h2>
            <div className="admin-serp">
              <div className="u">carlsdaleescalo.com › blog › {slug}</div>
              <div className="t">{(title || "Untitled").slice(0, 60)}</div>
              <div className="d">
                {excerpt.slice(0, 160) ||
                  "Add an excerpt so search results don't pick a random sentence."}
              </div>
            </div>
          </section>

          {canWrite ? (
            <section className="admin-card">
              <h2>Danger zone</h2>
              <p className="admin-auth-sub sm">
                Deleting removes the post and any images only it uses.
              </p>
              <div>
                <button
                  type="button"
                  className="admin-btn sm danger"
                  disabled={pending}
                  onClick={handleDelete}
                >
                  Delete post
                </button>
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      <dialog ref={dialogRef} className="admin-dialog" aria-labelledby="editor-dlg-title">
        <div className="admin-stack">
          <h2 id="editor-dlg-title" style={{ margin: 0 }}>
            {dialogState?.title}
          </h2>
          <p className="admin-auth-sub">{dialogState?.body}</p>
          <div className="admin-row-actions" style={{ justifyContent: "flex-end" }}>
            <button
              type="button"
              className="admin-btn sm"
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`admin-btn sm ${dialogState?.danger ? "danger" : "primary"}`}
              disabled={pending}
              onClick={() => {
                dialogRef.current?.close();
                dialogState?.onConfirm();
              }}
            >
              {dialogState?.confirmLabel}
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
