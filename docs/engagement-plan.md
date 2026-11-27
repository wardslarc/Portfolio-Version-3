# Blog engagement (views, likes, shares) + admin stats: implementation plan

Status: approved by Carls on 2026-11-27, ready to build. Branch: `feat/engagement`.

This file is the spec for the coding agent. Work through the tasks in order, one commit per task,
and keep `npm run lint`, `npm test` and `npm run build` green after each one. **Don't push.**

## Decisions already made

| Topic | Decision |
| --- | --- |
| Metrics | Views (exists), likes (new, toggleable), shares (new, counted per channel) |
| Comments | **Out of scope.** Don't build comments. |
| Visitor identity | The existing site-wide `visitor_id` cookie (today in `src/lib/chess.ts`). No login. |
| Public counts | Fetched client-side from an uncached endpoint so the article page stays cached |
| Admin | Stats columns on the blog list, an Engagement page, a per-post stats page, a Blog card on Overview |
| Management | Remove likes from a flagged source, reset counters, hide counts publicly per post. All audit-logged. |
| Who can manage | Owner and Admin. Viewers see the stats but can't change them. |
| New services / packages | None. MongoDB only. No chart library: charts are plain HTML/CSS or inline SVG. |

## Ground rules for the coding agent

1. **Read `AGENTS.md` first.** The repo runs Next.js 16.4 with `cacheComponents: true` and
   `partialPrefetching: true`. Before you write code, read these guides in `node_modules/next/dist/docs/`:
   route handlers, `cookies`, `"use cache"`, `cacheTag`, `cacheLife`, `updateTag` and `revalidateTag`.
   Follow deprecation notices.
2. **Follow the existing patterns.**
   - The public route pattern is `src/app/api/blog/view/route.ts`: zod → `isMongoConfigured` → `ensureBlogIndexes`
     → `consumeRateLimit` → live-post check → write.
   - Server Actions go in `src/lib/admin/actions.ts`: zod parse → `requireAdminAction` → mutation → `logAudit` → `updateTag`.
   - Testable DB logic lives in `src/lib/blog/*.ts` and `src/lib/admin/*.ts`, tested with `mongodb-memory-server`
     (see `src/lib/blog/posts.test.ts`, `src/app/api/blog/view/route.test.ts`).
   - Admin UI goes in `src/app/admin/(panel)/*` and `src/app/admin/admin.css`. Reuse `admin-card`, `admin-stats-grid`,
     `admin-stat-label`, `admin-stat-val`, `admin-btn`, `admin-badge`, segmented filters and dialogs.
     The overview page's "Moves per day" bars show the chart style to match.
   - Public styles use the tokens in `src/app/globals.css` (light + dark), in the existing blog section. No UI libraries, no Tailwind.
3. Every admin page and Server Action checks the session on the server. Hiding a button is not access control.
4. The admin session cookie is scoped to `path: "/admin"`, so public `/api/...` routes never see it.
   That is why the "no-track" cookie below exists.
5. Admin pages stay dynamic. Public blog pages stay cached. **Never** call `updateTag`/`revalidateTag` from the
   like/share/view routes: counts are served live from the engagement endpoint instead.
6. Every counter change is one atomic MongoDB operation (`$inc`, upsert, unique `_id`). Never read-modify-write.
   Counters must never go below 0.

## Visitor identity, no-track and bots

- **Shared visitor helper.** Move `VISITOR_COOKIE_NAME`, `VISITOR_COOKIE_MAX_AGE`, `parseVisitorCookie` and
  `formatVisitorSetCookie` from `src/lib/chess.ts` into a new `src/lib/visitor.ts`. Keep the cookie name
  `visitor_id` so existing chess visitors keep their identity. Re-export from `chess.ts`, or update the imports;
  chess behaviour must not change and the chess tests must still pass.
  Add `hashBlogVisitor(visitorId)` = sha256 of `${IP_HASH_SALT || "portfolio"}:blog:v:${visitorId}`, sliced to 32 hex chars.
