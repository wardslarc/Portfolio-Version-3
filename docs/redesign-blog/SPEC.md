# Spec: blog and admin sign-in in the "ink by night" style

Owner: Carls. Planned and reviewed by Claude; coded by Gemini. Branch: `redesign/ink-by-night` (same branch as the
homepage redesign). Visual reference: `mockups/` (see its README). Tasks: `TASKS.md`.

## 1. Goal

`/blog`, `/blog/tag/[tag]`, `/blog/[slug]`, the 404 page, `/admin/login` (all three steps) and `/admin/invite/[token]`
get the homepage's look: its header, fonts, palette, tape, handwritten notes, ink shadows and a light motion layer.
Behavior, data, URLs, SEO and security stay exactly as they are.

## 2. Decisions (Carls, 2026-11-28)

| # | Decision |
|---|---|
| BD1 | The blog **keeps its light/dark toggle** and stored preference (`cde-theme`, the theme script, OS fallback). Light = paper `#F3F1EC` with the graph-paper grid. Dark = ink `#16161A` with coral accents. |
| BD2 | The **homepage header** (`HomeHeader`) is used on the blog and 404 too, in a `site` variant (§5.1). The old `src/components/Header.tsx` is deleted at the end. |
| BD3 | Only the **sign-in screens** are restyled: login (credentials, two-factor code, backup codes) and invite. The admin panel (`src/app/admin/(panel)/**`) keeps its look, except that the post preview renders with the new blog styles (it shares `ArticleView`). |
| BD4 | The sign-in screens are **always dark** (dark grid page, paper card), whatever theme is stored. |
| BD5 | **No Lenis, no GSAP, no pins** off the homepage. Motion is CSS: load-in keyframes, scroll-driven animations (`animation-timeline: view()`/`scroll()`) as progressive enhancement, and the View Transitions API. Browsers without scroll-driven animations show everything in its final state (no fallback script). |
| BD6 | **Reduced motion = calm tier** (same rule as homepage D25): with `prefers-reduced-motion: reduce`, every animation becomes an opacity fade or is removed; nothing moves, slides, drops, shakes, grows or circles. |
| BD7 | The theme toggle switches with a **circle reveal** from the toggle button. ~~Cover morph list → post~~: dropped in R3 (2026-11-28) because the blog's pages stream in behind `<Suspense>`, so React's shared-element pair never forms (see `REVIEW-R3.md` R3.2). |
| BD8 | The invite page gets a small password-length bar (visual only, `aria-hidden`). Validation stays on the server. |

## 3. What must not change

- `src/app/api/**`, `src/lib/**` (including `src/lib/admin/auth-actions.ts`, `auth.ts`, `crypto.ts`), `src/lib/theme.ts`,
  `next.config.ts`, the CSP, `src/proxy.ts` if present.
- Form contracts: every field `name`, `type`, `autoComplete`, `required`, `minLength`/`maxLength`, the server actions
  each form calls, and the order of steps. Two-factor still submits one field named `code`.
- All user-facing copy that exists today (labels, errors, notices, button text, page titles, metadata, JSON-LD).
  Mockup copy is used only where today's page has none (§8).
- Blog data flow: `PostList` props, pagination, tag routing and redirects, `EngagementProvider`, likes, shares, views,
  `CodeCopy`, `Toc` behavior (IntersectionObserver), RSS, sitemap, OG images.
- The homepage (`/`): `HomeHeader`'s `home` variant renders exactly as now. R1/R2/T16 checks of the homepage must
  still pass.

## 4. Architecture

### 4.1 New files

