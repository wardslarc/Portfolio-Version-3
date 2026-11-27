import type { MetadataRoute } from "next";
import { site } from "@/content/site";
import { getLivePostSlugs } from "@/lib/blog/public";

// Bump when the page content changes meaningfully, so crawlers know to revisit.
const lastModified = new Date("2026-11-26");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getLivePostSlugs();
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
    ...posts.map((post) => ({
      url: `${site.url}/blog/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