- **No-track cookie.** Wherever an admin session cookie is set (`src/lib/admin/auth-actions.ts`: trusted-device
  sign-in, code verification, and any invite-accept or other path that calls `createSession`), also set
  `blog_notrack=1; Path=/; Max-Age=1 year; HttpOnly; SameSite=Lax; Secure in production`.
  Don't remove it on sign-out: it marks the device, not the session.
  The view, like and share routes check for it. When it's present they return success without writing anything.
  For likes they return the current state unchanged, with the response field `tracked: false`.
- **Bots.** Add `isLikelyBot(userAgent)` in `src/lib/visitor.ts`. It's a case-insensitive regex for
  `bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|quora link|whatsapp|telegrambot|discordbot|headless|lighthouse`
  and also matches an empty user agent. Bot requests are not counted (204 / unchanged state).

## Data model (MongoDB)

Extend `PostDoc` in `src/lib/blog/indexes.ts`:

```ts
likes: number;                      // default 0. Read as `doc.likes ?? 0` (old docs don't have it)
shares: { copy: number; x: number; linkedin: number; native: number }; // read missing as all 0
hideStats: boolean;                 // default false
```

Set the defaults in `createDraftPost` and `duplicatePost`. A duplicated post starts with 0 views, 0 likes, 0 shares
and `hideStats: false`. Add `likes`, `shares` (total plus per channel) and `hideStats` to `SerializedAdminPost` and `serializeAdminPost`.

New collections (constants in `indexes.ts`, indexes in `ensureBlogIndexes`):

```ts
post_likes {                        // one per visitor per post. Permanent.
  _id: string,                      // `${postId}:${visitorHash}`
  postId: ObjectId,
  ipHash: string,                   // hashIp(clientIp(headers)) from src/lib/contact.ts
  createdAt: Date,
}
// indexes: { postId: 1, ipHash: 1 }, { postId: 1, createdAt: -1 }

post_shares {                       // dedupe: one share per visitor per post per channel per 24 h
  _id: string,                      // `${postId}:${visitorHash}:${channel}`
  expiresAt: Date,
}
// index: { expiresAt: 1 } TTL expireAfterSeconds 0

post_stats_daily {                  // one per post per UTC day
  _id: string,                      // `${postId}:${YYYY-MM-DD}`
  postId: ObjectId,
  date: string,                     // "YYYY-MM-DD" (UTC)
  views: number, likes: number,     // likes = net change that day (unlikes subtract, may go negative)
  shares: { copy: number; x: number; linkedin: number; native: number },
}
// indexes: { date: 1 }, { postId: 1, date: 1 }
```

Share channels: `copy`, `x`, `linkedin`, `native` (zod enum, exported as `SHARE_CHANNELS`).

## Engagement logic (`src/lib/blog/engagement.ts`, server only, pure DB functions)

- `bumpDaily(db, postId, patch, now)` upserts the day doc with `$inc`. Use dotted paths for shares.
- `recordView(db, postId, now)`: the existing view route keeps its `post_views` dedupe and `$inc views`, then calls
  `bumpDaily({ views: 1 })`. Move the counting logic here so it can be tested, and keep the route thin.
- `setLike(db, { postId, visitorHash, ipHash, liked, now })` → `{ liked: boolean; likes: number }`
  - `liked: true`: if the visitor already liked the post, no-op. Otherwise, if
    `countDocuments({ postId, ipHash }) >= 3`, refuse with `{ liked: false, likes, limited: true }`.
    Otherwise `insertOne`. A duplicate key (E11000) counts as already liked, which makes a concurrent double click
    safe. Only after a successful insert: `$inc likes: 1` and `bumpDaily({ likes: 1 })`.
  - `liked: false`: `deleteOne({ _id })`. Only if `deletedCount === 1`: `$inc likes: -1` with filter `likes: { $gt: 0 }`,
    then `bumpDaily({ likes: -1 })`.
  - Return the post's current `likes`.
- `recordShare(db, { postId, visitorHash, channel, now })` inserts into `post_shares` with a 24 h `expiresAt`.
  On E11000, no-op. Otherwise `$inc shares.<channel>: 1` and `bumpDaily`.
- `getPublicEngagement(db, postId, visitorHash | null)` → `{ views, likes, shares /* total */, liked, hidden }`.
  When `hideStats` is true, return `hidden: true` with views/likes/shares set to `null`. `liked` is still returned.