| File | What |
|---|---|
| `src/styles/ink.css` | Tokens (§6), shared pieces (§7) and the motion layer (§9). Global CSS, every rule scoped under `.ink`. |
| `src/styles/ink-blog.css` | Every `.blog-*` rule, rewritten in the new style and scoped under `.ink` (§10). Includes the syntax-highlight tokens. |
| `src/components/ink/InkScope.tsx` | Server component: `<div className={\`ink ${homeFontVariables}\`}>{children}</div>`; imports `ink.css` and `ink-blog.css`. Optional prop `forceDark` adds `ink-dark` (sign-in screens). |
| `src/components/ink/ThemeToggle.tsx` | Client. The toggle logic moved from `Header.tsx` (same `useSyncExternalStore`, same storage key, same aria-labels), plus the circle reveal (§9.4). |
| `src/components/ink/InkFooter.tsx` + `.module.css` | Dark "Let's build *something.*" band and the footer row (§5.4). Replaces `BlogFooter`. |
| `src/components/ink/ReadingProgress.tsx` | A 3px coral bar under the sticky header on posts (§9.3). Pure CSS; renders a `<span aria-hidden>`. |
| `src/components/admin-auth/AuthShell.tsx` + `.module.css` | Dark sign-in page: top bar, headline column, paper card slot (§11.1). |
| `src/components/admin-auth/OtpInput.tsx` | Six digit boxes that submit one hidden `code` field (§11.3). |
| `src/components/admin-auth/useShake.ts` | Returns a class that re-triggers the shake each time a new error arrives (§11.5). |

### 4.2 Changed files

- `src/components/home/HomeHeader.tsx` (+ module CSS): `variant?: "home" | "site"` (default `home`), §5.1.
- `src/app/blog/layout.tsx`: wraps everything in `<InkScope>`, uses `<HomeHeader variant="site" />` and `<InkFooter />`,
  keeps the skip link and `<main id="main">` (drop the `wrap` class; sections size themselves). Exports a `viewport`
  with `themeColor` light `#F3F1EC`, dark `#16161A` (both media-scoped, as today).
- `src/app/blog/page.tsx`, `src/app/blog/tag/[tag]/page.tsx`: new hero markup (§5.2). Data code untouched.
- `src/components/blog/PostList.tsx`, `ArticleView.tsx`, `Breadcrumbs.tsx`, `LikeButton.tsx`, `ShareRow.tsx`, `Toc.tsx`:
  markup and classes for the new look only (§5.2–§5.3). Logic untouched.
- `src/app/not-found.tsx`: `InkScope` + site header + footer (§5.5).
- `src/app/admin/(auth)/login/LoginClient.tsx`, `src/app/admin/(auth)/invite/[token]/InviteClient.tsx`: render inside
  `AuthShell` (§11). Logic untouched except the UI state named in §11.
- `src/app/admin/(panel)/blog/[id]/preview/page.tsx` and `EditorClient.tsx`: wrap the `ArticleView` they render in
  `<InkScope>` so the preview matches the blog.
- `src/app/globals.css`: remove the `.blog-*` rules and the syntax-token rules (now in `ink-blog.css`); add the
  `:root:has(.ink)` block (§6.3). Nothing else.
- `src/app/admin/admin.css`: remove `.admin-auth-*`, `.admin-backup-grid` only if nothing else uses them (grep first).

### 4.3 Deleted at the end (task K10)

`src/components/Header.tsx`, `src/components/blog/BlogFooter.tsx`, and the global CSS only they used
(`.site-header` and friends), after a grep proves nothing else imports or uses them.

## 5. Pages

### 5.1 Header (`HomeHeader variant="site"`)

Same look as the homepage header (logo, links, coral "Let's talk"), with these differences:

- Logo is a `<Link href="/">`. Hash links get a `/` prefix (`/#work`, `/#night`, `/#contact`); "Blog" is a `<Link>` with
  `aria-current="page"` on `/blog` and below, shown with a 2px coral underline offset 6px.
- `ThemeToggle` (44×44, round, 1.5px border) sits between the links and the CTA, and also at the end of the mobile menu.
- Sticky as now (`HomeHeader.module.css` already is). Its colors come from `--home-bg`/`--home-fg` set by `.ink` (§6),
  so it follows the theme. In dark, every border and icon uses the foreground `#F3F1EC`; the CTA stays coral with
  `#16161A` text and border.
- The `home` variant is unchanged (no toggle, hash-only links, `#top` logo).

### 5.2 Blog list (`/blog`) and tag pages — mockup `BlogList.dc.html`

- **Hero** (graph-paper background, padding 96px top / 56px bottom; 56/32 below 760px):
  kicker `Blog` (Geist Mono 13px, .08em, uppercase, muted); h1 "Notes from building *things.*" in two masked lines
  (Bricolage 800, `clamp(52px, 8vw, 112px)`, line-height .9, -.05em; "things." in Instrument Serif italic, coral-text,
  with the hand-drawn underline SVG from the mockup); the existing description as lede (18px/1.6, max 560px); the
  Caveat note "plain English, promise ✎" (26px, coral-text, rotate -4deg) beside it.
  Tag pages: same hero with the existing breadcrumbs above, kicker `Tag`, h1 "Posts about *{tag}.*" (tag name in the
  serif), and the existing count line as lede. No Caveat note on tag pages.
