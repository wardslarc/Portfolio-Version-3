import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { site } from "@/content/site";
import { getAllTags, getLivePosts } from "@/lib/blog/public";

export const metadata: Metadata = {
  title: `Blog | ${site.name}`,
  description:
    "Write-ups on the systems behind this site and the tools I build at work: what I tried, what broke, what I'd do again.",
  alternates: {
    canonical: "/blog",
    types: {
      "application/rss+xml": "/blog/rss.xml",
    },
  },
};

function formatPostDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildBlogUrl(params: { tag?: string; page?: number }): string {
  const sp = new URLSearchParams();
  if (params.tag) sp.set("tag", params.tag);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/blog?${qs}` : "/blog";
}

async function BlogIndexContent({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const activeTag = sp.tag?.trim() || "";
  const parsedPage = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [tags, result] = await Promise.all([
    getAllTags(),
    getLivePosts({ tag: activeTag || undefined, page: parsedPage }),
  ]);

  const { items, total, page, totalPages } = result;
  const showFeatured = page === 1 && items.length > 0;
  const featured = showFeatured ? items[0]! : null;
  const listItems = showFeatured ? items.slice(1) : items;

  return (
    <>
      {tags.length > 0 ? (
        <nav className="blog-filters" aria-label="Filter by tag">
          <Link
            href="/blog"
            className="blog-fchip"
            aria-current={!activeTag ? "page" : undefined}
          >
            All
          </Link>
          {tags.map((tag) => {
            const selected = activeTag.toLowerCase() === tag.toLowerCase();
            return (
              <Link
                key={tag}
                href={buildBlogUrl({ tag })}
                className="blog-fchip"
                aria-current={selected ? "page" : undefined}
              >
                {tag}
              </Link>
            );
          })}
        </nav>
      ) : null}

      {items.length === 0 ? (
        <div className="blog-empty">No posts yet.</div>
      ) : (
        <>
          {featured ? (
            <Link className="blog-feat" href={`/blog/${featured.slug}`}>
              {featured.cover ? (
                <div className="im">
                  <Image
                    src={featured.cover.url}
                    alt={featured.cover.alt || featured.title}
                    width={featured.cover.width || 1600}
                    height={featured.cover.height || 800}
                    priority
                    sizes="(max-width: 728px) calc(100vw - 48px), 680px"
                  />
                </div>
              ) : null}
              <div>
                <p className="blog-meta">
                  <span>{formatPostDate(featured.publishedAt)}</span>
                  <span>{featured.readingMinutes} min read</span>
                  {featured.tags.length > 0 ? (
                    <span className="blog-tagl">{featured.tags.join(" · ")}</span>
                  ) : null}
                </p>
                <h2>{featured.title}</h2>
                {featured.excerpt ? <p className="blog-excerpt">{featured.excerpt}</p> : null}
              </div>
            </Link>
          ) : null}

          {listItems.length > 0 ? (
            <ul className="blog-plist">
              {listItems.map((post) => (
                <li key={post.id}>
                  <Link className="blog-pitem" href={`/blog/${post.slug}`}>
                    <div>
                      <p className="blog-meta">
                        <span>{formatPostDate(post.publishedAt)}</span>
                        <span>{post.readingMinutes} min read</span>
                      </p>
                      <h3>{post.title}</h3>
                      {post.excerpt ? <p className="blog-excerpt">{post.excerpt}</p> : null}
                      {post.tags.length > 0 ? (
                        <span className="blog-tagl">{post.tags.join(" · ")}</span>
                      ) : null}
                    </div>
                    {post.cover ? (
                      <div className="im">
                        <Image
                          src={post.cover.url}
                          alt={post.cover.alt || post.title}
                          width={post.cover.width || 800}
                          height={post.cover.height || 600}
                          sizes="(max-width: 760px) 96px, 132px"
                        />
                      </div>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="blog-pager">
            <span>
              {total} {total === 1 ? "post" : "posts"}
              {totalPages > 1 ? ` · Page ${page} of ${totalPages}` : ""}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              {page > 1 ? (
                <Link
                  className="blog-btn sm"
                  href={buildBlogUrl({ tag: activeTag || undefined, page: page - 1 })}
                >
                  ← Newer posts
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link
                  className="blog-btn sm"
                  href={buildBlogUrl({ tag: activeTag || undefined, page: page + 1 })}
                >
                  Older posts →
                </Link>
              ) : null}
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; page?: string }>;
}) {
  return (
    <>
      <section className="blog-hero">
        <p className="section-label" style={{ marginBottom: "16px" }}>
          Blog
        </p>
        <h1>Notes from building things</h1>
        <p>
          Write-ups on the systems behind this site and the tools I build at work: what I tried,
          what broke, what I&apos;d do again.
        </p>
      </section>

      <Suspense fallback={<div className="blog-empty">Loading posts…</div>}>
        <BlogIndexContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
