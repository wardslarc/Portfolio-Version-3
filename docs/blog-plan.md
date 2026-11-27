# Blog + Vercel Blob images: implementation plan

Status: approved by Carls on 2026-11-27, ready to build.
Clickable layout mockup (sample data): https://claude.ai/artifact/147vB415M3cz4mQXBmhStF.
The same file is in the repo at `docs/blog-mockup.html`. Open it in a browser. Its views are
`#posts`, `#editor`, `#media`, `#blog` and `#article`.

This file is the spec for the coding agent. Work through the tasks in order, one commit per task,
and keep `npm run lint`, `npm test` and `npm run build` green after each one. **Don't push.**

## Decisions already made

| Topic | Decision |
| --- | --- |
| Content format | Markdown (GFM), rendered to sanitised HTML on the server |
| Image storage | A **public** Vercel Blob store. Browser → Blob client uploads (no 4.5 MB function body limit) |
| Post data | A new `posts` collection in the existing MongoDB |
| Statuses | Draft, Scheduled, Published. Scheduled = published with a future `publishedAt` |
| Who can write | Owner and Admin. Viewers can read the admin blog pages but can't change anything |
| Public pages | `/blog` index (tag filter + paging) and `/blog/[slug]` article |
| Extras | RSS, sitemap, OG image per post, JSON-LD, a "Blog" link in the header, a "Writing" section on the homepage (latest 3) |
| Not in scope | Comments, likes, newsletters, revisions history |

## Ground rules for the coding agent

1. **Read `AGENTS.md` first.** This repo runs Next.js 16.4 with `cacheComponents: true` and
   `partialPrefetching: true`, and APIs differ from older versions. Before you write code, read these
   guides in `node_modules/next/dist/docs/`:
   - `01-app/03-api-reference/04-functions/cacheTag.md`, `cacheLife.md`, `updateTag.md`, `revalidateTag.md`
   - the `"use cache"` directive
   - `generateStaticParams` with cache components
   - `opengraph-image`, `sitemap`, route handlers and Server Actions

   Follow deprecation notices.
2. **Follow the existing patterns.** Copy their style:
   - DB access: `src/lib/mongodb.ts` (`getDb()`, `isMongoConfigured()`).
   - Admin guards: `requireAdmin()` / `requireAdminAction(action)` in `src/lib/admin/auth.ts`.
   - Server Actions: `src/lib/admin/actions.ts`, which does zod parse → `requireAdminAction` → mutation → `logAudit`.
   - Pure DB logic: `src/lib/admin/mutations.ts` and `data.ts`. These are testable with `mongodb-memory-server`.
   - Admin UI: `src/app/admin/(panel)/*` and `src/app/admin/admin.css`. Reuse the existing classes
     (`admin-btn`, `admin-badge`, cards, segmented filters, dialogs) before adding new ones.
   - Public styles: tokens in `src/app/globals.css` (light + dark). Put blog styles in a new clearly
     marked section of `globals.css`. Use no UI libraries and no Tailwind.
3. **Every admin page, Server Action and the upload route check the session on the server.**
   Hiding a button is not access control.
4. **The admin session cookie is scoped to `path: "/admin"`** (`src/lib/admin/auth.ts`). Anything
   that needs the session must live under `/admin/...`. That includes the Blob upload route and the
   draft preview. `/api/...` never sees the cookie.
5. Admin pages stay dynamic and `noindex` (the existing admin layout already does this). Public blog
   pages are cached with `"use cache"` + `cacheTag`, and are refreshed when an admin changes a post.
6. Values from the DB or from users are text. Markdown HTML goes through `rehype-sanitize`. Never
   `dangerouslySetInnerHTML` unsanitised content.
7. Match `docs/blog-mockup.html` for layout, copy and states. It reuses the site's tokens, so the
   colours and fonts already match.

## New dependencies

```bash
npm i @vercel/blob unified remark-parse remark-gfm remark-rehype rehype-slug rehype-sanitize rehype-highlight rehype-stringify
```

Pick versions that work with React 19 / Node 24. Don't add a Markdown editor library: the editor is
a `<textarea>` with a small toolbar, as in the mockup.

## Environment variables

```bash
# Vercel Blob (public store). Set by Vercel when the store is connected to the project;
# run `vercel env pull .env.local` to get it locally.
BLOB_READ_WRITE_TOKEN=
```

Add it to `.env.example` with that comment. The app must **build and run without it**: the editor
shows "Image uploads aren't configured" and disables the upload buttons, and public pages still work.