- **Tag stickers** (`.blog-filters` / `.blog-fchip`, still `<Link>`s with `aria-current`): min-height 44px, padding
  0 16px, 1.5px border, radius 10px, sand fill (`--k-chip`), Geist Mono 13px; rotations cycle -1.5, 1, -.5, 1.5deg;
  current = ink fill with paper text (inverted in dark). Hover = the button lift (§7).
- **"Latest" featured card** (`.blog-feat`, page 1 only, still one `<Link>`): section label "Latest" (kicker + hairline
  rule); card = surface, 1.5px border, radius 18px, `8px 8px 0` shadow, rotate -.6deg, padding 28px, grid
  `1.15fr 1fr` gap 40px (one column below 760px); tape strip top-left; Caveat chip "fresh off the press!" off the
  top-right corner; cover in a radius-12 frame; meta (date · read time · views) in Geist Mono 12px uppercase; tags as
  `#tag` in mono coral-text; title Bricolage 800 `clamp(30px, 3.4vw, 44px)`; excerpt 17px; a "Read it →" pill drawn
  as a `<span>` (the whole card is already the link). Hover: rotate 0, shadow `12px 14px 0`.
- **"Older notes"** (`.blog-plist` → card grid): section label "Older notes". Cards in a grid of 3 columns at ≥1024px,
  2 at 760–1023px, 1 below 760px, gap 32px. Each card is the existing `<Link className="blog-pitem">` restyled as a
  card (surface, border, radius 18, `8px 8px 0` shadow, padding 20px): cover on top (16:9, radius 12, only if the
  post has one), meta, title (Bricolage 800 24px), excerpt (15px), tags. Rotations cycle -1.2, .8, -.6deg; even-index
  cards get a tape strip (alternate left/right). Hover straightens.
- **Pager** (`.blog-pager`): count in mono; "← Newer posts" / "Older posts →" as pills (§7).
- **Empty / loading** (`.blog-empty`): a dashed 1.5px card with the existing text, plus a Caveat note
  "more notes on the way ✎".
- Max content width 1240px, side padding 48px (20px below 760px).

### 5.3 Post (`/blog/[slug]`) — mockup `Post.dc.html`

- **Header block** (graph paper, padding 56px 0 72px): breadcrumbs (mono 12px, muted); meta row (date · read time ·
  views) in mono; h1 Bricolage 800 `clamp(40px, 5.6vw, 76px)`, line-height .95, -.045em, max-width 15ch, in one
  masked block; lede 20px muted, max 640px; tags as stickers (§5.2 style, they link to the tag pages; they move out of
  the meta row); author row: the existing 44–48px photo in a round 1.5px-bordered frame, name (600) and role, Caveat
  "← that's me" (24px, rotate -5deg).
- **Cover** (`.blog-cov`): pulled up 36px into the header block, max-width 980px, surface frame with 14px padding
  (8px below 760px), border, radius 20, `10px 10px 0` shadow, rotate -.8deg (0 below 760px), two tape strips. The image
  sits in an `overflow: hidden` radius-10 box (for the parallax, §9.3).
- **Body** (`.blog-awrap`): grid `minmax(0, 680px) 220px`, gap 72px, centered, margin-top 88px. Below 960px: one column,
  the TOC becomes a dashed box above the text. TOC (`.blog-toc`, only when it renders today): sticky at `top: 110px`,
  heading "on this page ↓" in Caveat 24px coral-text (replaces "On this page" visually; keep that text for screen
  readers via `aria-label`, which it already has), links 14px muted, current link = text color, 600, coral dot.
