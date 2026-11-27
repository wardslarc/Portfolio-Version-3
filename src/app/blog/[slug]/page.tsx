import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import ArticleView from "@/components/blog/ArticleView";
import ViewBeacon from "@/components/blog/ViewBeacon";
import { site } from "@/content/site";
import { extractToc, renderMarkdown } from "@/lib/blog/markdown";
import {
  getAdjacentPosts,
  getLivePostBySlug,
  getLivePostSlugs,
} from "@/lib/blog/public";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (slug === "__placeholder__") return {};
  const post = await getLivePostBySlug(slug);
  if (!post) return {};

  const canonical = `/blog/${post.slug}`;
  return {
    title: `${post.title} | ${site.name}`,
    description: post.excerpt,
    alternates: {
      canonical,
      types: {
        "application/rss+xml": "/blog/rss.xml",
      },
    },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: canonical,
      siteName: site.name,
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      tags: post.tags,
      authors: [post.authorName || site.name],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      creator: "@daleonigiri",
    },
  };
}

export async function generateStaticParams() {
  const posts = await getLivePostSlugs();
  if (posts.length === 0) {
    return [{ slug: "__placeholder__" }];
  }
  return posts.map((p) => ({ slug: p.slug }));
}

async function ArticleContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug === "__placeholder__") {
    notFound();
  }

  const post = await getLivePostBySlug(slug);
  if (!post) {
    notFound();
  }

  const [html, adjacent] = await Promise.all([
    renderMarkdown(post.body),
    getAdjacentPosts({ publishedAt: post.publishedAt, slug: post.slug }),
  ]);
  const toc = extractToc(post.body);

  const postUrl = `${site.url}/blog/${post.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${postUrl}#post`,
        mainEntityOfPage: { "@type": "WebPage", "@id": postUrl },
        headline: post.title,
        description: post.excerpt,
        datePublished: post.publishedAt,
        dateModified: post.updatedAt,
        url: postUrl,
        inLanguage: "en",
        // Fall back to the generated share card so every post has an image for rich results.
        image: post.cover ? post.cover.url : `${postUrl}/opengraph-image`,
        ...(post.tags.length > 0 ? { keywords: post.tags.join(", ") } : {}),
        wordCount: post.body.split(/\s+/).filter(Boolean).length,
        isPartOf: { "@id": `${site.url}/blog#blog` },
        author: {
          "@id": `${site.url}/#person`,
          "@type": "Person",
          name: post.authorName || site.name,
          url: site.url,
        },
        publisher: { "@id": `${site.url}/#person` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: site.url },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${site.url}/blog` },
          { "@type": "ListItem", position: 3, name: post.title, item: postUrl },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <ArticleView
        post={post}
        html={html}
        toc={toc}
        prev={adjacent.prev}
        next={adjacent.next}
      />
      <ViewBeacon slug={post.slug} />
    </>
  );
}

export default function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<div className="blog-empty">Loading article…</div>}>
      <ArticleContent params={params} />
    </Suspense>
  );
}
