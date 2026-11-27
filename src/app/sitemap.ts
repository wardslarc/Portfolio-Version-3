import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { site } from "@/content/site";
import { getLivePostSlugs, getTagIndex } from "@/lib/blog/public";

// Bump when the homepage content changes meaningfully, so crawlers know to revisit.
const lastModified = new Date("2026-11-26");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Render per request. A build-time sitemap went stale: it missed posts published after
  // the deploy. The post list itself is still cached and refreshed by updateTag("posts").
  await connection();
  const [posts, tags] = await Promise.all([getLivePostSlugs(), getTagIndex()]);
  const latestPostDate = posts[0]?.updatedAt ?? lastModified;

  return [
    {
      url: site.url,
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
      images: [`${site.url}${site.photo}`],
    },
    { url: `${site.url}${site.resume}`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    {
      url: `${site.url}/blog`,
      lastModified: latestPostDate,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...tags.map((tag) => ({
      url: `${site.url}/blog/tag/${tag.slug}`,
      lastModified: tag.latestUpdatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...posts.map((post) => ({
      url: `${site.url}/blog/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
      images: [post.coverUrl ?? `${site.url}/blog/${post.slug}/opengraph-image`],
    })),
  ];
}