- **Prose** (`.blog-prose`): 18px/1.75 (17px below 760px); h2 Bricolage 800 32px (26px) with a 6px coral highlight
  (`#E8492A66`) at the baseline; h3 Bricolage 800 22px; links coral-text, underline offset 3px; blockquote =
  Instrument Serif italic 27px (23px) with a big coral “ at the left, no border; images/figures = surface frame,
  padding 12, border, radius 16, `8px 8px 0` shadow, rotate .6deg (0 on small), caption mono 12px; `pre` = dark
  panel `#16161A` (`#0F0F12` in dark with a `#F3F1EC33` border), radius 14, Geist Mono 14px/1.6, `overflow-x: auto`,
  with `CodeCopy`'s button restyled (36px tall, 1px `#F3F1EC33` border, mono 12px); inline code = sand chip, radius 6;
  tables = 1.5px border, mono header row; `hr` = 1.5px rule.
- **End** (`.blog-aend`): top rule, Caveat "liked it?", Like and share buttons as pills (44px, 1.5px border,
  surface); liked = coral fill with ink text and the heart pops; "Link copied" keeps its text and also shows a Caveat
  "copied!" pop above the button. Prev/next as two cards. "Keep reading" as cards (§5.2 style, no tape). Then a
  "written by Carls" bio card (Caveat title, the site's role line, "Let's talk →" pill to `/#contact`) with tape.

### 5.4 Footer (`InkFooter`)

Dark band (`#16161A`; `#0F0F12` with a `#F3F1EC33` top border in dark), radius `40px 40px 0 0` (28px below 760px),
margin-top 120px (80px), padding 96px 0 40px (64/32). "Let's build *something.*" (Bricolage 800
`clamp(48px, 7vw, 96px)`, "something." serif `#FF6A47`); line "Freelance builds, internal tools, or a full-time
role. Tell me what you're working on." (18px `#C9C5BB`); coral pill "Say hi →" to `/#contact`. Footer row (mono 12px,
`#C9C5BB`, top border `#F3F1EC33`): "© {year} Carls Dale Escalo · Makati, PH" (year from
`@/components/home/CopyrightYear`) and "RSS · Coded in Next.js · drawn in Clip Studio" (RSS links `/blog/rss.xml`).

### 5.5 404

`InkScope` + site header + footer. Graph-paper hero like §5.2 with kicker `404`, h1 "This page doesn't exist" in
the masked-line style, the existing sentence as lede, and "Home" / "Blog" as pills. Copy unchanged.

## 6. Tokens

### 6.1 Palette (`.ink`, light)

| Token | Light | Dark (`.ink-dark`, see §6.2) | Use |
|---|---|---|---|
| `--home-bg` | `#F3F1EC` | `#16161A` | page background (also used by `HomeHeader`) |
| `--home-fg` | `#16161A` | `#F3F1EC` | text |
| `--k-surface` | `#FBFAF7` | `#1F1F25` | cards, inputs, pills |
| `--k-muted` | `#4A463F` | `#C9C5BB` | secondary text |
| `--k-line` | `#16161A` | `#F3F1EC` | 1.5px borders |
| `--k-shadow` | `#16161A` | `#E8492A` | hard offset shadows |
| `--k-accent` | `#E8492A` | `#E8492A` | fills, tape base, progress bar, focus |
| `--k-accent-text` | `#B8361A` | `#FF6A47` | small coral text, links |
| `--k-chip` | `#E6E0D2` | `#2B2B33` | stickers, note chips, inline code |
| `--k-ph` | `#E9E6DF` | `#2B2B33` | image placeholders |
| `--k-rule` | `#16161A33` | `#F3F1EC33` | hairlines |
| `--k-tape` | `#E8492A99` | `#E8492A99` | tape strips |
| `--home-grid-line` | `rgb(128 128 128 / .1)` | same | graph paper |

Also define on `.ink` the fixed names `HomeHeader`/`HomeShell` read: `--home-paper #F3F1EC`, `--home-ink #16161A`,
`--home-coral #E8492A`, `--home-sand #E6E0D2`, `--home-menu-rule rgb(128 128 128 / .3)`.
Contrast is checked for both themes: muted on bg ≥ 7:1, accent-text on bg ≥ 4.5:1, `#16161A` on coral ≥ 5:1.

### 6.2 Dark selection (BD1, BD4)

`.ink` takes the dark values when any of these hold, and only then:

```css
:root[data-theme="dark"] .ink,
.ink.ink-dark { /* dark values */ }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .ink { /* dark values */ } }
```

`color-scheme` follows (`light`/`dark`). The sign-in `InkScope` passes `forceDark`, so its `.ink-dark` wins even with a
stored light theme.

