# Tasks: admin panel redesign

Read `SPEC.md` first; this file only orders the work. Visual reference: `mockup.html` (open it in a browser; toggle
the theme with the ◐ button). Gemini codes every A task; Claude reviews at each gate and writes `REVIEW-R<n>.md` here.

## Ground rules

- Branch `redesign/admin-ink` (create it from `main` if it doesn't exist). Don't push, merge, rebase or switch to
  another branch. Don't edit anything under `docs/`.
- One commit per task: `feat(admin): A0n …` (fixes from reviews: `fix(admin): R<n>.<k> …`).
- Before every commit: `npm run lint`, `npm test` and `npm run build` pass, and `/` and `/blog` stay `○`/`◐` in the
  build output.
- Read `AGENTS.md` and the relevant guide in `node_modules/next/dist/docs/` before Next-specific code (at least the
  `viewport` / `generateViewport` reference for A01).
- Take every value from `SPEC.md` or the mockup (the spec wins if they differ). Don't invent copy (SPEC §9) or values.
  If the spec is unclear, contradicts the code, or a check fails for a reason outside your task, **stop and report**.
- Never touch the "not touched" list (SPEC §4.2). `git diff main -- src/lib src/app/api src/app/admin/api
  "src/app/admin/(auth)" src/components/admin-auth src/styles src/components/ink src/app/globals.css` must stay empty.
- No class may be defined twice in `admin.css` (rewrite the existing rule in place instead of adding a second one).
- When you stop, list your commits, the new classes, and anything you couldn't check. You can't sign in to the panel
  (real database + email code), so say which states you only checked by reading code.

## Batches and gates

| Step | Who | Tasks | Starts when |
|---|---|---|---|
| B1 | Gemini | A01, A02 | Carls approved the mockup |
| R1 | Claude + Carls | shell, theme, tokens, shared components, sign-in → panel unchanged flow | B1 done |
| B2 | Gemini | A03, A04, A05 | R1 passed |
| R2 | Claude + Carls | every panel page, light/dark, 1440/375, inline styles gone | B2 done |
| B3 | Gemini | A06 | R2 passed |
| R3 | Claude + Carls | motion, calm tier, cleanup, Lighthouse | B3 done |

---

## A01 Scope, token bridge and shell

**Files:** `src/app/admin/(panel)/layout.tsx`, `src/app/admin/(panel)/AdminShellNav.tsx`, `src/app/admin/admin.css`
(token bridge, `.admin-shell`, `.admin-sidebar` and its children, `.admin-main`, `.admin-page-head`, the mobile block).
**How:** SPEC §3 AD1/AD2/AD7, §4.1, §4.3, §5, §6.
**Acceptance**
- Every panel page renders inside `.ink` (one `InkScope` in the panel layout); the Suspense fallback too.
- Inside `.admin-shell`, `getComputedStyle` gives the §5 values for `--bg --surface --ink --muted --faint --line
  --accent --ok --wait --danger --sq-l --sq-d` with `cde-theme` light, dark, and unset + OS dark.
- Sidebar is ink in both themes; active link is the coral pill; unread badge readable on both active and idle links.
- `ThemeToggle` in the sidebar footer switches the panel (circle reveal in Chrome, instant with reduced motion) and the
  choice persists on reload and on `/blog`.
- At 375px: sticky ink top bar, tabs scroll, active tab scrolled into view (existing effect), no page-level
  horizontal scroll.
- `<meta name="theme-color" content="#16161A">` on panel pages; sign-in pages and `/blog` unchanged.
- Sign-in screens (`/admin/login`, invite) look exactly as before.
**Do not:** change `requireAdmin`, the unread query, link list, `aria-*`, or the sign-out form.

## A02 Shared components

**Files:** `src/app/admin/admin.css` only.
**How:** SPEC §7.1, §7.2 (not the stat-card tilt; that's A03), §7.4, §7.5, §7.7. Rewrite each rule in place, scoped
`.ink …`. Remove the blue 2px focus outlines (the `.ink` coral ring takes over).
**Acceptance**
- Buttons (default, `.sm`, `.primary`, `.danger`, disabled), inputs, selects, switches, checkboxes, radios, alerts,
  badges, tables (incl. `stack-mobile` at 375px), segmented filters, the row menu, dialogs and the toast match the
  mockup's "Form kit" and posts table in light and dark.
- No `#2f5bd3`, `#8aa8ff` or other blue left in what the panel computes (check `admin.css` and computed styles).
- Focus ring visible on every control on paper, on cards and on the ink sidebar.
**Do not:** edit any `.tsx` in this task.

---

## A03 Overview, engagement and post stats

**Files:** `src/app/admin/(panel)/page.tsx`, `blog/engagement/page.tsx`, `blog/_components/EngagementCharts.tsx`,
`blog/[id]/stats/PostStatsClient.tsx`, `blog/[id]/stats/page.tsx`, `admin.css`.
**How:** SPEC §7.3, §7.6, §8 (all inline styles in these files).
**Acceptance**
- `/admin` matches the mockup's top half: four tilted stat cards (tape on the first, straight below 760px), bars,
  messages card, countries list, analytics card.
- Engagement and post-stats pages: same stat look without tilt/tape; chart tracks and fills per §7.6; legends match.
- These files have no inline style left that sets a color, background, border, radius, font or size
  (`grep -n "style={{" <file>`; only layout or dynamic `width` remain).
**Do not:** change data fetching, delta math, period links or copy.

## A04 Messages, Media, Chess, Admins

**Files:** `messages/MessagesClient.tsx`, `messages/page.tsx`, `media/MediaLibraryClient.tsx`, `media/page.tsx`,
`chess/ChessAdminClient.tsx`, `chess/page.tsx`, `admins/AdminsClient.tsx`, `admins/page.tsx`, `admin.css`.
**How:** SPEC §7.5 (message list), §7.9, §8.
**Acceptance**
- Each page in light/dark at 1440 and 375 has no old-look leftovers (grey 1px card borders, blue accents, 10px
  square buttons).
- Chess board uses the §5 colors in both themes; move log readable at 375 (`compact` rows).
- Inline-style rule as in A03 for every file here.
**Do not:** change actions, dialogs' logic, or confirm texts.

## A05 Blog list and editor

**Files:** `blog/PostsListClient.tsx`, `blog/page.tsx`, `blog/new/page.tsx`, `blog/[id]/page.tsx`,
`blog/[id]/EditorClient.tsx`, `admin.css`.
**How:** SPEC §7.5 (posts table, seg, menu), §7.8, §8 (`.admin-hint`).
**Acceptance**
- Posts list matches the mockup's posts section (sticker filters tilted, search, coral "New post", table).
- Editor: title, toolbar, Write/Split/Preview, textarea, drop zone, uploads, side panel (cover, tags, slug, checklist,
  SERP) restyled; autosave dot states visible; preview pane still renders the blog article style.
- Typing, autosave, upload, slug check and publish still work (Carls checks live in R2; Gemini: say what you
  verified).
**Do not:** touch the `InkScope contained` preview block, the markdown toolbar logic or any save/publish code.

---

## A06 Motion, calm tier and cleanup

**Files:** `admin.css` (+ the Overview stat card markup if it needs a `style={{ animationDelay }}`; that's allowed).
**How:** SPEC §10, §9 (`::after` notes), §11.
**Acceptance**
- Page head fades up on each panel page; Overview stat cards drop in and end on their tilt; hover still straightens
  them afterwards; toast slaps in; dialogs fade up. Nothing else moves.
- With reduced motion: only fades; no translate/rotate motion anywhere in the panel.
- `admin.css`: no class defined twice; unused rules removed after a grep (`.admin-auth-card` stays only if the
  fallback still uses it); no `transform` animation on a tilted element.
- Lighthouse Accessibility ≥ 95 on `/admin`, `/admin/blog`, `/admin/messages` (Carls runs these signed in if Gemini
  can't).
