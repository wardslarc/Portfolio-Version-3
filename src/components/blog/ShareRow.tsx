"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { formatCompactCount } from "@/lib/blog/format";
import { useEngagement } from "./EngagementProvider";

const subscribeNoop = () => () => {};
const getCanNativeShare = () =>
  typeof navigator !== "undefined" && typeof navigator.share === "function";
const getCanNativeShareServer = () => false;

export default function ShareRow({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const canNativeShare = useSyncExternalStore(
    subscribeNoop,
    getCanNativeShare,
    getCanNativeShareServer,
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const engagement = useEngagement();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleCopy() {
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1800);
    engagement?.recordShare("copy");
  }

  async function handleNativeShare() {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") return;
    try {
      await navigator.share({ title, url });
      engagement?.recordShare("native");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    }
  }

  const xUrl = `https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  const sharesCount =
    engagement?.status === "ready" &&
    engagement.data &&
    !engagement.data.hidden &&
    engagement.data.shares !== null &&
    engagement.data.shares > 0
      ? engagement.data.shares
      : null;

  return (
    <div className="blog-share">
      <span className="blog-share-label">Share</span>
      <button
        type="button"
        className="k-pill k-lift blog-copy-btn"
        onClick={handleCopy}
      >
        {copied ? "Link copied" : "Copy link"}
        {copied ? (
          <span className="k-note blog-copied" aria-live="polite">
            copied!
          </span>
        ) : null}
      </button>
      <a
        className="k-pill k-lift"
        href={xUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => engagement?.recordShare("x")}
      >
        Post on X
      </a>
      <a
        className="k-pill k-lift"
        href={linkedInUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => engagement?.recordShare("linkedin")}
      >
        LinkedIn
      </a>
      {canNativeShare ? (
        <button type="button" className="k-pill k-lift" onClick={() => void handleNativeShare()}>
          Share…
        </button>
      ) : null}
      {sharesCount !== null ? (
        <span className="blog-share-count">
          Shared {formatCompactCount(sharesCount)} {sharesCount === 1 ? "time" : "times"}
        </span>
      ) : null}
    </div>
  );
}