`next.config.ts`: add
`images.remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }]`
and keep the existing `qualities` setting.

## Data model (MongoDB)

```ts
posts {
  _id: ObjectId,
  title: string,                 // 1–140 chars
  slug: string,                  // unique index; ^[a-z0-9]+(?:-[a-z0-9]+)*$, max 80
  excerpt: string,               // 0–200 chars (UI warns above 160)
  body: string,                  // Markdown, max 100_000 chars
  cover: { url, alt, width, height } | null,
  tags: string[],                // max 5, each 1–24 chars, trimmed, case-insensitively unique
  status: "draft" | "published",
  publishedAt: Date | null,      // set when published; future date = scheduled
  readingMinutes: number,        // ceil(words / 220), min 1, computed on save
  views: number,                 // default 0
  authorId: ObjectId, authorName: string,
  createdAt: Date, updatedAt: Date,
}
// indexes: { slug: 1 } unique; { status: 1, publishedAt: -1 }; { tags: 1, publishedAt: -1 }

media {
  _id: ObjectId,
  url: string (unique), pathname: string,
  contentType: string, size: number, width: number, height: number,
  usedBy: ObjectId[],            // post ids that reference this URL (cover or body)
  uploadedBy: ObjectId, uploadedAt: Date,
}

post_views {                     // TTL index on expiresAt (24 h). Dedupes view counts.
  _id: `${postId}:${ipHash}`, expiresAt: Date
}
```

A post is **live** when `status === "published" && publishedAt <= now`.

Derived status for the UI:
- **Draft:** `status === "draft"`.
- **Scheduled:** published, but `publishedAt > now`.
- **Published:** live.

Add `ensureBlogIndexes(db)`, in the same pattern as `ensureAdminIndexes`.

## Permissions

In `src/lib/admin/permissions.ts`, add the actions `"blog:view"` (owner, admin, viewer) and `"blog:write"`
(owner, admin). `blog:write` covers creating, editing, publishing, deleting posts, and uploading
and deleting media. Add tests to the existing permissions/admin tests.

## Image uploads (Vercel Blob)

The flow follows `@vercel/blob/client`'s `upload()` + `handleUpload()`. Read the package's README / types
in `node_modules/@vercel/blob` for the exact current API.

1. **Client prep** (`src/lib/blog/image-prep.ts`, browser only):
   - Read the file. Reject anything that isn't `image/jpeg|png|webp|gif|avif` or is over 8 MB.
   - For everything except GIF, draw it to a canvas no wider than 2400px, keeping the aspect ratio.
     Export with `toBlob("image/webp", 0.85)`.
   - Return `{ blob, width, height, filename }`. The filename is slugified, with a `.webp` extension.
2. **Upload:**
   - Call `upload(\`blog/${filename}\`, blob, { access: "public", handleUploadUrl: "/admin/api/blob", multipart: blob.size > 4_000_000, onUploadProgress })`.
   - Show progress per file, as in the mockup ("Optimising…", "Uploading 42%", "Uploaded").
3. **Token route `src/app/admin/api/blob/route.ts`** (POST), using `handleUpload`:
   - In `onBeforeGenerateToken`, call `requireAdminAction("blog:write")` (or the equivalent session check
     for route handlers). Reject with 401/403 if it fails.
   - Require `pathname` to start with `blog/`.
   - Return `allowedContentTypes` (the 5 types above), `maximumSizeInBytes: 8 * 1024 * 1024` and
     `addRandomSuffix: true`.
   - Don't rely on `onUploadCompleted`: it doesn't fire on localhost.
4. **Register** with the Server Action `registerMediaAction({ url, width, height })`:
   - Require `blog:write`.
   - The URL must be `https:` on a `*.public.blob.vercel-storage.com` host, with a pathname starting with `blog/`.
   - Call `head(url)` from `@vercel/blob` to confirm the file exists and read its size, content type and pathname.
   - Upsert into `media` and audit it as `media.upload`.
5. **Insert:**
   - Body images go in at the cursor as `![Describe this image](url)`.
   - A cover image sets `cover` in the form state.
6. **Usage tracking:**
   - On every post save, collect the blob URLs in the body (Markdown image syntax) plus the cover URL.
     Set `usedBy` with `$addToSet` on those media and `$pull` the post id from all others, in one helper
     (`syncMediaUsage(db, postId, urls)`).
