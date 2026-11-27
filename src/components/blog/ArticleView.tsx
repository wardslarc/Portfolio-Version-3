import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
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
      <article className="blog-art">
        {backHref && backLabel ? (
          <Link className="blog-crumb" href={backHref}>
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

        <p className="blog-meta">
          <span>{formatArticleDate(post.publishedAt)}</span>
          <span>{post.readingMinutes} min read</span>
          <ArticleMetaViews />
          {post.tags.length > 0 ? (
            <span className="blog-tagl">
              {post.tags.map((tag, i) => (
                <Fragment key={`${tag}-${i}`}>
                  {i > 0 ? " · " : null}
                  <Link href={`/blog/tag/${tagToSlug(tag)}`}>{tag}</Link>
                </Fragment>
              ))}
            </span>
          ) : null}
        </p>

        <h1>{post.title || "Untitled post"}</h1>
        {post.excerpt ? <p className="blog-lede">{post.excerpt}</p> : null}

        <div className="blog-author">
          <Image
            className="blog-av"
            src={site.photo}
            alt={post.authorName || site.name}
            width={44}
            height={44}
          />
          <span>
            <b>{post.authorName || site.name}</b>
            {site.role}
          </span>
        </div>

        {post.cover ? (
          <figure className="blog-cov">
            <Image
              src={post.cover.url}
              alt={post.cover.alt || post.title}
              width={post.cover.width || 1600}
              height={post.cover.height || 900}
              priority
              sizes="(max-width: 728px) calc(100vw - 48px), 680px"
            />
          </figure>
        ) : null}
      </article>

      <div className="blog-awrap">
        <Toc items={toc} />
        <div
          id={bodyId}
          className="blog-prose"
          // Server-sanitized HTML via rehype-sanitize.
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <CodeCopy containerId={bodyId} />
      </div>

      {showShare || prev || next || related.length > 0 ? (
        <div className="blog-aend">
          {showShare ? (
            <>
              <LikeButton />
              <ShareRow url={canonicalUrl} title={post.title} />
            </>
          ) : null}
          {prev || next ? (
            <div className="blog-nextprev">
              {prev ? (
                <Link className="blog-np" href={`/blog/${prev.slug}`}>
                  <small>← Previous</small>
                  <b>{prev.title}</b>
                </Link>
              ) : (
                <div />
              )}
              {next ? (
                <Link className="blog-np n" href={`/blog/${next.slug}`}>
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
              <h2 id="keep-reading-heading" className="section-label">
                Keep reading
              </h2>
              <div className="blog-related-grid">
                {related.slice(0, 3).map((item) => (
                  <article key={item.slug} className="blog-rcard">
                    <p className="blog-meta">
                      <span>
                        {formatArticleDate(item.publishedAt)} · {item.readingMinutes} min read
                      </span>
                    </p>
                    <h3>
                      <Link href={`/blog/${item.slug}`}>{item.title}</Link>
                    </h3>
                    {item.excerpt ? <p className="blog-rexcerpt">{item.excerpt}</p> : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