### 6.3 Page background

The body background must match while overscrolling or before content paints. In `globals.css`:

```css
:root:has(.ink) { --bg: #F3F1EC; --ink: #16161A; }
:root[data-theme="dark"]:has(.ink), :root:has(.ink-dark) { --bg: #16161A; --ink: #F3F1EC; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]):has(.ink) { --bg: #16161A; --ink: #F3F1EC; } }
```

Not on `/` (`data-home` keeps its own block, which must still win there).

### 6.4 Type

Bricolage Grotesque 800 (`--font-bricolage`) for headings; Instrument Serif italic (`--font-instrument`) for accent
words and quotes; Geist (`--font-geist-sans`) for body; Geist Mono (`--font-geist-mono`) for meta; Caveat 700
(`--font-caveat`) for notes. Fonts come from `homeFontVariables` (`src/components/home/fonts.ts`) via `InkScope`; don't
create new font instances.

### 6.5 Breakpoints

Same as the homepage: narrow `< 760px` (`max-width: 759.98px`), medium 760–1023px, wide ≥ 1024px; the post body
switches to one column below 960px. The mockups' `@container page (max-width: 759px)` means `@media (max-width: 759.98px)`.

## 7. Shared pieces (in `ink.css`)

- **Graph paper** `.k-grid`: the two 1px linear-gradients with `--home-grid-line`, `background-size: 32px 32px`.
- **Tape** `.k-tape`: absolute, 110×28px (84–96px for small cards), `--k-tape`, rotated ±2–5deg, top -14px.
- **Note** `.k-note`: Caveat 700, coral-text, rotated -6…+6deg; **note chip** adds `--k-chip` fill and 4px 12px padding.
- **Serif accent** `.k-serif`: Instrument Serif italic, -.02em, coral-text.
- **Kicker** `.k-kicker`: Geist Mono 13px, .08em, uppercase, muted. Section label = kicker + a `1.5px --k-rule` line
  filling the row.
- **Pill** `.k-pill`: inline-flex, min-height 44px, padding 0 16–20px, radius 999px, 1.5px `--k-line` border,
  `--k-surface` fill, Geist 500 14–15px. **Coral pill** = `--k-accent` fill, `#16161A` text and border.
- **Lift on hover** (buttons, pills, stickers): `transform: translate(-3px, -3px); box-shadow: 5px 5px 0 currentColor`,
  `.2s`. **Cards**: hover straightens (`rotate: 0deg`) and the shadow grows to `12px 14px 0`, `.45s
  cubic-bezier(.2,.7,.2,1)`. Cards carry their tilt in `--rot` and use `rotate: var(--rot)` so animations and hover
  don't fight (homepage R2.1 lesson: never animate `transform` on an element that uses `rotate`).
- **Focus**: `outline: 3px solid #E8492A; outline-offset: 2px` on every interactive element (pills, stickers, inputs,
  digit boxes, cards).

## 8. Copy rules

Today's copy wins everywhere it exists. New copy, exactly as written (nothing else):

