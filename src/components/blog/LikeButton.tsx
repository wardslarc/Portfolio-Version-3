"use client";

import { formatCompactCount } from "@/lib/blog/format";
import { useEngagement } from "./EngagementProvider";

export default function LikeButton() {
  const ctx = useEngagement();
  if (!ctx || ctx.status !== "ready" || !ctx.data) {
    return null;
  }

  const { data, likeError, setLiked } = ctx;
  const { liked, hidden, likes } = data;

  return (
    <div className="blog-like-wrap">
      <button
        type="button"
        className={`blog-btn sm blog-like${liked ? " liked" : ""}`}
        aria-pressed={liked}
        aria-label={liked ? "Unlike this post" : "Like this post"}
        onClick={() => void setLiked(!liked)}
      >
        <svg
          className="blog-like-heart"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          aria-hidden="true"
        >
          <path
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            fill={liked ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
        {!hidden && likes !== null ? (
          <span>{formatCompactCount(likes)}</span>
        ) : (
          <span>{liked ? "Liked" : "Like"}</span>
        )}
      </button>
      {likeError ? (
        <span className="blog-like-msg" role="status">
          {likeError}
        </span>
      ) : null}
    </div>
  );
}
