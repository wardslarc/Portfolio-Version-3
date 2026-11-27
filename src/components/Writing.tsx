import Link from "next/link";
import { formatEngagementMeta } from "@/lib/blog/format";
import { getLatestPosts } from "@/lib/blog/public";

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function Writing() {
  const posts = await getLatestPosts(3);
  if (posts.length === 0) return null;

  return (
    <section id="blog" aria-labelledby="writing-h">
      <h2 className="section-label" id="writing-h">
        Writing
      </h2>
      <ul className="writing-list">
        {posts.map((post) => {
          const stats = formatEngagementMeta(post);
          return (
            <li key={post.id}>
              <Link className="writing-row" href={`/blog/${post.slug}`}>
                <span className="writing-date">{formatShortDate(post.publishedAt)}</span>
                <span className="writing-title">{post.title}</span>
                <span className="writing-mins">
                  {post.readingMinutes} min read{stats ? ` · ${stats}` : ""}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link className="writing-all" href="/blog">
        All posts →
      </Link>
    </section>
  );
}