7. **Deleting:**
   - Deleting a post deletes the post, then runs `del()` on media whose `usedBy` becomes empty and that
     were uploaded during this post's lifetime (use `usedBy` before the update). The media docs are
     deleted too.
   - The Media page can delete only images with an empty `usedBy`. It confirms first, then calls
     `del(url)` and removes the doc.
   - If Blob deletion fails, keep the doc and show an error toast.

## Markdown rendering (`src/lib/blog/markdown.ts`, server only)

The pipeline is `unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeSlug).use(rehypeHighlight).use(rehypeSanitize, schema).use(rehypeStringify)`.

- **Sanitize schema:** extend `defaultSchema` to allow `id` on h2/h3 and the `className` values
  rehype-highlight emits (`hljs`, `language-*`) on `code`/`span`. Don't allow `style`, `script`, `iframe`
  or event handlers. Only `http:`, `https:` and `mailto:` links. Image `src` must be `https:`.
- **Post-processing:**
  - Wrap a paragraph that contains only an image in `<figure>`, using the alt text as `<figcaption>`.
  - Add `loading="lazy"` and `decoding="async"` to images.
  - Give external links `rel="noopener noreferrer"`.
- **TOC:** also export `extractToc(markdown) → { id, text }[]` for the h2s, using the same slugger as `rehype-slug`.
- **Reading time:** export `readingMinutes(markdown)`.
- **Tests:**
  - `<script>`, `onerror=`, `javascript:` links and raw `<iframe>` are stripped.
  - Code blocks get highlight classes.
  - Headings get ids that match `extractToc`.
  - A standalone image becomes a figure with a caption.

## Caching and freshness

- Public data functions live in `src/lib/blog/public.ts`: `getLivePosts({ tag, page })`,
  `getLivePostBySlug(slug)`, `getAdjacentPosts(post)`, `getAllTags()` and `getLatestPosts(3)`.
  - Each uses `"use cache"`.
  - Each uses `cacheTag("posts")`. The single-post function also uses `cacheTag(\`post:${slug}\`)`.
  - Each uses `cacheLife` with `revalidate` of about 15 minutes, so scheduled posts appear within 15 minutes of their time.
- Admin Server Actions that change a post call `updateTag("posts")` and `updateTag(\`post:${slug}\`)`.
  An action that changes a slug also updates the old slug's tag. Confirm the exact API and the
  second-argument rules in the docs.
- Admin pages read directly from the DB. Never cache them.
- Views:
  - The article page renders a tiny client component that `POST`s `/api/blog/view` with the slug once
    per page load (`navigator.sendBeacon`, falling back to `fetch` with `keepalive`).
  - The route hashes the IP the same way `src/lib/contact.ts` does, inserts into `post_views` (a
    duplicate key means already counted today, so return 204), and `$inc`s `views` only for live posts.
  - Rate limit it with the existing `rate_limits` pattern. Never revalidate the cache for a view.

## Pages

```text
src/app/admin/(panel)/blog/page.tsx                 # Posts list  (?q=, ?status=all|published|scheduled|draft)
src/app/admin/(panel)/blog/new/page.tsx             # creates an empty draft server-side, redirects to /admin/blog/<id>
src/app/admin/(panel)/blog/[id]/page.tsx            # Editor
src/app/admin/(panel)/blog/[id]/preview/page.tsx    # draft preview, rendered with the public article component
src/app/admin/(panel)/media/page.tsx                # Media library (?q=, ?filter=all|unused)
src/app/admin/api/blob/route.ts                     # Blob client-upload token route
src/app/blog/page.tsx                               # Public index  (?tag=, ?page=)
src/app/blog/[slug]/page.tsx                        # Public article
src/app/blog/[slug]/opengraph-image.tsx             # per-post OG image (title + site name, site colours)
src/app/blog/rss.xml/route.ts                       # RSS 2.0, latest 20 live posts
src/app/api/blog/view/route.ts                      # view counter
src/components/blog/*                               # ArticleBody, Toc, CodeCopy, PostCard, ShareRow, BlogHeader…
src/lib/blog/{posts.ts,public.ts,markdown.ts,media.ts,slug.ts,image-prep.ts}
```

Add **Blog** and **Media** to `AdminShellNav` links, between Messages and Chess, as in the mockup.

## Admin UX (match `#posts`, `#editor`, `#media` in the mockup)

**Posts list**
- A "New post" button. A search box that matches title and tags.
- A status filter with counts: All, Published, Scheduled, Draft.
- Each row shows the cover thumb, title, tags, status badge, date and views.
  - The date is the publish date, the scheduled date, or "Edited 2h ago".
  - Under 900px, hide the date and views columns.