- Admin queries (in `engagement.ts`; the admin pages call `requireAdmin` first):
  - `queryEngagementSummary(db, { days: 7 | 30 | 0 })`, where 0 means all time. Returns:
    - totals for views, likes and shares, plus the same totals for the previous equal period (`null` for all time).
      Period totals come from `post_stats_daily`. All-time totals come from summing the post counters.
    - `daily`: the last 30 days (or 7 when `days === 7`), oldest first, with zero-filled gaps.
    - `byChannel`: share totals per channel for the period.
    - `topPosts`: the top 10 by views in the period. All time uses the post counters.
      Each row has id, title, slug, views, likes and shares.
  - `queryPostEngagement(db, postId)` → that post's totals, 30-day `daily`, `byChannel`, and `likeSources`.
    `likeSources` is `post_likes` grouped by `ipHash`: `{ source: ipHash.slice(0, 8), ipHash, count, lastAt }`,
    sorted by count desc and capped at 50 rows, with `flagged: count >= 3`.
    Send the full `ipHash` only to admins, as the identifier for removal. Display only the 8-char prefix.
- Management mutations. Each one checks `can(actor.role, "blog:engagement")`, throws `Forbidden` otherwise,
  and calls `logAudit`:
  - `removeLikesFromSource(db, actor, postId, ipHash)` deletes the matching `post_likes` docs, then
    `$inc likes: -deletedCount` (clamp: use an update pipeline with `$max: [0, …]`), then
    `bumpDaily({ likes: -deletedCount })` for today. Audit action `post.likes_remove`, detail `"Removed N like(s) from source abcd1234"`.
  - `resetPostStats(db, actor, postId, which: ("views" | "likes" | "shares")[])`:
    - views → `views: 0`, delete its `post_views`, and zero `views` in its daily docs.
    - likes → `likes: 0`, delete all its `post_likes`, and zero `likes` in daily docs.
    - shares → all channels 0, delete its `post_shares` (match `_id` by prefix `^${postId}:`), and zero shares in daily docs.

    Audit action `post.stats_reset`, detail = the list.
  - `setPostStatsHidden(db, actor, postId, hidden)`. Audit action `post.stats_hide` / `post.stats_show`.
- **Post deletion cascade:** in `deletePost` (`src/lib/blog/posts.ts`), after `posts.deleteOne`, delete the post's
  `post_likes`, `post_stats_daily`, `post_shares` and `post_views` (`_id` prefix `^${postId}:`).

## Permissions

Add the `AdminAction` value `"blog:engagement"` to `src/lib/admin/permissions.ts`, for owner and admin only.
Viewing stats uses the existing `"blog:view"` (all roles).

## Public API routes (all `Cache-Control: no-store`)

| Route | Body / query | Response |
| --- | --- | --- |
| `GET /api/blog/engagement?slug=` | slug (same zod schema as the view route) | `{ views, likes, shares, liked, hidden }`. 404 if not live. Sets the visitor cookie if it's new. |
| `POST /api/blog/like` | `{ slug, liked: boolean }` | `{ liked, likes, tracked, limited? }`. Sets the visitor cookie if it's new. |
| `POST /api/blog/share` | `{ slug, channel }` | 204 |
| `POST /api/blog/view` (exists) | unchanged | unchanged, plus daily stats, no-track and bot skip |

- Rate limit with `consumeRateLimit` keyed `blog-like:${ipHash}` (30/min) and `blog-share:${ipHash}` (30/min).
  The GET route uses `blog-eng:${ipHash}` (120/min). Over the limit → 429.
- Like and share also require the `visitor_id` cookie to already exist. The engagement GET sets it on page load.
  If it's missing, return 400 `{ error: "Reload the page and try again." }`. This stops cookie-less scripts from
  minting a new identity per request.
- 503 when Mongo isn't configured, like the view route. The UI then hides the counts and the like button gracefully.

## Public UX

- New client component `src/components/blog/EngagementProvider.tsx` (context) fetches `/api/blog/engagement` once
  per article and exposes `{ data, setLiked, recordShare }`. Wrap the article in it in `src/app/blog/[slug]/page.tsx`.
  The admin preview page doesn't render it.
