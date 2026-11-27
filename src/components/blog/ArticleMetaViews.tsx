"use client";

import { formatCompactCount } from "@/lib/blog/format";
import { useEngagement } from "./EngagementProvider";

export default function ArticleMetaViews() {
  const ctx = useEngagement();
  if (!ctx || ctx.status !== "ready" || !ctx.data || ctx.data.hidden || ctx.data.views === null) {
    return null;
  }

  const views = ctx.data.views;
  return <span>{views === 1 ? "1 view" : `${formatCompactCount(views)} views`}</span>;
}
