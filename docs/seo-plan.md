# SEO, part 2: tag pages, related posts, breadcrumbs, image sizes, llms.txt

Status: approved by Carls on 2026-11-27. Branch: `feat/seo` (already has commit `c6cab39`, the quick fixes).

This file is the spec for the coding agent. Work through the tasks in order, one commit per task
(Conventional Commits, `feat(seo): …`), and keep `npm run lint`, `npm test` and `npm run build` green
after each one. **Don't push, merge or switch branches.**

## Already done in `c6cab39` (don't redo)

- The sitemap renders per request (`connection()`) and lists post images.
- `/blog` has its own OG/Twitter tags and `src/app/blog/opengraph-image.tsx`. Page 2+ is self-canonical.
  `?tag=` filters are `noindex, follow`. It also has `Blog` + `BreadcrumbList` JSON-LD.
- Post pages have `@graph` JSON-LD: `BlogPosting` (with `isPartOf` → `${site.url}/blog#blog`) + `BreadcrumbList`.
- There's a root `not-found.tsx` and `manifest.ts`.

## Ground rules

1. Read `AGENTS.md`. This is Next.js 16.4 with `cacheComponents: true` and `partialPrefetching: true`. Before
   writing code, read the relevant guides in `node_modules/next/dist/docs/`: `generateStaticParams`,
   `generateMetadata` (the "With Cache Components" section), `permanentRedirect`, `"use cache"`/`cacheTag`/
   `cacheLife`, and route handlers.
2. Data helpers go in `src/lib/blog/public.ts`. Copy the existing pattern: `"use cache"`, `cacheTag("posts")`,
   the same `cacheLife`, `isMongoConfigured()` guard, try/catch returning empty. Admin actions already call
   `updateTag("posts")`, so new cached helpers refresh automatically.
3. Public styles go in the blog section of `src/app/globals.css`, using the existing tokens and classes
   (`blog-*`). No UI libraries.
4. JSON-LD goes in `<script type="application/ld+json">` with `JSON.stringify(x).replace(/</g, "\\u003c")`,
   as in the existing pages.
5. Don't touch the engagement feature (it lives on another branch). Keep changes to
   `src/app/blog/page.tsx`, `src/app/blog/[slug]/page.tsx` and `ArticleView.tsx` as small as possible, because
   they'll be merged with that branch.

## Task 1: Tag landing pages `/blog/tag/[tag]`

Tag pages are real, indexable URLs, each with its own title, so they can rank for topic searches.

- `tagToSlug(tag)` in `src/lib/blog/slug.ts`: lowercase, trim, replace non-alphanumerics with `-`, collapse
  repeats, trim `-`. For example "Next.js" → `next-js` and "Web Security" → `web-security`. Add unit tests.
- `getTagIndex()` in `public.ts` (cached) → `{ slug, name, count }[]` for all live posts.
  `name` is the first-seen casing, as `getAllTags` does. Sort by name.
  `getLivePosts` gets a `tagSlug` option. Resolve it to the tag names whose slug matches and filter
  case-insensitively as today.
- Route `src/app/blog/tag/[tag]/page.tsx`:
  - `generateStaticParams` from `getTagIndex()`. If it's empty, return a placeholder param and `notFound()` for
    it, the same trick as `/blog/[slug]`.
  - Unknown tag → `notFound()`.
  - It reuses the index list UI. Extract the list/pager markup from `src/app/blog/page.tsx` into
    `src/components/blog/PostList.tsx` and use it in both places. There's no featured card on tag pages.
  - Heading: `Posts about {name}`. Intro: `{count} post(s) tagged {name}.` Tag chips stay visible, with the
    current tag marked `aria-current="page"`.
  - Paging with `?page=N`. Page 2+ is self-canonical (`/blog/tag/x?page=2`).
  - Metadata: title `{name}: posts | {site.name}` and description
    `Posts by {site.name} about {name}: {titles of the first 3 posts, joined with "; "}`, trimmed to 160 chars.
    Also canonical, `openGraph` (`type: "website"`, url) and `twitter`. The `/blog` OG image is inherited, which is fine.
  - JSON-LD: `CollectionPage` (`isPartOf` the blog `@id`, `about` the tag name) + `BreadcrumbList`
    (Home → Blog → {name}).
