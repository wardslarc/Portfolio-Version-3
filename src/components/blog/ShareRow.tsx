"use client";

import { useRef, useState } from "react";

export default function ShareRow({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleCopy() {
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1800);
  }

  const xUrl = `https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  return (
    <div className="blog-share">
      <span>Share</span>
      <button type="button" className="blog-btn sm" onClick={handleCopy}>
        {copied ? "Link copied" : "Copy link"}
      </button>
      <a className="blog-btn sm" href={xUrl} target="_blank" rel="noopener noreferrer">
        Post on X
      </a>
      <a className="blog-btn sm" href={linkedInUrl} target="_blank" rel="noopener noreferrer">
        LinkedIn
      </a>
    </div>
  );
}
