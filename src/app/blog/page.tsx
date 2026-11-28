import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import PostList from "@/components/blog/PostList";
import { site } from "@/content/site";
import { getLivePosts, getTagIndex } from "@/lib/blog/public";
import { tagToSlug } from "@/lib/blog/slug";

const BLOG_TITLE = `Blog | ${site.name}`;
const BLOG_DESCRIPTION =
  "Write-ups on the systems behind this site and the tools I build at work: what I tried, what broke, what I'd do again.";

function getTagRedirectTarget(sp: { tag?: string; page?: string }): string | null {
  const rawTag = sp.tag?.trim();
  if (!rawTag) return null;
  const tagSlug = tagToSlug(rawTag);
  const page = Number.parseInt(sp.page ?? "1", 10);
  const qs = Number.isFinite(page) && page > 1 ? `?page=${page}` : "";
  return tagSlug ? `/blog/tag/${tagSlug}${qs}` : `/blog${qs}`;
}

// The page already streams its post list at request time, so reading searchParams here
// only defers metadata alongside it. Page 2+ is its own canonical URL so Google keeps
// crawling older posts.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; page?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const redirectTarget = getTagRedirectTarget(sp);
  if (redirectTarget) {
    permanentRedirect(redirectTarget);
  }

  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const canonical = page > 1 ? `/blog?page=${page}` : "/blog";
  const title = page > 1 ? `Blog, page ${page} | ${site.name}` : BLOG_TITLE;

  return {
    title,
    description: BLOG_DESCRIPTION,
    alternates: {
      canonical,
      types: { "application/rss+xml": "/blog/rss.xml" },
    },
    openGraph: {
      title,
      description: BLOG_DESCRIPTION,
      url: canonical,
      siteName: site.name,
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: BLOG_DESCRIPTION,
      creator: "@daleonigiri",
    },
  };
}

const blogJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Blog",
      "@id": `${site.url}/blog#blog`,
      url: `${site.url}/blog`,
      name: `${site.name} Blog`,
      description: BLOG_DESCRIPTION,
      inLanguage: "en",
      isPartOf: { "@id": `${site.url}/#website` },
      author: { "@id": `${site.url}/#person` },
      publisher: { "@id": `${site.url}/#person` },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: site.url },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${site.url}/blog` },
      ],
    },
  ],
};

async function BlogIndexContent({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const redirectTarget = getTagRedirectTarget(sp);
  if (redirectTarget) {
    permanentRedirect(redirectTarget);
  }

  const parsedPage = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const [tags, result] = await Promise.all([
    getTagIndex(),
    getLivePosts({ page: parsedPage }),
  ]);

  return (
    <PostList
      tags={tags}
      items={result.items}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      basePath="/blog"
      showFeatured
    />
  );
}

export default function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; page?: string }>;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd).replace(/</g, "\\u003c") }}
      />
      <section className="blog-hero k-grid">
        <div className="k-wrap">
          <p className="k-kicker">Blog</p>
          <h1 className="blog-hero-h1">
            <span className="k-ln">
              <span>Notes from</span>
            </span>
            <span className="k-ln">
              <span>
                building{" "}
                <span className="k-serif blog-scrib">
                  things.
                  <svg viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true">
                    <path
                      d="M3 13c40-9 95-11 194-4"
                      pathLength={1}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={4}
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </span>
            </span>
          </h1>
          <div className="blog-hero-row">
            <p className="blog-hero-lede">
              Write-ups on the systems behind this site and the tools I build at work: what I
              tried, what broke, what I&apos;d do again.
            </p>
            <span className="k-note blog-hero-note" aria-hidden="true">
              plain English, promise ✎
            </span>
          </div>
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
        <BlogIndexContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
