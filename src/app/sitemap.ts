import type { MetadataRoute } from "next";
import { site } from "@/content/site";

// Bump when the page content changes meaningfully, so crawlers know to revisit.
const lastModified = new Date("2026-11-26");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: site.url,
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
      images: [`${site.url}${site.photo}`],
    },
    { url: `${site.url}${site.resume}`, lastModified, changeFrequency: "monthly", priority: 0.6 },
  ];
}