- The row menu offers Edit, View on site (live only), Duplicate (a new draft with " (copy)" and a new
  slug), Unpublish (back to draft) and Delete (confirm dialog).
- Empty state: "No posts match. Start a new one."
- Viewers see the list without the New/menu actions.

**Editor**
- **Top bar:**
  - ← Posts.
  - A save-state indicator ("Draft · saved just now" / "Unsaved changes").
  - Preview ↗, which opens `/admin/blog/<id>/preview` in a new tab.
  - Save draft.
  - A primary button labelled by status: Publish / Schedule / Publish now / Update.
- **Title:** a large auto-growing title field.
- **Toolbar:** H2, Bold, Italic, Link, Quote, List, Code block and Image. It wraps the selection or inserts
  placeholder text, the same way the mockup does.
- **Write / Split / Preview:**
  - Split is the default above 900px. Below 900px only Write and Preview are offered.
  - The preview calls the Server Action `renderPreviewAction(markdown)`, debounced by 400ms, so the
    preview uses the exact server renderer and sanitizer.
- **Images:** drag and drop onto the textarea (show the dashed "Drop images to upload" overlay), paste
  from the clipboard, or use the Image button. Progress rows appear under the editor.
- **Autosave:** 2 seconds after the last change, and on blur. It only saves drafts. For published posts it
  never changes what's live. Instead, "Update" saves and refreshes the cache. Warn with
  `beforeunload` when there are unsaved changes.
