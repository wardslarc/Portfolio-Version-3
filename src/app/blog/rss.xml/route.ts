import { site } from "@/content/site";
import { getRecentLivePostsForRss } from "@/lib/blog/public";

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (ch) => {
    switch (ch) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return ch;
    }
  });
}

export async function GET(): Promise<Response> {
  const posts = await getRecentLivePostsForRss(20);
  const feedUrl = `${site.url}/blog/rss.xml`;
  const blogUrl = `${site.url}/blog`;
  const lastBuild = posts[0]?.publishedAt ? new Date(posts[0].publishedAt).toUTCString() : new Date(0).toUTCString();

  const itemsXml = posts
    .map((post) => {
      const link = `${site.url}/blog/${post.slug}`;
      const pubDate = new Date(post.publishedAt).toUTCString();
      const categories = post.tags
        .map((t) => `<category>${escapeXml(t)}</category>`)
        .join("");

      return [
        "    <item>",
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <pubDate>${escapeXml(pubDate)}</pubDate>`,
        `      <description>${escapeXml(post.excerpt)}</description>`,
        categories ? `      ${categories}` : "",
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(`${site.name} — Blog`)}</title>`,
    `    <link>${escapeXml(blogUrl)}</link>`,
    `    <description>${escapeXml("Write-ups on the systems behind this site and the tools I build at work.")}</description>`,
    "    <language>en-us</language>",
    `    <lastBuildDate>${escapeXml(lastBuild)}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
    itemsXml,
    "  </channel>",
    "</rss>",
  ]
    .filter(Boolean)
    .join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