| Where | Text |
|---|---|
| Blog hero note | `plain English, promise ✎` |
| Featured chip | `fresh off the press!` |
| Featured card button | `Read it →` |
| Section labels | `Latest`, `Older notes` |
| Empty list note | `more notes on the way ✎` |
| Author note | `← that's me` |
| TOC heading (visual) | `on this page ↓` |
| Like row note | `liked it?` |
| Copy-link pop | `copied!` |
| Bio card | title `written by Carls`, button `Let's talk →`; body = `site.role` / the hero one-liner from `src/content` (don't write a new bio) |
| Footer | as §5.4 |
| Sign-in top bar link | `← back to the site` |
| Login kicker / note | `Portfolio control panel` (today's subtitle) / `staff only ✎` |
| Login side line | `Posts, messages, media and the chess board live behind this door.` |
| Code step kicker / note | `Step 2 of 2 · two-factor` / `check your inbox ✎` |
| Code step success stamp | `Verified` (decorative, `aria-hidden`; shown only after a successful verify, before the redirect) |
| Backup codes kicker / note | `First sign-in · one time only` / `keep these somewhere safe ✎` |
| Invite note / side line | `welcome aboard!` / `Pick your name and a password to create your account.` |
| Invite length bar text | `{n} / 12 characters`, then `long enough ✓` |

Headlines on the sign-in screens reuse today's h1 text split into two lines with the last word(s) in the serif:
"Admin / *sign-in.*", "Verify / *sign-in.*", "Save your / *backup codes.*", "Accept admin / *invite.*".

## 9. Motion

All timings in `ink.css`. Easing `cubic-bezier(.2,.7,.2,1)` unless stated. Every keyframe's last frame equals the
element's normal style, and every animation uses `animation-fill-mode: backwards`, so nothing is left in an animated
state and hover still works afterwards.

### 9.1 Keyframes

`lineUp` (translate 0 105% → 0), `fade`, `fadeUp` (opacity 0, translate 0 24px →), `slap` (opacity 0 scale 1.5 → 60%
scale .94 → 1), `drop` (opacity 0, translate 0 -36px, rotate `var(--r0)` → rotate `var(--rot)`), `settle` (opacity 0,
translate 0 70px, rotate `var(--rot) + 5deg` →), `write` (clip-path `inset(-20% 100% -20% 0)` → `inset(-20% 0 -20% 0)`,
`steps(14, end)`), `draw` (stroke-dashoffset 1 → 0 with `pathLength="1"`), `underline` (background-size 0% 6px →
100% 6px), `pop` (scale .4 → 1.15 → 1), `grow` (clip-path `inset(0 5% 0 5% round 40px 40px 0 0)` → `inset(0 …)`),
`progress` (scale 0 1 → 1 1), `parallax` (translate 0 -7% → 0 7%), `shake` (x: 0, -10, 9, -6, 4, 0 px over .45s),
`cardIn` (opacity 0, translate 0 -140px, rotate -9deg → rotate 1deg, `cubic-bezier(.2,.9,.25,1.2)`), `stamp`
(opacity 0 scale 2.2 rotate -24deg → scale .92 → scale 1 rotate -8deg), `drift` (graph-paper background-position
moves 32px over 8s, linear, infinite).

### 9.2 On load (plays once when the page renders)

| Page | Sequence (delay) |
|---|---|
| Blog list | kicker fade (.05s); h1 lines `lineUp` .9s (.15s, .27s); underline `draw` .8s (.95s); lede `fadeUp` .8s (.5s); note `write` .9s (1.2s); stickers `drop` .7s `cubic-bezier(.2,.9,.25,1.25)` (.65s + .08s each, `--r0` cycling 10, -8, 12, -10deg) |
| Tag page | same without the note and underline |
| Post | breadcrumbs fade (.05s); meta fade (.1s); h1 `lineUp` (.15s); lede `fadeUp` (.45s); tag stickers `drop` (.6s + .08s each); author `fadeUp` (.8s); "← that's me" `write` (1.3s); cover `drop` with `--r0: 4deg` (.35s); its two tapes `slap` .45s (1s, 1.12s) |
| 404 | kicker fade, h1 `lineUp`, lede `fadeUp`, pills `fadeUp` (.6s) |
| Sign-in screens | kicker fade (.05s); h1 lines `lineUp` (.15s, .27s); side line `fadeUp` (.5s); card `cardIn` .9s (.3s); tape `slap` (1.05s); note `write` (1.3s); digit boxes `pop` .45s (.75s + .06s each); backup tickets `drop` .6s (.9s + .07s each); background `drift` |

### 9.3 On scroll (inside `@supports (animation-timeline: view())` only)

`animation-timeline: view()` with `linear` timing. Ranges are **lengths** (changed in R3.1), so a reveal finishes after
a fixed scroll distance whatever the element's height:

| Element | Animation | Range |
|---|---|---|
| Section labels, prose h2/blockquote/pre, like row, footer heading and line | `fadeUp` | entry 0px → entry 160px |
| List cards, prose figures/images, bio card | `settle` | entry 0px → entry 260px (cards in a row: start 0/40/80px, end 260/300/340px) |
| Tape on those cards | `slap` | entry 160px → entry 260px |
| Blockquote “ | `pop` | entry 80px → entry 220px |
| h2 highlight | `underline` | entry 60px → entry 200px |
| Footer band | `grow` | entry 0px → entry 320px |
| Featured and post cover image (inside its frame, scaled 1.16) | `parallax`, `animation-fill-mode: both` | cover |
| Reading progress bar (post) | `progress`, `animation-timeline: scroll(root)`, fill both | whole page |

The **featured card** is first-screen content, so it uses a time-based load-in instead (R3.1): `settle` .9s at .55s,
its tape `slap` at 1.2s, its chip `pop` at 1.35s.

Don't put `sc-*` on paragraphs one by one in the prose (it's server HTML); use selectors like
`.blog-prose > h2`, `.blog-prose > blockquote`, `.blog-prose > pre`, `.blog-prose img`.
Without support: no scroll animations, no progress bar (`display: none`), content fully visible.

### 9.4 Theme circle (BD7)

`ThemeToggle` on click: compute the button's center, set `--vx`/`--vy` on `<html>`, then
`document.startViewTransition({ update: () => applyTheme(next), types: ["theme"] })`. CSS:

```css
html:active-view-transition-type(theme)::view-transition-old(root),
html:active-view-transition-type(theme)::view-transition-new(root) { animation: none; mix-blend-mode: normal; }
html:active-view-transition-type(theme)::view-transition-new(root) {
  animation: k-circle .75s cubic-bezier(.2,.7,.2,1);
}
@keyframes k-circle { from { clip-path: circle(0 at var(--vx) var(--vy)); } to { clip-path: circle(150vmax at var(--vx) var(--vy)); } }
```

If `startViewTransition` is missing, throws, or reduced motion is on: switch instantly. `applyTheme` is the existing
logic (set `data-theme`, write `cde-theme`, ignore storage errors). Navigations must not get the circle.

### 9.5 Cover morph — dropped

Removed in R3 (see BD7). Don't add `<ViewTransition>` to blog components.

### 9.6 Calm tier (BD6)

Under `@media (prefers-reduced-motion: reduce)`: every `lineUp`, `fadeUp`, `drop`, `settle`, `slap`, `pop`,
`write`, `cardIn` becomes `fade` (same delay/timeline); `draw`, `underline` (show the full highlight), `grow`,
`parallax`, `drift`, `shake`, `stamp` (just appear) and the progress bar are removed; the theme switches instantly;
(the cover morph was dropped, BD7).

### 9.7 Activity (cacheComponents)

Next keeps visited routes in the DOM, hidden. Hiding and showing restarts CSS load-in animations; that's accepted.
No component may leave listeners, timers or attributes behind when hidden: `ThemeToggle`'s store subscription, the
shake timer, `OtpInput` and the copy timers clean up in their effects. The `--vx`/`--vy` properties on `<html>` are
harmless and may stay.

## 10. Blog CSS (`ink-blog.css`)

Rewrite every `.blog-*` rule that exists today (see the class list in `globals.css`) under `.ink`, following §5. Keep
every class name the components and server HTML use (`.blog-prose`, `.blog-code-copy`, `.blog-toc .on`, `hljs-*`,
…). The syntax colors use today's **dark-theme** values in both themes, because the code panel is always dark. New
class names for new elements use the `k-` prefix. No class may be defined twice in one file (D23 rule).

## 11. Sign-in screens

### 11.1 `AuthShell`

Props: `kicker`, `title: [string, string]` (second part in the serif), `lede?`, `note` (Caveat text on the card),
`children` (the card content), `back?: boolean` (top-bar link, default true; hidden on the backup-codes step).
Layout: full-height (`min-height: 100dvh`) dark page `#16161A` with a `rgb(243 241 236 / .05)` 32px grid; top bar
(padding 20px 48px; 16px 20px narrow) with the onigiri logo + "carls.dale.escalo" linking `/` and "← back to the
site"; a centered wrapping row (gap 96px; 32px narrow) of the headline column (max 420px; kicker mono 13px
`#C9C5BB`; h1 Bricolage 800 `clamp(52px, 7vw, 104px)` in two masked lines; lede 18px `#C9C5BB`) and the card (paper
`#F3F1EC`, ink text, max-width 420px, padding 32px (24px narrow), radius 20, `10px 10px 0 #E8492A` shadow (6px
narrow), rotate 1deg (0 narrow), tape, the Caveat note `#FF6A47` 26px off its top-right). The card holds a
`role="alert"` / `role="status"` area for errors and notices exactly as today.

