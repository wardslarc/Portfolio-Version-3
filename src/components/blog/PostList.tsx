import Image from "next/image";
import Link from "next/link";
import type { PublicPostSummary, TagIndexEntry } from "@/lib/blog/public";

function formatPostDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildPageHref(basePath: string, page: number): string {
  return page > 1 ? `${basePath}?page=${page}` : basePath;
}

export default function PostList({
  tags,
  activeTagSlug,
  items,
  total,
  page,
  totalPages,
  basePath,
  showFeatured = false,
}: {
  tags: TagIndexEntry[];
  activeTagSlug?: string;
  items: PublicPostSummary[];
  total: number;
  page: number;
  totalPages: number;
  basePath: string;
  showFeatured?: boolean;
}) {
  const renderFeatured = showFeatured && page === 1 && items.length > 0;
  const featured = renderFeatured ? items[0]! : null;
  const listItems = renderFeatured ? items.slice(1) : items;

  return (
    <>
      {tags.length > 0 ? (
        <nav className="blog-filters" aria-label="Filter by tag">
          <Link
            href="/blog"
            className="blog-fchip"
            aria-current={!activeTagSlug ? "page" : undefined}
          >
            All
          </Link>
          {tags.map((tag) => (
            <Link
              key={tag.slug}
              href={`/blog/tag/${tag.slug}`}
              className="blog-fchip"
              aria-current={activeTagSlug === tag.slug ? "page" : undefined}
            >
              {tag.name}
            </Link>
          ))}
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
                <Link className="blog-btn sm" href={buildPageHref(basePath, page - 1)}>
                  ← Newer posts
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link className="blog-btn sm" href={buildPageHref(basePath, page + 1)}>
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
