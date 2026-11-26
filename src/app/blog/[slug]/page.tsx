import { notFound } from "next/navigation";
import { Suspense } from "react";
import ArticleView from "@/components/blog/ArticleView";
import ViewBeacon from "@/components/blog/ViewBeacon";
import { extractToc, renderMarkdown } from "@/lib/blog/markdown";
import {
  getAdjacentPosts,
  getLivePostBySlug,
  getLivePostSlugs,
} from "@/lib/blog/public";

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

  return (
    <>
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
