import Image from "next/image";
import Link from "next/link";
import { ViewTransition, type CSSProperties } from "react";
import { site } from "@/content/site";
import type { TocItem } from "@/lib/blog/markdown";
import type { PostCover } from "@/lib/blog/posts";
import { tagToSlug } from "@/lib/blog/slug";
import ArticleMetaViews from "./ArticleMetaViews";
import Breadcrumbs from "./Breadcrumbs";
import CodeCopy from "./CodeCopy";
import LikeButton from "./LikeButton";
import ShareRow from "./ShareRow";
import Toc from "./Toc";

const STICKER_ROTS = ["-1.5deg", "1deg", "-0.5deg", "1.5deg"];
const STICKER_R0S = ["10deg", "-8deg", "12deg", "-10deg"];

export interface ArticleDisplayPost {
  title: string;
  slug: string;
  excerpt: string;
  cover: PostCover | null;
  tags: string[];
  publishedAt: string | null;
  readingMinutes: number;
  authorName: string;
}

export interface AdjacentPostLink {
  slug: string;
  title: string;
}

export interface RelatedPostItem {
  title: string;
  slug: string;
  excerpt: string;
  publishedAt: string;
  readingMinutes: number;
  cover: PostCover | null;
}

function formatArticleDate(iso: string | null): string {
  if (!iso) return "Unpublished draft";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ArticleView({
  post,
  html,
  toc,
  backHref,
  backLabel,
  prev,
  next,
  related = [],
  showShare = true,
}: {
  post: ArticleDisplayPost;
  html: string;
  toc: TocItem[];
  backHref?: string;
  backLabel?: string;
  prev?: AdjacentPostLink | null;
  next?: AdjacentPostLink | null;
  related?: RelatedPostItem[];
  showShare?: boolean;
}) {
  const bodyId = `article-body-${post.slug || "preview"}`;
  const canonicalUrl = `${site.url}/blog/${post.slug}`;

  return (
    <>
      <article className="blog-art k-grid">
        <div className="k-wrap">
          {backHref && backLabel ? (
            <Link className="blog-crumb k-in-fade" href={backHref} style={{ animationDelay: "0.05s" }}>
              {backLabel}
            </Link>
          ) : (
            <Breadcrumbs
              items={[
                { label: "Home", href: "/" },
                { label: "Blog", href: "/blog" },
                { label: post.title || "Untitled post" },
              ]}
            />
          )}

          <p className="blog-meta blog-art-meta k-in-fade" style={{ animationDelay: "0.1s" }}>
            <span>{formatArticleDate(post.publishedAt)}</span>
            <span>{post.readingMinutes} min read</span>
            <ArticleMetaViews />
          </p>

          <h1 className="blog-art-h1">
            <span className="k-ln">
              <span className="k-in-line" style={{ animationDelay: "0.15s" }}>
                {post.title || "Untitled post"}
              </span>
            </span>
          </h1>
          {post.excerpt ? (
            <p className="blog-lede k-in-up" style={{ animationDelay: "0.45s" }}>
              {post.excerpt}
            </p>
          ) : null}

          {post.tags.length > 0 ? (
            <div className="blog-art-tags">
              {post.tags.map((tag, i) => (
                <Link
                  key={`${tag}-${i}`}
                  href={`/blog/tag/${tagToSlug(tag)}`}
                  className="blog-fchip k-lift k-in-drop"
                  style={
                    {
                      "--rot": STICKER_ROTS[i % STICKER_ROTS.length],
                      "--r0": STICKER_R0S[i % STICKER_R0S.length],
                      animationDelay: `${(0.6 + i * 0.08).toFixed(2)}s`,
                    } as CSSProperties
                  }
                >
                  {tag}
                </Link>
              ))}
            </div>
          ) : null}

          <div className="blog-author k-in-up" style={{ animationDelay: "0.8s" }}>
            <Image
              className="blog-av"
              src={site.photo}
              alt={post.authorName || site.name}
              width={48}
              height={48}
            />
            <div>
              <b>{post.authorName || site.name}</b>
              <span>{site.role}</span>
            </div>
            <span
              className="k-note blog-author-note k-in-write"
              style={{ animationDelay: "1.3s" }}
              aria-hidden="true"
            >
              ← that&apos;s me
            </span>
          </div>
        </div>
      </article>

      <div className="k-wrap">
        {post.cover ? (
          <figure
            className="blog-cov k-card k-in-drop"
            style={{ "--r0": "4deg", animationDelay: "0.35s" } as CSSProperties}
          >
            <span
              className="k-tape blog-cov-tape-l k-in-slap"
              style={{ animationDelay: "1s" }}
              aria-hidden="true"
            />
            <span
              className="k-tape blog-cov-tape-r k-in-slap"
              style={{ animationDelay: "1.12s" }}
              aria-hidden="true"
            />
            <ViewTransition name={`cover-${post.slug || "preview"}`} share="morph" default="none">
              <div className="blog-cov-frame">
                <Image
                  className="k-sc-para"
                  src={post.cover.url}
                  alt={post.cover.alt || post.title}
                  width={post.cover.width || 1600}
                  height={post.cover.height || 900}
                  priority
                  sizes="(max-width: 759px) calc(100vw - 56px), 952px"
                />
              </div>
            </ViewTransition>
          </figure>
        ) : null}

        <div className="blog-awrap">
          <Toc items={toc} />
          <div className="blog-main-col">
            <div
              id={bodyId}
              className="blog-prose"
              // Server-sanitized HTML via rehype-sanitize.
              dangerouslySetInnerHTML={{ __html: html }}
            />
            <CodeCopy containerId={bodyId} />

            {showShare || prev || next || related.length > 0 ? (
              <div className="blog-aend">
                {showShare ? (
                  <>
                    <div className="blog-react k-sc-up">
                      <span className="k-note blog-react-note" aria-hidden="true">
                        liked it?
                      </span>
                      <LikeButton />
                      <ShareRow url={canonicalUrl} title={post.title} />
                    </div>
                    <aside className="blog-bio k-card k-sc-settle" aria-label="About the author">
                      <span className="k-tape blog-bio-tape k-sc-slap" aria-hidden="true" />
                      <Image
                        className="blog-av blog-bio-av"
                        src={site.photo}
                        alt={site.name}
                        width={64}
                        height={64}
                      />
                      <div className="blog-bio-copy">
                        <div className="k-note blog-bio-title">written by Carls</div>
                        <p>{site.role}</p>
                      </div>
                      <Link className="k-pill k-lift blog-bio-cta" href="/#contact">
                        Let&apos;s talk <span aria-hidden="true">→</span>
                      </Link>
                    </aside>
                  </>
                ) : null}
                {prev || next ? (
                  <div className="blog-nextprev">
                    {prev ? (
                      <Link className="blog-np k-card k-sc-settle" href={`/blog/${prev.slug}`}>
                        <small>← Previous</small>
                        <b>{prev.title}</b>
                      </Link>
                    ) : (
                      <div />
                    )}
                    {next ? (
                      <Link className="blog-np n k-card k-sc-settle k-s2" href={`/blog/${next.slug}`}>
                        <small>Next →</small>
                        <b>{next.title}</b>
                      </Link>
                    ) : (
                      <div />
                    )}
                  </div>
                ) : null}
                {related.length > 0 ? (
                  <section className="blog-related" aria-labelledby="keep-reading-heading">
                    <div className="k-sec-label k-sc-up">
                      <h2 id="keep-reading-heading" className="k-kicker">
                        Keep reading
                      </h2>
                    </div>
                    <div className="blog-related-grid">
                      {related.slice(0, 3).map((item, idx) => (
                        <Link
                          key={item.slug}
                          className={`blog-rcard k-card k-sc-settle${idx === 1 ? " k-s2" : idx === 2 ? " k-s3" : ""}`}
                          href={`/blog/${item.slug}`}
                        >
                          <p className="blog-meta">
                            <span>{formatArticleDate(item.publishedAt)}</span>
                            <span>{item.readingMinutes} min read</span>
                          </p>
                          <h3>{item.title}</h3>
                          {item.excerpt ? <p className="blog-rexcerpt">{item.excerpt}</p> : null}
                        </Link>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