- **Sidebar:**
  - **Publishing:** radio buttons for Draft, Schedule for later (shows a `datetime-local` input in the
    browser's timezone, stored as UTC) and Publish now.
  - **Checklist:**
    - Title.
    - Excerpt ≤ 160.
    - Cover with alt text.
    - Every body image has alt text. A placeholder `Describe this image` or an empty alt fails.
    - At least one tag.

    The primary button stays disabled until all of these pass. **Enforce the same rules on the server** for publish and schedule.
  - **Post details:**
    - URL slug, prefixed with `/blog/`. It's auto-made from the title until edited by hand. Unique; show an
      inline error if it's taken. Changing the slug of a live post shows a warning that old links break.
    - Excerpt, with a counter.
    - Tags as chips (Enter or comma adds, × removes, max 5), with a datalist of existing tags.
  - **Cover image:** a 16:9 drop zone or picker with a Remove button. Alt text is required.
  - **Search preview:** a Google-style snippet.
  - **Danger zone:** Delete post.
- **Confirm dialogs:**
  - **Publish:** "It goes live now at /blog/<slug>, appears on /blog and in the RSS feed."
  - **Schedule:** shows the date and time.
  - **Delete:** says how many images will be removed from Blob.

  Toasts as in the existing admin.
- **Audit** each action: `post.create`, `post.update`, `post.publish`, `post.schedule`, `post.unpublish`,
  `post.delete`, `media.upload` and `media.delete`.

**Media**
- An Upload button, a search box, and a filter for All or Unused.
- A usage line, for example "6 images · 3.8 MB in the blob store", summed from `media.size`.
- A grid of cards: thumbnail, file name, size, "used in N posts" or "unused", Copy URL, and Delete.
  Delete is disabled with a tooltip when the image is in use.

## Public UX (match `#blog`, `#article` in the mockup)

- **Header:**
  - Reuse `Header`, but on `/blog*` the section links point to `/#about`, `/#work` and so on. Make
    `Header` take a `variant` or `base` prop.
  - Add a **Blog** link (`/blog`) to the header on every page. It's `aria-current="page"` on blog routes.
  - Keep the theme toggle.
- **`/blog`:**
  - `<h1>` "Notes from building things" with the intro line from the mockup.
  - Tag filter chips. These are links to `?tag=…` with `aria-pressed`-style styling, and "All" clears the tag.
  - The newest post is a large card (2:1 cover). The rest are a list with a 4:3 thumb on the right.
    Under 760px, hide the excerpt in list items.
  - 10 per page, with "Newer / Older posts" links.
  - Empty state: "No posts yet." When the DB isn't configured, show the same empty state. Don't crash the build.
- **`/blog/[slug]`:**
  - "← All posts", then a meta line (date · reading time · tags), the title, the excerpt as the lede,
    the author row, and the cover (`next/image`, `priority`, `sizes`).
  - The body is in a 680px column (`.prose` styles from the mockup). An "On this page" TOC sits sticky to
    the right at ≥1240px, with the active heading highlighted. Hide it when there are fewer than 3 h2s.
  - Code blocks get a Copy button (a client component that enhances the server HTML).
  - The end of the article has a Share row (Copy link, X intent URL, LinkedIn share URL) and
    previous/next cards.
  - `notFound()` for unknown or non-live slugs.
  - `generateStaticParams` returns live slugs. Check the cache-components docs for what is allowed when
    the list is empty or the DB is unavailable at build time.
- **SEO:**
  - `generateMetadata` gives the title, description (the excerpt), canonical, OG and Twitter tags (type article, publishedTime, tags).
  - JSON-LD `BlogPosting` (headline, datePublished, dateModified, image, author → the existing Person `@id`).
  - Add `/blog` and every live post to `sitemap.ts`, with `lastModified = updatedAt`.
  - Add `<link rel="alternate" type="application/rss+xml">` on blog pages.
  - The footer on blog pages links to RSS.
- **Homepage:** add a "Writing" section after Work, using the same section label style. It shows the latest 3 live
  posts as compact rows (date, title, reading time) plus "All posts →". Hide the whole section when there
  are no live posts. Add `{ id: "blog", label: "Blog" }` handling so the header's IntersectionObserver
  doesn't break.

## Tasks (one commit each)

1. **Setup.**
   - `npm install` plus the new deps.
   - `.env.example` and `next.config.ts` `remotePatterns`.
   - `blog:view` / `blog:write` permissions with tests.
   - `ensureBlogIndexes`.
   - Commit `docs/blog-plan.md` and `docs/blog-mockup.html` along with this task.
2. **Blog core (`src/lib/blog/slug.ts`, `markdown.ts`, `posts.ts`).**
   - Slugify plus a unique-slug helper.
   - The Markdown pipeline, TOC and reading time.
   - Post CRUD helpers (create draft, update, publish/schedule with validation, unpublish, duplicate,
     delete) and `syncMediaUsage`.

   Tests with `mongodb-memory-server`: slug collisions, publish validation (rejects a missing alt or
   cover), live/scheduled filtering, usage sync, sanitisation.
3. **Uploads.**
   - `src/app/admin/api/blob/route.ts`, `image-prep.ts`, `registerMediaAction` and the media helpers.
   - Media delete, guarded by usage.

   Tests:
   - The token route rejects no session, a viewer, a bad pathname and a bad content type. Mock `handleUpload`/`head`/`del`.
   - The register action rejects foreign hosts.
4. **Admin posts list** (+ nav links, + Server Actions for unpublish, duplicate and delete).
5. **Admin editor:**
   - The page, autosave, toolbar, Write/Split/Preview with `renderPreviewAction`, and uploads in the
     editor and the cover.
   - The sidebar, checklist, the publish/schedule/update/delete dialogs, and the preview page.
6. **Admin media library.**
7. **Public `/blog` index:** cached data functions, header changes, tag filter and paging.
8. **Public article:** body, TOC, code copy, share, prev/next, view counter route + beacon.
9. **SEO + homepage:** metadata, OG image, JSON-LD, sitemap, RSS, and the homepage Writing section.
10. **Verify and polish.**
    - Lint, test and build.
    - Check every page at 390px, 720px and 1280px in light and dark. There must be no horizontal scroll.
    - Keyboard focus is visible, and all buttons are ≥ 40px tall.
    - Fix anything that doesn't match the mockup.
    - Update `README.md` with the Blob setup steps.

## Manual steps for Carls (not for the agent)

1. Vercel → Storage → Create **Blob** store (public access) → Connect to this project (all environments).
2. `vercel env pull .env.local` so `BLOB_READ_WRITE_TOKEN` is available locally.
3. Deploy, sign in to `/admin/blog`, write a first post, and publish.

## Definition of done

- All 10 tasks are committed, and `npm run lint`, `npm test` and `npm run build` pass.
- Without `BLOB_READ_WRITE_TOKEN` and without `MONGODB_URI`, the site still builds and `/blog` shows the empty state.
- A Viewer can open `/admin/blog` and `/admin/media` but every mutation is rejected **on the server**.
- Publishing a post makes it appear on `/blog`, the homepage, the sitemap and RSS without a redeploy.
- A scheduled post appears on its own within about 15 minutes of its time.
- Deleting a post removes its unused images from Blob. Images still used elsewhere stay.
- Markdown can't inject script, iframes, inline styles or `javascript:` links.