- `/blog?tag=X` → `permanentRedirect("/blog/tag/" + tagToSlug(X))`, keeping `page` if present.
  Remove the `noindex` branch for tags from `/blog`'s `generateMetadata` (the redirect replaces it).
- Tag chips on `/blog` link to `/blog/tag/{slug}`. Tag labels on post cards and in the article meta row become
  links to their tag pages (`<a>` per tag, keep the `·` separators). They must still look the same.
  On cards the whole item is already a link, so don't nest `<a>` in `<a>`: show the tags as plain text there.
- Sitemap: add each tag page (`changeFrequency: "weekly"`, `priority: 0.5`, `lastModified` = newest post in
  that tag). Add `latestUpdatedAt` to `getTagIndex` for this.
- RSS: no change.
- *Accept:* `/blog/tag/<slug>` is prerendered in `next build` output. Its head has a unique title, description
  and self canonical. `/blog?tag=Foo` returns 308 to `/blog/tag/foo`. An unknown tag returns 404.

## Task 2: Related posts at the end of each article

Internal links help crawlers and keep readers on the site.

- `getRelatedPosts(slug, tags, limit = 3)` in `public.ts` (cached): live posts excluding this one, ranked by the
  number of shared tags (desc), then `publishedAt` desc. If fewer than `limit` share a tag, fill with the latest
  posts. Return summary fields only (title, slug, excerpt, publishedAt, readingMinutes, cover).
- Render a "Keep reading" section after the prev/next links in `ArticleView` (pass it in as a prop from the page;
  the preview page passes nothing). Show up to 3 compact cards: title as an `<h3>` link, date · min read,
  excerpt clamped to 2 lines. Hidden when the list is empty.
- *Accept:* tests for the ranking (shared tags first, fill with latest, excludes self and unpublished/scheduled posts).

## Task 3: Visible breadcrumbs

- Replace the `← All posts` crumb on articles with `<nav aria-label="Breadcrumb"><ol>Home / Blog / {title}</ol></nav>`.
  The last item is not a link and has `aria-current="page"`. Long titles are truncated with an ellipsis on one
  line. Reuse and adapt the `.blog-crumb` styles.
- Add the same breadcrumb to tag pages: Home / Blog / {name}.
- It must match the JSON-LD `BreadcrumbList` on each page.

## Task 4: Image dimensions in post bodies (layout shift)

Markdown images render as plain `<img>` with no size, so the text jumps as they load (CLS, a Core Web Vital).

- In `src/lib/blog/markdown.ts`, `renderMarkdown` gets an optional `imageSizes: Map<string, { width; height }>`.
  The post-process plugin sets `width` and `height` on `<img>` whose `src` is in the map. Make sure
  the sanitize schema allows `width`, `height`, `loading` and `decoding` on `img`, and check that the plugin
  runs after sanitize, or that sanitize keeps the attributes. Add tests.
- The article page looks up sizes for the body's image URLs from the `media` collection (one `find` with `$in`,
  in a cached helper `getMediaSizes(urls)` tagged `"posts"`), and passes them in.
- The first body image above the fold is not specially handled. Lazy is fine.
- CSS: `.blog-prose img { height: auto; }` so the width/height attributes only set the aspect ratio.
- *Accept:* a post with an uploaded image renders `<img … width="…" height="…">`. Unknown (external) images are unchanged.

## Task 5: `/llms.txt`

This is a plain-text summary for AI search engines and assistants.

- Route handler `src/app/llms.txt/route.ts` (static, cached with tag `posts`). Content follows the llms.txt
  convention:
  - `# {site.name}`, then a `>` one-line summary (`site.description`).
  - A short paragraph: role, location, availability, contact email, from `src/content/site.ts`.
  - `## Pages`: links to the homepage, `/blog`, and the résumé PDF, each with a one-line description.
  - `## Projects`: each item in `src/content/projects.ts` with its `href` if present, plus a one-line summary.
  - `## Blog posts`: every live post as `- [Title](absolute url): excerpt`.
  - `## Elsewhere`: `site.socials`.
- `Content-Type: text/plain; charset=utf-8`.
- Don't add it to the sitemap.
- *Accept:* `GET /llms.txt` returns 200 with the sections above, and the build lists it as static or partial.

## Definition of done

- 5 commits on `feat/seo`. Lint, tests and build are green. No new npm dependencies.
- Print a summary of the commits, the test count, and anything skipped or uncertain.