### 11.2 Fields and buttons (inside the paper card)

Labels Geist 500 14px; inputs min-height 46px, 1.5px `#16161A` border, radius 12, `#FBFAF7`; primary button = coral pill
50px tall, full width, text "{today's label} →" with the arrow nudging 4px on hover; secondary actions (`Use backup
code`, `Resend (…s)`, `Back`, `Copy codes`) = 44px outline pills in a wrapping row. Alerts: 1.5px border, radius 12,
error `#E8492A22` fill with `#8F2A14` text, ok `#1F7A4D1F` fill with `#165C3A` text. The "Trust this device for 30
days" checkbox: custom 24px box (1.5px border, radius 6) with a coral tick that pops in; it stays a real
`<input type="checkbox" name="trustDevice">` inside its `<label>`.

### 11.3 `OtpInput` (code step, email-code mode)

- Six `<input>`s in a `<fieldset>` with `<legend>6-digit code</legend>`; each `inputMode="numeric"`,
  `maxLength={1}`, `aria-label="Digit n of 6"`, 62px tall (54px narrow), Geist Mono 26px, filled boxes turn sand.
  The first has `autoComplete="one-time-code"` and `autoFocus`; the others `autoComplete="off"`.
- One `<input type="hidden" name="code">` carries the joined value. The visible boxes have **no `name`**.
- Typing a digit moves focus right; Backspace on an empty box moves left; non-digits are ignored; pasting (or an
  autofill that drops several digits into one box) spreads up to 6 digits across the boxes.