- **Article header meta** (`ArticleView` meta row): add `<span>1.2k views</span>` after the reading time once the
  data has loaded. Before it loads, render nothing (no layout jump: it's inline text). Hidden when `hidden`.
  Format numbers with `Intl.NumberFormat("en", { notation: "compact" })`.
- **Like button** (`LikeButton.tsx`) at the start of `.blog-aend`, above the share row. It's a heart icon plus the count:
  - `<button aria-pressed={liked} aria-label={liked ? "Unlike this post" : "Like this post"}>`
  - Optimistic: the count and pressed state flip immediately. Reconcile with the response. Roll back and briefly
    show "Couldn't save your like" on error.
  - `limited: true` → roll back and show "Too many likes from your network."
  - Debounce: ignore clicks while a request is in flight.
  - Filled heart in `var(--accent)` when liked. Small scale-pop animation, disabled under `prefers-reduced-motion`.
  - When `hidden`, the button still works but shows no count.
- **Share row** (`ShareRow.tsx`):
  - Every button also calls `recordShare(channel)`. Use `navigator.sendBeacon` with a `fetch` keepalive fallback,
    as in `ViewBeacon`.
  - Add a **Share…** button, rendered only when `navigator.share` exists (check after mount to avoid a hydration
    mismatch). Record `native` only when the `navigator.share()` promise resolves. Ignore `AbortError`.
  - Show "Shared N times" in muted text at the end of the row when N > 0 and not hidden.
- **Blog index cards** (`src/app/blog/page.tsx`) and the homepage **Writing** section: add views and likes to the
  card meta (e.g. `1.2k views · 34 likes`). Add `views`, `likes` and `hideStats` to `PublicPostSummary`. These are
  cached values, which is fine. Omit them when `hideStats` is set or both are 0.
- Light and dark mode both checked. Keyboard focus visible on the like and share buttons.

## Admin UX

1. **Blog list** (`PostsListClient.tsx`):
   - Add Likes and Shares columns next to Views. Show "–" for 0, as Views does today.
   - Sorting via a `sort` search param: `updated` (default, current behaviour), `views`, `likes`, `shares`.
     Clicking a column header sets it. Sorting happens in `queryAdminPosts` (MongoDB sort; shares sort by the sum via
     an aggregation `$add`, or a stored `sharesTotal` that you keep in sync, your choice). Mark the sorted column
     with `aria-sort`.
   - Add an "Engagement" link button in the page head → `/admin/blog/engagement`.
   - Add a "Stats" row action → `/admin/blog/[id]/stats`.
   - On a narrow screen the new columns hide like the existing Views column does.
2. **Engagement page** `src/app/admin/(panel)/blog/engagement/page.tsx` (viewer+):
   - A segmented control for 7 days / 30 days / All time (`?range=7|30|all`, default 30).
   - Three stat cards: Views, Likes, Shares. Each shows the total and a delta vs the previous period
     ("▲ 12% vs prev 30 days", green/red via the existing tokens; nothing for all time).
   - A daily chart: grouped bars or three small stacked rows in the style of the overview's "Moves per day".
     Each bar has a `title` tooltip with the exact number. Include a visible legend.
   - Share channels: four rows with label, bar and count.
   - Top posts table: title (links to its stats page), views, likes, shares.
   - Empty state: "No engagement yet. Stats appear once your posts get readers."
3. **Per-post stats** `src/app/admin/(panel)/blog/[id]/stats/page.tsx` (viewer+):
   - Header with the post title, a link to the public post ↗, and a link to Edit.
   - The same stat cards (all-time totals), 30-day chart and channel rows.
   - **Likes by source** table: source (8-char prefix, mono), likes, last liked (relative time), and a flagged
     badge when count ≥ 3. For `blog:engagement` roles there's a "Remove" button with a confirm dialog:
     "Remove N likes from source abcd1234? This can't be undone."
   - **Manage** card, `blog:engagement` roles only:
     - A "Hide counts on the public page" switch that calls `setPostStatsHiddenAction`.
     - "Reset counters…" opens a dialog with checkboxes (Views, Likes, Shares). The confirm button is disabled
       until the post title is typed exactly. Untitled posts use the slug.
   - Viewers see everything except the Manage card and the Remove buttons.
   - Invalid or unknown id → `notFound()`.
4. **Overview** (`src/app/admin/(panel)/page.tsx`): add a "Blog (7d)" card to the stats grid with views and likes
   for 7 days and the top post title under it in muted mono. It links to the Engagement page.
   Extend `queryAdminOverview` (or call `queryEngagementSummary` alongside it).
5. Server Actions in `actions.ts`: `removeLikesFromSourceAction`, `resetPostStatsAction`, `setPostStatsHiddenAction`.
   Each validates with zod, calls `requireAdminAction("blog:engagement")` and the mutation, then
   `updateTag("posts")` + `updateTag(\`post:${slug}\`)` (the cached index shows counts and `hideStats`),
   and `revalidatePath` for the stats page.

## Tasks (one commit each, Conventional Commits, e.g. `feat(engagement): …`)

1. **Shared visitor helper + no-track cookie + bot check.** Create `src/lib/visitor.ts`, move the chess helpers, and
   set `blog_notrack` on every admin sign-in path. Add unit tests for `isLikelyBot` and `hashBlogVisitor`.
   *Accept:* chess tests pass unchanged. Signing in sets `blog_notrack` with `Path=/`.
2. **Data model + engagement library.** Add the `PostDoc` fields, the collections, indexes, `engagement.ts` (all
   functions above), the `"blog:engagement"` permission, and the `deletePost` cascade. Add tests in
   `src/lib/blog/engagement.test.ts`.
   *Accept:* the tests below under "Tests" pass.
3. **Public routes.** Add the engagement GET, like and share routes, and update the view route (daily stats,
   no-track, bots). Add route tests following `src/app/api/blog/view/route.test.ts`.
   *Accept:* status codes and bodies as in the table above. No `updateTag` in these routes.
4. **Article UI.** Add the EngagementProvider, view count in the meta row, LikeButton, and the ShareRow tracking,
   Share… button and share count.
   *Accept:* liking, reloading and unliking works. The count survives a reload. No hydration warnings in the console.
   `next build` still prerenders `/blog/[slug]`.
5. **Index cards.** Add views and likes on `/blog` and the homepage Writing section.
6. **Admin blog list.** Add the columns, sorting, and the Engagement and Stats links.
7. **Engagement page.**
8. **Per-post stats page + management actions.**
9. **Overview card + README.** Add the Overview card and a short "Blog engagement" section to `README.md` covering
   what's counted, no-track, bots, and how to reset.

## Tests (mongodb-memory-server)

- Liking twice → `likes` 1. Unliking twice → `likes` 0. It never goes negative.
- Two concurrent `setLike(true)` calls for the same visitor (`Promise.all`) → `likes` 1.
- A 4th distinct visitor from the same `ipHash` on the same post → `limited`, `likes` stays 3.
- A share on the same channel twice within 24 h → counted once. A different channel → counted.
- Each view, like, unlike and share updates today's `post_stats_daily` doc correctly.
- `queryEngagementSummary` zero-fills gaps, and the previous period is computed correctly (seed two periods).
- `removeLikesFromSource` adjusts `likes` and today's daily stats, and is audit-logged.
  Called by a viewer → throws `Forbidden`.
- `resetPostStats(["likes"])` leaves views and shares untouched.
- `deletePost` removes the post's likes, shares, views and daily stats, and leaves other posts' data alone.
- `hideStats` → `getPublicEngagement` returns null counts but the correct `liked`.
- Routes: no-track cookie → no write. Bot user agent → no write. Missing visitor cookie on like → 400.
  Unknown slug → 404. Over the rate limit → 429.

## Manual steps for Carls (not for the agent)

- Nothing to provision. After deploying, sign in to `/admin` once on each device you read the blog from, so your
  own visits aren't counted.

## Definition of done

- All 9 tasks are committed on `feat/engagement`. `npm run lint`, `npm test` and `npm run build` are green.
- No new npm dependencies.
- Article pages are still prerendered/cached. Counts load client-side.
- Every management action is server-checked, audit-logged, and hidden from viewers.
