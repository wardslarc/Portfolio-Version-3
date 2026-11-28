import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Breadcrumbs from "@/components/blog/Breadcrumbs";
import PostList from "@/components/blog/PostList";
import { site } from "@/content/site";
import { getLivePosts, getTagIndex } from "@/lib/blog/public";

function buildTagDescription(tagName: string, titles: string[]): string {
  const prefix = `Posts by ${site.name} about ${tagName}`;
  const full = titles.length > 0 ? `${prefix}: ${titles.slice(0, 3).join("; ")}` : `${prefix}.`;
  if (full.length <= 160) return full;
  return `${full.slice(0, 159).trimEnd()}…`;
}

export async function generateStaticParams() {
  const tags = await getTagIndex();
  if (tags.length === 0) {
    return [{ tag: "__placeholder__" }];
  }
  return tags.map((t) => ({ tag: t.slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  if (tag === "__placeholder__") return {};

  const sp = await searchParams;
  const parsedPage = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [tags, result] = await Promise.all([
    getTagIndex(),
    getLivePosts({ tagSlug: tag, page: parsedPage }),
  ]);
  const tagInfo = tags.find((t) => t.slug === tag);
  if (!tagInfo) return {};

  const canonical =
    result.page > 1 ? `/blog/tag/${tagInfo.slug}?page=${result.page}` : `/blog/tag/${tagInfo.slug}`;
  const title =
    result.page > 1
      ? `${tagInfo.name}: posts, page ${result.page} | ${site.name}`
      : `${tagInfo.name}: posts | ${site.name}`;
  const description = buildTagDescription(
    tagInfo.name,
    result.items.map((p) => p.title),
  );

  return {
    title,
    description,
    alternates: {
      canonical,
      types: { "application/rss+xml": "/blog/rss.xml" },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: site.name,
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      creator: "@daleonigiri",
    },
  };
}

async function TagPostsContent({
  tagSlug,
  searchParams,
}: {
  tagSlug: string;
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const parsedPage = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [tags, result] = await Promise.all([
    getTagIndex(),
    getLivePosts({ tagSlug, page: parsedPage }),
  ]);

  return (
    <PostList
      tags={tags}
      activeTagSlug={tagSlug}
      items={result.items}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      basePath={`/blog/tag/${tagSlug}`}
    />
  );
}

export default async function BlogTagPage({
  params,
  searchParams,
}: {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { tag } = await params;
  if (tag === "__placeholder__") {
    notFound();
  }

  const tags = await getTagIndex();
  const tagInfo = tags.find((t) => t.slug === tag);
  if (!tagInfo) {
    notFound();
  }

  const tagUrl = `${site.url}/blog/tag/${tagInfo.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${tagUrl}#collection`,
        url: tagUrl,
        name: `Posts about ${tagInfo.name}`,
        inLanguage: "en",
        isPartOf: { "@id": `${site.url}/blog#blog` },
        about: tagInfo.name,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: site.url },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${site.url}/blog` },
          { "@type": "ListItem", position: 3, name: tagInfo.name, item: tagUrl },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <section className="blog-hero k-grid">
        <div className="k-wrap">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Blog", href: "/blog" },
              { label: tagInfo.name },
            ]}
          />
          <p className="k-kicker k-in-fade" style={{ animationDelay: "0.05s" }}>
            Tag
          </p>
          <h1 className="blog-hero-h1">
            <span className="k-ln">
              <span className="k-in-line" style={{ animationDelay: "0.15s" }}>
                Posts about
              </span>
            </span>
            <span className="k-ln">
              <span className="k-in-line" style={{ animationDelay: "0.27s" }}>
                <span className="k-serif">{tagInfo.name}.</span>
              </span>
            </span>
          </h1>
          <p className="blog-hero-lede k-in-up" style={{ animationDelay: "0.5s" }}>
            {tagInfo.count} {tagInfo.count === 1 ? "post" : "posts"} tagged {tagInfo.name}.
          </p>
        </div>
      </section>

      <Suspense
        fallback={
          <div className="k-wrap">
            <div className="blog-empty">
              <p>Loading posts…</p>
            </div>
          </div>
        }
      >
        <TagPostsContent tagSlug={tagInfo.slug} searchParams={searchParams} />
      </Suspense>
    </>
  );
}
