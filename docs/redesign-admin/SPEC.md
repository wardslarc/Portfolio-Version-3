# Spec: admin panel in the "ink by night" style

Owner: Carls. Planned and reviewed by Claude; coded by Gemini. Branch: `redesign/admin-ink`, cut from `main` after
the homepage/blog redesign merge (`62aedf0`). Visual reference: `mockup.html` in this folder (artifact
https://claude.ai/artifact/GEyYirQ462r2eTUKgk6ZnU). Tasks: `TASKS.md`.

## 1. Goal

Every page under `src/app/admin/(panel)/**` (Overview, Messages, Blog list, editor, engagement, post stats, Media,
Chess, Admins) gets the ink look the public site and the sign-in screens already have: paper/ink palette with one
coral accent, Bricolage headings, Geist Mono meta, 1.5px ink lines, hard offset shadows. It stays a **working tool**:
calmer than the blog, no tilt or tape on anything you read or type in. Behavior, data, URLs, permissions and copy stay
exactly as they are.

## 2. Evaluation of today's admin (2026-11-28)

| Finding | Where | Consequence for this spec |
|---|---|---|
| The panel is the last screen in the old look: Geist on `#fafaf9`, 1px grey lines, **blue** accent `#2f5bd3` / `#8aa8ff`. The sign-in screens right before it are already ink. Signing in jumps from the dark ink card into a different product. | `src/app/admin/admin.css` (1,876 lines), `globals.css` `:root` tokens | Restyle the panel, not the sign-in. |
| All styling is in **one global sheet** with `admin-*` class names, driven by the legacy tokens `--bg --surface --ink --muted --faint --line --accent --ok --wait --danger --sq-* --hl-*`. | `admin.css`, ~60 class names used by 15 components | Keep every class name. Remap the legacy tokens inside the panel (§5), then restyle class by class. No CSS modules, no renames. |
| **~97 inline `style={{…}}`** blocks, many setting colors, radii, fonts (dashboard bars, country list, message dates, slug warnings, chart rows). | `page.tsx` 14, `AdminsClient` 16, `PostStatsClient` 12, `MessagesClient` 11, `ChessAdminClient` 11, `EditorClient` 10, `EngagementCharts` 7, `engagement/page` 7, `MediaLibraryClient` 7, `PostsListClient` 2 | Visual inline styles move into named classes (§8). Pure layout ones may stay. |
| `admin-auth-sub` (34 uses) and `admin-auth-wrap/card` (Suspense fallback) are leftovers from the old sign-in, now used as "muted paragraph" and "loading". | panel pages, `(panel)/layout.tsx` | Restyle them under the panel scope; don't rename (cuts churn). |
| The panel follows `cde-theme` / OS dark already, but has **no toggle**; the public site does. | `globals.css`, `AdminShellNav.tsx` | Add the existing `ThemeToggle` to the sidebar (AD1). |
| Fonts for Bricolage, Instrument Serif and Caveat only load inside `InkScope`. | `src/components/ink/InkScope.tsx` | Wrap the panel in `InkScope` (§4). |
| The editor preview already renders inside `<InkScope contained>`; the post preview page too. | `EditorClient.tsx:737`, `blog/[id]/preview/page.tsx:74` | Leave both as they are; nested `.ink` is fine. |
| Mobile (≤ 760px) turns the sidebar into a sticky top bar with a scrolling tab strip and stacks tables (`stack-mobile`). It works. | `admin.css:798–930` | Keep the structure; restyle only. |
| Can't screenshot the panel without signing in (real Mongo + email 2FA). | review | Carls signs in once in the review Chrome (TASKS "Review set-up"). |

## 3. Decisions (proposed by Claude, Carls to confirm)

| # | Decision |
|---|---|
| AD1 | The panel **follows the stored theme** (`cde-theme`, OS fallback), like the blog. `ThemeToggle` (`src/components/ink/ThemeToggle.tsx`, unchanged) sits in the sidebar footer beside "Sign out", and in the mobile top bar row. |
| AD2 | The **sidebar is always ink**: `#16161A` in light, `#0F0F12` with a `#F3F1EC33` right border in dark. Paper text, coral active pill. This is the "by night" half; the desk (main area) is graph paper in light. |
| AD3 | **Calm personality.** Tilt, tape and Caveat notes only on: the four Overview stat cards (tilt + tape on the first), the sidebar note, the empty-state note. Tables, forms, the editor, dialogs, charts and the chess board stay straight. Working cards get a small `4px 4px 0` shadow; stat cards `8px 8px 0`. |
| AD4 | **Token bridge, no renames.** Class names, component structure and props stay. Inside `.admin-shell` the legacy variables are remapped to ink values (§5), so existing inline `var(--muted)` etc. pick up the new palette for free. |
| AD5 | **Motion is CSS only and small**: page heading fade-up, stat cards drop in, toast slaps in, dialog fades up. No scroll-driven animation, no GSAP/Lenis, no view transitions besides the theme circle that `ThemeToggle` already does. Reduced motion = calm tier (fade or nothing). |
| AD6 | The **chess board** uses the homepage night colors in both themes (`--sq-l #E9E6DF`, `--sq-d #8E8A80`, coral highlights), so it looks like the board visitors see. |
| AD7 | The mobile browser bar is ink: `(panel)/layout.tsx` exports `viewport = { themeColor: "#16161A" }` (the top bar is ink in both themes). |

## 4. Architecture

### 4.1 Changed files

| File | Change |
|---|---|
| `src/app/admin/(panel)/layout.tsx` | Wrap the `.admin-shell` **and** the Suspense fallback in `<InkScope>` (not `contained`, not `forceDark`). Export `viewport` (AD7). Data code (`requireAdmin`, unread count) untouched. |
| `src/app/admin/(panel)/AdminShellNav.tsx` | Add `<ThemeToggle />` to the footer row; add the onigiri mark (`<Onigiri variant="logo" />` from `@/components/home/Onigiri`, as `AuthShell` does) before "Admin"; add the sidebar note (§9). Links, `aria-*`, scroll-into-view effect, sign-out form unchanged. |
| `src/app/admin/admin.css` | Token bridge (§5), every panel rule restyled (§6–§7), new classes for the inline styles (§8), motion (§10). Rules keep their selectors. The old `.admin-auth-*` and `.admin-backup-grid` rules: delete only those the grep shows unused (`admin-auth-sub` is used; keep it). |
| Panel components listed in §2 | Replace visual inline styles with classes (§8). Markup otherwise unchanged; no logic changes. |
| `src/app/admin/(panel)/blog/_components/EngagementCharts.tsx` | Classes only (§7.6). |

### 4.2 Not touched

- `src/lib/**`, `src/app/api/**`, `src/app/admin/api/**`, `src/proxy.ts`, `next.config.ts`, the CSP, all tests.
- `src/app/admin/(auth)/**`, `src/components/admin-auth/**` (sign-in is done).
- `src/styles/ink.css`, `src/styles/ink-blog.css`, `src/components/ink/**`, `src/components/home/**`, `src/app/blog/**`,
  `src/app/page.tsx`, `src/app/globals.css`. (Use what they export; don't edit them. If you think one needs a change,
  stop and report.)
- Server actions, form field `name`s, `type`s, `required`, `autoComplete`, permissions checks, `href`s, query params,
  `aria-*` attributes, all visible copy (labels, headings, buttons, empty states, errors, toasts, page metadata).
- The editor preview and `/admin/blog/[id]/preview` (`InkScope contained` + `ArticleView`): unchanged.

### 4.3 Scope selector

Every new or rewritten rule in `admin.css` is scoped `.ink .admin-…` (or under `.ink .admin-shell`). That raises
specificity above the old `globals.css` rules and keeps the sheet inert outside the panel. `dialog.admin-dialog`
renders in the top layer but stays a DOM child of the shell, so it inherits the scope; confirm in R1.

`.ink` (from `ink.css`) is a `min-height: 100dvh` flex column: give `.ink > .admin-shell` `flex: 1` and make the
fallback center itself the same way.

## 5. Tokens (token bridge)

Set on `.ink .admin-shell` (and on `.ink .admin-auth-wrap` for the fallback). Values per theme; dark applies under the
same three selectors `ink.css` uses (`:root[data-theme="dark"] .ink …`, `@media (prefers-color-scheme: dark)
{ :root:not([data-theme="light"]) .ink … }`). Where the value is a `--home-*`/`--k-*` var, it already switches with the
theme and needs no dark entry.

| Legacy var | Light | Dark | Notes |
|---|---|---|---|
| `--bg` | `var(--home-bg)` = `#F3F1EC` | `#16161A` | page, dialog |
| `--surface` | `var(--k-surface)` = `#FBFAF7` | `#1F1F25` | cards, inputs, buttons |
| `--ink` | `var(--home-fg)` | `#F3F1EC` | text |
| `--muted` | `var(--k-muted)` = `#4A463F` | `#C9C5BB` | secondary text |
| `--faint` | `#6B665C` | `#A39F96` | dates, meta (≥ 5:1 on bg and surface) |
| `--line` | `var(--k-rule)` = `#16161A33` | `#F3F1EC33` | **hairlines only** (table rows, separators). Card/input/button borders use `--k-line` explicitly. |
| `--accent` | `var(--k-accent-text)` = `#B8361A` | `#FF6A47` | accent **text** and focus. Fills use `--k-accent` `#E8492A`. |
| `--ok` | `#166A42` | `#4CC38A` | |
| `--wait` | `#8A5300` | `#F0B351` | |
| `--danger` | `#B42318` | `#FF7B72` | distinct from coral |
| `--sq-l` / `--sq-d` | `#E9E6DF` / `#8E8A80` | same | AD6 |
| `--hl-last` / `--hl-sel` | `rgb(255 106 71 / .35)` / `rgb(255 106 71 / .55)` | same | |
| `--hl-check` | `rgba(220, 38, 38, .55)` | same | |
| `--dot` | `rgb(22 22 26 / .3)` | same | |
| `--f-sans` / `--f-mono` | unchanged (Geist / Geist Mono) | | |

Sidebar-only fixed colors (both themes): bg `#16161A` (dark: `#0F0F12` + right border `1.5px #F3F1EC33`), text
`#F3F1EC`, muted `#C9C5BB`, rule `#F3F1EC33`, coral `#E8492A`.

Contrast (checked by Claude): muted on bg ≥ 7:1, faint ≥ 5:1, `--accent`/`--ok`/`--wait`/`--danger` text on bg and
surface ≥ 4.5:1 in both themes, `#16161A` on coral 4.66:1. **Status and accent text never sits on `--k-chip`** (it drops
under 4.5:1 for ok/accent in light); badges are outline-only for that reason.

## 6. Shell

### 6.1 Sidebar (`.admin-sidebar`) — mockup left column

- Width 264px (grid `264px minmax(0, 1fr)`), padding 22px 16px, gap 22px, sticky full height as today.
- Brand: onigiri mark 22px + "Admin" in Bricolage 800 22px, -.03em; "carlsdaleescalo.com" Geist Mono 12px `#C9C5BB`.
  "Site ↗" = outline pill (§7.1) in paper on ink (transparent fill, `#F3F1EC` border/text).
- Note under the brand: Caveat 700 22px `#FF6A47`, rotate -4deg, `aria-hidden`, text `control panel ✎`. Hidden
  below 760px.
- Nav links: min-height 44px, padding 0 14px, radius 999px, 1.5px transparent border, Geist 500 15px `#C9C5BB`;
  hover: text `#F3F1EC`, border `#F3F1EC33`; `aria-current="page"`: coral fill `#E8492A`, text and border `#16161A`,
  600. Unread badge: Geist Mono 12px, paper fill `#F3F1EC`, ink text, radius 999, padding 1px 8px (on the active coral
  pill it stays paper).
- Footer: top rule `1.5px #F3F1EC33`; name 600 paper; role Geist Mono 12px `#C9C5BB`; row with `ThemeToggle`
  (44×44 round, 1.5px `#F3F1EC` border, paper icon: pass a class through its `className` prop) and "Sign out" (outline
  pill, paper on ink).

### 6.2 Mobile (≤ 759.98px)

Same structure as today: the sidebar is a sticky top bar (z-index 10), padding 12px 16px, gap 10px, bottom border
`1.5px #F3F1EC33` in dark (none in light: ink on paper is its own edge). Tabs scroll horizontally (pills, `flex: none`).
Footer row: name/role left, toggle + Sign out right. No horizontal page scroll at 375px.

### 6.3 Main area (`.admin-main`)

- Padding 36px 40px 72px (24px 16px 56px narrow), max-width 1240px as today.
- Background: graph paper (`.k-grid` look: two 1px gradients with `--home-grid-line`, 32px) on `.admin-main`'s
  column, i.e. put it on the shell's main grid track so it reaches the right edge (not only inside the 1240px box).
- `.admin-page-head`: margin-bottom 28px, `align-items: flex-end`. `h1`: Bricolage 800 `clamp(34px, 4vw, 52px)`,
  line-height .95, -.045em. A coral serif period after it via CSS:
  `h1::after { content: "." / ""; font: italic 400 1.05em var(--font-instrument); color: var(--accent); }`
  (decorative; `/ ""` keeps it out of the accessible name). `.admin-blog-sub` / `.admin-auth-sub` = 15–16px muted.

## 7. Components (all under `.ink`)

### 7.1 Buttons (`.admin-btn`, `.sm`, `.primary`, `.danger`, `:disabled`)

Pill: min-height 44px, padding 0 18px (`.sm`: 0 14px, 14px text), radius 999px, `1.5px solid var(--k-line)`,
`--surface` fill, `--ink` text, Geist 500 14–15px. Hover (not disabled): `translate: -3px -3px; box-shadow: 5px 5px 0
currentColor`, `.2s` (use the `translate` property, not `transform`). `.primary`: `#E8492A` fill, `#16161A` text and
border, 600. `.danger`: `--danger` text and border, hover adds `color-mix(in srgb, var(--danger) 10%, transparent)`
fill plus the lift. Disabled: opacity .5, no lift. Inside the sidebar: transparent fill, paper border/text.

### 7.2 Cards (`.admin-card`, `.admin-card-link`, `.admin-empty`)

Surface, `1.5px solid var(--k-line)`, radius 18px, `box-shadow: 4px 4px 0 var(--k-shadow)`, padding 20px, gap 14px.
`h2`: Bricolage 800 20px, -.02em. `.admin-card-link` hover: shadow grows to `7px 7px 0`, `translate: -2px -2px`.
`.admin-empty` (used today in the posts list, media library and engagement page; don't add it elsewhere): dashed `1.5px` border, no shadow,
centered muted text, plus a decorative Caveat line via `::after { content: "all quiet ✎" / ""; }` (Caveat 700 22px,
`--accent`, rotate -3deg, display block, margin-top 6px).

### 7.3 Stat cards (Overview only) — mockup top row

The four `.admin-card` links in `.admin-stats-grid` on `/admin`: shadow `8px 8px 0`, tilt via `rotate: var(--rot)`
cycling `-.8deg, .6deg, -.4deg, .8deg` (`:nth-child`), hover `rotate: 0deg` + `12px 14px 0`, `.45s
cubic-bezier(.2,.7,.2,1)`. First card gets a tape strip (`<span className="k-tape admin-tape" aria-hidden />`, 96×26px,
left 22px, rotate -4deg). `.admin-stat-label` Geist Mono 12px uppercase .06em muted; `.admin-stat-val` Bricolage 800
44px (the "Blog (7d)" value keeps its smaller size, now via a class, §8); `.admin-stat-delta.up/.down` mono 12px ok /
danger. Below 760px: no tilt. The engagement page stat cards (`EngagementStatCards`) use the same look **without**
tilt or tape.

### 7.4 Forms

- `.admin-input`, `.admin-select`, textareas in `.admin-efield`, `.admin-blog-search`, `.admin-slug-row`,
  `.admin-tags-input`: min-height 46px, padding 10px 14px, `1.5px solid var(--k-line)`, radius 12px, surface fill,
  16px text (no iOS zoom). Focus: the `.ink` coral 3px outline (from `ink.css`); remove the old 2px blue outlines.
- Labels Geist 500 14px. Field hints/counters mono 12px faint; over-limit = `--danger`.
- `.admin-switch`: track 46×26, radius 999, 1.5px `--k-line`, `--k-chip` fill; knob 17px `--ink`; checked: track
  `#E8492A`, knob moves 20px (`translate`), `.2s`. Focus ring on the track.
- `.admin-check`, `.admin-check-item`, `.admin-radio`: `accent-color: #E8492A`, 44px rows.
- `.admin-alert`: 1.5px `--k-line` border, radius 12px, padding 10px 14px; `.error` `#E8492A22` fill + `--danger`
  text; `.ok` `#1F7A4D1F` fill + `--ok` text.

### 7.5 Lists and tables

- `.admin-table`: header cells Geist Mono 12px uppercase .06em muted, bottom border `1.5px var(--k-line)`; body cells
  padding 12px, bottom hairline `var(--line)`; row hover `color-mix(in srgb, var(--k-chip) 55%, transparent)`; numbers
  right-aligned mono, no wrap. `.admin-table-wrap` is the card (§7.2) with padding 0 and `overflow-x: auto`.
  `stack-mobile` / `compact` keep their structure; the `::before` labels go mono faint.
- `.admin-ptable` / `.admin-prow` (posts list): same rules as the table; `.thumb` 56×36, radius 8, 1.5px border,
  chip fill; `.tt` title 600, hover `--accent`; header row `.th` = table header style; `.admin-sort-link[data-active]`
  = ink text with a 2px coral underline offset 4px.
- `.admin-msg-item` (Messages list, Overview latest): radius 12px, padding 12px 14px, 1.5px transparent border; hover
  border `--k-line` + `--bg` fill; `.active` = border `--k-line`, fill `--k-chip`, `inset 4px 0 0 #E8492A`.
  `.admin-unread-dot` 8px coral.
- `.admin-badge`: outline only. Geist Mono 12px, radius 999, padding 2px 9px, `1.5px solid currentColor`, transparent
  fill; default `--muted`; `.accent` `--accent`, `.ok`, `.wait`, `.danger` their colors.
- `.admin-seg` (Published / Drafts filters, editor Write/Split/Preview): sticker pills — min-height 40px, radius 10px,
  1.5px `--k-line`, `--k-chip` fill, Geist Mono 13px; `aria-current="page"` (or the active class it uses today) = ink
  fill, paper text. Tilt ±1deg only in the posts-list filter (`.admin-blog-toolbar .admin-seg`), straight elsewhere.
  Count `span` muted (inherits on the active one).
- `.admin-menu` (row "more" menu): surface, 1.5px `--k-line`, radius 14px, `5px 5px 0 var(--k-shadow)`; items 44px;
  `.danger` item `--danger`. `.admin-more-btn` = 44px round outline button.

### 7.6 Charts and bars

- `.admin-eng-track`, the Overview "moves per day" track (§8): height 12px (`.lg` 16px), radius 999, `--k-chip` fill,
  `1.5px solid var(--k-line)`, overflow hidden. Fills: views / moves `#E8492A`, likes `--ok`, shares `--wait`, `.neg`
  `--danger`. Legend dots match. Dates and values mono 12px.
- `.admin-usage .bar` (media storage): same track; fill coral, turns `--danger` past the existing threshold class if
  there is one (don't add logic).

### 7.7 Overlays

- `dialog.admin-dialog`: `--bg` fill, `1.5px --k-line` border, radius 20px, `10px 10px 0 #E8492A` shadow, padding 24px.
  `::backdrop`: `rgb(22 22 26 / .55)` + `blur(2px)`.
- `.admin-toast`: ink pill (`#16161A` fill, paper text, `1.5px #F3F1EC33` border, `5px 5px 0 #E8492A`), radius 999,
  padding 12px 20px, bottom-right as today. Its existing `.on` show/hide logic stays; restyle the transition (§10).
- `.admin-preview-banner`: coral note bar — `--k-chip` fill, 1.5px `--k-line` border, radius 12px, mono 13px.

### 7.8 Editor (`/admin/blog/new`, `/admin/blog/[id]`)

Straight, functional, ink-styled:
- `.admin-ebar` (top bar): hairline bottom border, the `.saved` dot coral when dirty (`.dirty i`), ok when saved.
- `.admin-titlein`: Bricolage 800 `clamp(30px, 3.4vw, 44px)`, -.04em, no border until focus, placeholder faint.
- `.admin-mdbar` buttons: 40px square-ish outline buttons, radius 10px, mono 13px; `.sep` hairline.
- `.admin-src textarea`: Geist Mono 14px/1.7, surface, 1.5px `--k-line`, radius 14px.
- `.admin-pv` (live preview pane) and `.admin-pane`: card look (§7.2) without shadow; the `InkScope contained`
  preview inside is untouched.
- `.admin-drop`: `2px dashed #E8492A`, radius 14px, `--accent` text, `--k-chip` fill while dragging (if a drag class
  exists).
- `.admin-up` upload rows: progress `.pg i` coral; `.st.ok` / `.st.err` ok / danger.
- `.admin-eside` cards (§7.2). `.admin-cover-box`: dashed 1.5px border, radius 14px; image radius 10px. Tag chips in
  `.admin-tags-input .chip`: sticker style (chip fill, 1.5px border, radius 8px, mono 12px). `.admin-checklist li::before`
  muted ring, `.ok::before` ok fill with a tick. `.admin-serp`: surface card, `.u` mono 12px ok, `.t` 18px `--accent`
  title, `.d` muted.

### 7.9 Media, Chess, Admins

- `.admin-mgrid` / `.admin-mitem`: media tiles = surface, 1.5px `--k-line`, radius 14px, `4px 4px 0` shadow; image
  area chip fill; hover lift `translate: -2px -2px` + `6px 6px 0`. Straight (no tilt).
- `.admin-board`: 1.5px `--k-line` border, radius 10px; squares use §5 colors. `.admin-move-log` table per §7.5.
- `.admin-manage-row` (Admins): hairline separated rows, title 600, role badge outline.

## 8. Inline styles → classes

In each listed component, move inline styles that set **color, background, border, radius, font, size, shadow or
overflow/ellipsis** into classes in `admin.css` (prefix `admin-`, defined once each). Inline styles that only set
`display/grid/gap/justify/align/margin/width` may stay, but prefer an existing helper (`.admin-row-actions`,
`.admin-stack`) when one fits. Dynamic values stay inline (bar `width: X%`). Required classes at least:

| Class | Replaces |
|---|---|
| `.admin-stat-val.sm` | Overview "Blog (7d)" `fontSize: "1.375rem"` → Bricolage 800 26px |
| `.admin-ellipsis` | the mono muted single-line ellipsis blocks (Overview top post, others) |
| `.admin-meta` | `className="mono"` + `color: var(--muted|--faint)` + `fontSize: "0.75rem"` dates/counts |
| `.admin-bars`, `.admin-bar`, `.admin-bar-track`, `.admin-bar-fill` | Overview "Moves per day" rows (grid `84px minmax(0,1fr) 32px` → keep), track and fill (§7.6) |
| `.admin-kv` | Overview "Top countries" rows (flex, space-between, hairline bottom) |
| `.admin-hint`, `.admin-hint.danger`, `.admin-hint.wait` | EditorClient slug error/warning and excerpt counter colors |

Name the rest after what they are; list every new class in the commit message body.

## 9. Copy

Today's copy wins everywhere. New text, exactly as written, all decorative (`aria-hidden` or CSS `content` with an
empty alt):

| Where | Text |
|---|---|
| Sidebar note | `control panel ✎` |
| Empty-state note (`.admin-empty::after`) | `all quiet ✎` |
| Page heading | a serif `.` after each `.admin-page-head h1` (CSS) |

## 10. Motion (`admin.css`, using `ink.css` keyframes `k-fadeUp`, `k-drop`, `k-slap`, `k-fade`)

| Element | Animation |
|---|---|
| `.admin-page-head` | `k-fadeUp .6s cubic-bezier(.2,.7,.2,1) backwards` |
| Overview stat cards | `k-drop .7s cubic-bezier(.2,.9,.25,1.25) backwards`, delays .1, .18, .26, .34s; set `--r0` 6deg and `--rot` per card so the drop ends on the tilt (homepage R2.1 lesson: animate `rotate`/`translate`, never `transform`, on a tilted element) |
| `.admin-toast.on` | `k-slap .45s` on show; hide = opacity .2s |
| `dialog.admin-dialog[open]` | `k-fadeUp .35s` |
| Buttons, cards, tiles | hover transitions from §7 |

Nothing else animates (tables, forms, lists, charts). Every animation uses `backwards` fill so its end state equals the
element's style. **Calm tier** under `prefers-reduced-motion: reduce`: page head, stat cards, toast and dialog use
`k-fade` only; stat cards keep their resting tilt (static, not motion); button lift and card hover keep the shadow
change but drop the `translate`/`rotate` transition. Route changes inside the panel restart the page-head fade
(Activity); that's accepted.

## 11. Accessibility

Targets ≥ 44px (40px allowed for `.admin-seg` and editor `.admin-mdbar` buttons, as today); coral 3px focus ring
visible on ink sidebar and on paper; contrast per §5; decorative tape, notes and the h1 dot hidden from assistive
tech; `aria-current`, `aria-label`s and live regions (toast `role`, alerts) unchanged. Lighthouse Accessibility ≥ 95
on `/admin`, `/admin/blog` and `/admin/messages` (light and dark).
