import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { formatEngagementMeta } from "@/lib/blog/format";
import type { PublicPostSummary, TagIndexEntry } from "@/lib/blog/public";

const STICKER_ROTS = ["-1.5deg", "1deg", "-0.5deg", "1.5deg"];
const CARD_ROTS = ["-1.2deg", "0.8deg", "-0.6deg"];

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
        <div className="k-wrap">
          <nav className="blog-filters" aria-label="Filter by tag">
            <Link
              href="/blog"
              className="blog-fchip k-lift"
              aria-current={!activeTagSlug ? "page" : undefined}
              style={{ "--rot": STICKER_ROTS[0] } as CSSProperties}
            >
              All
            </Link>
            {tags.map((tag, idx) => (
              <Link
                key={tag.slug}
                href={`/blog/tag/${tag.slug}`}
                className="blog-fchip k-lift"
                aria-current={activeTagSlug === tag.slug ? "page" : undefined}
                style={{ "--rot": STICKER_ROTS[(idx + 1) % STICKER_ROTS.length] } as CSSProperties}
              >
                {tag.name}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="k-wrap">
          <div className="blog-empty">
            <p>No posts yet.</p>
            <span className="k-note blog-empty-note" aria-hidden="true">
              more notes on the way ✎
            </span>
          </div>
        </div>
      ) : (
        <>
          {featured ? (
            <section className="k-wrap blog-section" aria-labelledby="latest-h">
              <div className="k-sec-label">
                <span className="k-kicker" id="latest-h">
                  Latest
                </span>
              </div>
              <Link
                className={`blog-feat k-card${featured.cover ? "" : " no-cover"}`}
                href={`/blog/${featured.slug}`}
              >
                <span className="k-tape blog-feat-tape" aria-hidden="true" />
                <span className="k-note k-note-chip blog-feat-note" aria-hidden="true">
                  fresh off the press!
                </span>
                {featured.cover ? (
                  <div className="im">
                    <Image
                      src={featured.cover.url}
                      alt={featured.cover.alt || featured.title}
                      width={featured.cover.width || 1600}
                      height={featured.cover.height || 800}
                      priority
                      sizes="(max-width: 759px) calc(100vw - 72px), 640px"
                    />
                  </div>
                ) : null}
                <div>
                  <p className="blog-meta">
                    <span>{formatPostDate(featured.publishedAt)}</span>
                    <span>{featured.readingMinutes} min read</span>
                    {formatEngagementMeta(featured) ? (
                      <span>{formatEngagementMeta(featured)}</span>
                    ) : null}
                  </p>
                  <h2>{featured.title}</h2>
                  {featured.excerpt ? <p className="blog-excerpt">{featured.excerpt}</p> : null}
                  {featured.tags.length > 0 ? (
                    <div className="blog-tagl">
                      {featured.tags.map((t) => (
                        <span key={t}>#{t}</span>
                      ))}
                    </div>
                  ) : null}
                  <span className="k-pill k-lift blog-read">
                    Read it <span aria-hidden="true">→</span>
                  </span>
                </div>
              </Link>
            </section>
          ) : null}

          {listItems.length > 0 ? (
            <section
              className="k-wrap blog-section-cards"
              aria-labelledby={renderFeatured ? "older-h" : undefined}
            >
              {renderFeatured ? (
                <div className="k-sec-label">
                  <span className="k-kicker" id="older-h">
                    Older notes
                  </span>
                </div>
              ) : null}
              <ul className="blog-plist">
                {listItems.map((post, idx) => (
                  <li key={post.id}>
                    <Link
                      className="blog-pitem k-card"
                      href={`/blog/${post.slug}`}
                      style={{ "--rot": CARD_ROTS[idx % CARD_ROTS.length] } as CSSProperties}
                    >
                      {idx % 2 === 0 ? (
                        <span
                          className={`k-tape ${idx % 4 === 0 ? "blog-pitem-tape-r" : "blog-pitem-tape-l"}`}
                          aria-hidden="true"
                        />
                      ) : null}
                      {post.cover ? (
                        <div className="im">
                          <Image
                            src={post.cover.url}
                            alt={post.cover.alt || post.title}
                            width={post.cover.width || 800}
                            height={post.cover.height || 600}
                            sizes="(max-width: 759px) calc(100vw - 80px), (max-width: 1023px) calc(50vw - 80px), 360px"
                          />
                        </div>
                      ) : null}
                      <p className="blog-meta">
                        <span>{formatPostDate(post.publishedAt)}</span>
                        <span>{post.readingMinutes} min read</span>
                        {formatEngagementMeta(post) ? (
                          <span>{formatEngagementMeta(post)}</span>
                        ) : null}
                      </p>
                      <h3>{post.title}</h3>
                      {post.excerpt ? <p className="blog-excerpt">{post.excerpt}</p> : null}
                      {post.tags.length > 0 ? (
                        <div className="blog-tagl">
                          {post.tags.map((t) => (
                            <span key={t}>#{t}</span>
                          ))}
                        </div>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="k-wrap">
            <div className="blog-pager">
              <span>
                {total} {total === 1 ? "post" : "posts"}
                {totalPages > 1 ? ` · Page ${page} of ${totalPages}` : ""}
              </span>
              <div className="blog-pager-actions">
                {page > 1 ? (
                  <Link className="k-pill k-lift" href={buildPageHref(basePath, page - 1)}>
                    ← Newer posts
                  </Link>
                ) : null}
                {page < totalPages ? (
                  <Link className="k-pill k-lift" href={buildPageHref(basePath, page + 1)}>
                    Older posts →
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