- Backup-code mode renders today's single text input (`name="code"`, `placeholder="XXXX-XXXX"`) instead, and no
  hidden input.
- Don't add client-side errors. A hidden input can't be `required`, so an incomplete code now reaches the server,
  which answers with its existing message ("Enter your code."); that replaces today's browser tooltip and is accepted.

### 11.4 Steps

| Step (today's) | Headline | Card |
|---|---|---|
| credentials | "Admin / *sign-in.*", kicker `Portfolio control panel`, side line (§8) | invited notice and errors as today; Email; Password; "Continue →" ("Checking…" while pending) |
| code | "Verify / *sign-in.*", kicker `Step 2 of 2 · two-factor`, lede = today's sentence ("Enter the 6-digit code sent to {masked}." / backup sentence) | error/notice; `OtpInput` or backup field; trust-device box; "Verify & sign in →" ("Verifying…"); row: Use backup code ⇄ Use email code, Resend (countdown as today), Back |
| backup_codes | "Save your / *backup codes.*", kicker `First sign-in · one time only`, lede = today's sentence | codes as tear-off tickets (2-column grid, dashed 1.5px border, radius 10, half-circle notches on both sides, mono 17px, tilts cycling -1.5, 1, .5, -1, 1.5deg); "Copy codes"/"Copied" pill with a Caveat "copied!" pop; "Continue to Admin →" coral pill. No top-bar back link. |
| invite | "Accept admin / *invite.*", kicker = today's `{email} · {role}`, side line (§8) | error as today; Your name; Password (min 12 characters) + the length bar (6px, sand track, coral fill → green `#1F7A4D` at 12+, `aria-hidden`, plus the mono text from §8); Confirm password; "Create account →" ("Creating account…") |

The "Verified" stamp (§8) shows only if the verify action returns success before navigating; if the action
redirects immediately, skip it (don't delay the redirect).

### 11.5 Shake

`useShake(error)` returns `"k-shakeA"`/`"k-shakeB"`, alternating each time a **new** error value arrives (compare with
the previous one in a ref), and `""` when there's no error. The card applies it. Calm tier: no shake.

### 11.6 Security checks

Unchanged server actions and field names; the hidden `code` field is the only new input and holds exactly the six
digits; no code, password or email is logged, stored in `localStorage`, or put in a URL; `autoFocus` stays where it is
today; no new third-party requests (fonts come from `next/font`, already self-hosted). The admin `robots` metadata
(`noindex`) is unchanged.

## 12. Accessibility

Real `<button>`/`<a>`/`<input>` + `<label>` everywhere; decorative tape, notes, stamps, underline SVGs and the
length bar are `aria-hidden`; every target ≥ 44px; focus rings visible on dark and light; contrast per §6.1; the
masked heading lines keep the heading's full text in one element (split only with spans). Lighthouse Accessibility
≥ 95 on `/blog`, a post and `/admin/login`.
