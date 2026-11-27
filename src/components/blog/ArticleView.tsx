import Image from "next/image";
import Link from "next/link";
import { site } from "@/content/site";
import type { TocItem } from "@/lib/blog/markdown";
import type { PostCover } from "@/lib/blog/posts";
import CodeCopy from "./CodeCopy";
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
  backHref = "/blog",
  backLabel = "← All posts",
  prev,
  next,
  showShare = true,
}: {
  post: ArticleDisplayPost;
  html: string;
  toc: TocItem[];
  backHref?: string;
  backLabel?: string;
  prev?: AdjacentPostLink | null;
  next?: AdjacentPostLink | null;
  showShare?: boolean;
}) {
  const bodyId = `article-body-${post.slug || "preview"}`;
  const canonicalUrl = `${site.url}/blog/${post.slug}`;

  return (
    <>
      <article className="blog-art">
        <Link className="blog-crumb" href={backHref}>
          {backLabel}
        </Link>

        <p className="blog-meta">
          <span>{formatArticleDate(post.publishedAt)}</span>
          <span>{post.readingMinutes} min read</span>
          {post.tags.length > 0 ? (
            <span className="blog-tagl">{post.tags.join(" · ")}</span>
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

      {showShare || prev || next ? (
        <div className="blog-aend">
          {showShare ? <ShareRow url={canonicalUrl} title={post.title} /> : null}
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
        </div>
      ) : null}
    </>
  );
}
