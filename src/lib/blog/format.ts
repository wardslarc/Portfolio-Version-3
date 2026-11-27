const compactFormatter = new Intl.NumberFormat("en", { notation: "compact" });

export function formatCompactCount(count: number): string {
  return compactFormatter.format(count);
}

export function formatEngagementMeta(post: {
  views: number;
  likes: number;
  hideStats: boolean;
}): string | null {
  if (post.hideStats) return null;
  const parts: string[] = [];
  if (post.views > 0) {
    parts.push(`${formatCompactCount(post.views)} ${post.views === 1 ? "view" : "views"}`);
  }
  if (post.likes > 0) {
    parts.push(`${formatCompactCount(post.likes)} ${post.likes === 1 ? "like" : "likes"}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
