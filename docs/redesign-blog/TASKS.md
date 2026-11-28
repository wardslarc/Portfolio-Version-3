# Tasks: blog and sign-in redesign

Read `SPEC.md` first; this file only orders the work. Visual reference: `mockups/` (read its README). Gemini codes
every K task; Claude reviews at each gate and writes `REVIEW-R<n>.md` here.

## Ground rules

- Branch `redesign/ink-by-night`. Don't push, merge, rebase or switch branches. Don't edit anything under `docs/`.
- One commit per task: `feat(blog): K0n …` (fixes from reviews: `fix(blog): R<n>.<k> …`).
- Before every commit: `npm run lint`, `npm test` and `npm run build` pass, and `/` stays `○` or `◐` in the build output.
- Read `AGENTS.md` and the relevant guide in `node_modules/next/dist/docs/` before Next-specific code (at least the
  view-transitions guide for K08).
- Take every value from `SPEC.md` or the mockups. Don't invent copy (SPEC §8) or values. If the spec is unclear,
  contradicts the code, or a check fails for a reason outside your task, **stop and report** instead of guessing.
- Never touch the "must not change" list (SPEC §3).
- When you stop, list your commits, what you checked in a browser (which pages, light/dark, 375/1440 widths,
  reduced motion), and anything you couldn't check.

## Batches and gates

| Step | Who | Tasks | Starts when |
|---|---|---|---|
| B1 | Gemini | K01, K02, K03 | now |
| R1 | Claude | theme scoping, header on blog and home, footer, homepage unchanged | B1 done |
| B2 | Gemini | K04, K05, K06 | R1 passed |
| R2 | Claude | blog pages, prose, admin preview | B2 done |
| B3 | Gemini | K07, K08 | R2 passed |
| R3 | Claude | motion, calm tier, view transitions, Activity | B3 done |
| B4 | Gemini | K09, K10 | R3 passed |
| R4 | Claude | **sign-in security review**, cleanup, final checks | B4 done |

---

## K01 Tokens, `InkScope` and page background

**Files:** new `src/styles/ink.css` (tokens §6, shared pieces §7; the motion part comes in K07),
new `src/components/ink/InkScope.tsx`; `src/app/globals.css` (add the §6.3 block only).
**How:** SPEC §4.1, §6, §7. `InkScope` imports the CSS and applies `ink` + `homeFontVariables` (+ `ink-dark` when
`forceDark`). Nothing uses it yet except a temporary check in K02.
**Acceptance**
- With `cde-theme` = light, dark and unset (OS light and OS dark), an element inside `.ink` computes the right
  `--home-bg`/`--home-fg`/`--k-*` values (SPEC §6.1–6.2); `.ink-dark` is dark even with `cde-theme=light`.
- On `/`, `getComputedStyle(document.documentElement).getPropertyValue('--bg')` is still `#F3F1EC` from the
  `data-home` block and nothing on the homepage changes (compare screenshots at 1440 and 375).
- Unit test (`src/styles/ink.test.ts` or similar) is not required; lint/test/build pass.
**Do not:** change `src/lib/theme.ts`, the theme script, or any existing `:root` variable values.

## K02 Site header and `ThemeToggle`

**Files:** `src/components/home/HomeHeader.tsx` (+ `.module.css`), new `src/components/ink/ThemeToggle.tsx`.
**How:** SPEC §5.1 and §9.4 (the circle reveal is part of this task; it needs the K07 keyframes only for the circle,
so put the `k-circle` keyframes and the `active-view-transition-type(theme)` rules in `ink.css` now).
**Acceptance**
- `<HomeHeader />` on `/` renders the same markup as before (compare the header HTML of `/` before and after: identical) and
  behaves the same (menu, Escape, links).
- `<HomeHeader variant="site" />`: links `/#work`, `/#night`, `/blog` (current on `/blog*`), `/#contact`; logo → `/`;
  toggle in the bar and at the end of the mobile menu; 44×44 targets.
- Toggle: same `aria-label`s as the old header, writes `cde-theme`, survives reload, works with storage blocked.
  In Chrome the switch is a circle from the button; with reduced motion it's instant; a normal navigation never
  shows the circle.
**Do not:** change the `home` variant's look or behavior; delete `Header.tsx` yet (K10).

## K03 Blog layout, footer and 404

**Files:** `src/app/blog/layout.tsx`, new `src/components/ink/InkFooter.tsx` (+ module), `src/app/not-found.tsx`.
**How:** SPEC §4.2, §5.4, §5.5. The blog layout uses `InkScope`, the site header, `InkFooter`; it exports the
`viewport` theme colors. Page bodies stay as they are until K04/K05 (they'll look half-old; expected).
**Acceptance**
- `/blog`, a post, a tag page and a 404 show the new header and footer in light and dark; no horizontal scroll at
  375px; skip link still works and lands on `<main id="main">`.
- `<meta name="theme-color">` on `/blog`: `#F3F1EC` (light) and `#16161A` (dark), media-scoped; on `/` unchanged.
- The `/` → `/blog` → back sequence: `data-home` and `data-theme` follow the route exactly as in T16 (no dark flash on
  `/`, stored dark theme back on `/blog`).
**Do not:** touch `src/app/page.tsx` or anything in `src/components/home/` except K02's header files.

---

## K04 Blog list and tag pages

**Files:** `src/app/blog/page.tsx`, `src/app/blog/tag/[tag]/page.tsx`, `src/components/blog/PostList.tsx`,
`src/components/blog/Breadcrumbs.tsx`, new `src/styles/ink-blog.css` (start it here; K05 adds to it).
**How:** SPEC §5.2, §10; mockup `BlogList.dc.html`. Markup changes only; keep every `Link`, `href`, `aria-current`,
`Image` `priority`/`sizes`, JSON-LD and metadata.
**Acceptance**
- Matches the mockup at 1440 and 375 in light and dark (hero, stickers, featured card, older-notes grid 3/2/1 columns,
  pager, empty state). A post without a cover renders a card without an image box.
- Tag pages: breadcrumbs, "Posts about *{tag}.*", the count line, filtered list, pagination; `?tag=` still redirects.
- Featured card is still one link; no link inside a link (`a a` matches nothing).
- Keyboard: every sticker, card and pager link shows the focus ring.

## K05 Post page and prose

**Files:** `src/components/blog/ArticleView.tsx`, `Toc.tsx`, `LikeButton.tsx`, `ShareRow.tsx`, `CodeCopy.tsx` (class
of the button only, if needed), `src/styles/ink-blog.css`.
**How:** SPEC §5.3, §10; mockup `Post.dc.html`. Prose styles target the server HTML (`.blog-prose h2`, `blockquote`,
`pre`, `code`, `img`, `figure`, `table`, `ul`, `ol`, `hr`).
**Acceptance**
- The PHP2Shell post matches the mockup at 1440 and 375 in light and dark. Test a post (or the admin preview) with a
  code block, a table, an image and a list to see every prose style.
- TOC: sticky beside the text at ≥960px, boxed above it below; the current section still updates while scrolling.
- Like, share (copy/X/LinkedIn/native), views and the copy-code button work as before; "copied!" pop shows on copy.
- Prev/next and "Keep reading" render when present.

## K06 Admin preview and old blog CSS

**Files:** `src/app/admin/(panel)/blog/[id]/preview/page.tsx`, `EditorClient.tsx`, `src/app/globals.css`.
**How:** SPEC §4.2: wrap the `ArticleView`s in `<InkScope>`; then delete the old `.blog-*` and syntax-token rules from
`globals.css` (they now live in `ink-blog.css`).
**Acceptance**
- `grep -n "^\.blog-\|\.blog-prose \.hljs" src/app/globals.css` finds nothing.
- The admin post preview and the editor's live preview show the new article look; the rest of the admin panel looks
  exactly as before (screenshot `/admin`, `/admin/blog`, `/admin/messages` before and after).
- Blog pages are unchanged by this task (screenshots before/after).

---

## K07 Motion layer

**Files:** `src/styles/ink.css` (motion part), `src/components/ink/ReadingProgress.tsx`, the blog components (add the
motion classes and `--rot`/`--r0`/`animation-delay` styles), `src/app/blog/[slug]/page.tsx` or `ArticleView` (render
`ReadingProgress`).
**How:** SPEC §9.1–§9.3, §9.6, §9.7; timings from the mockups.
**Acceptance**
- Load-in sequences of SPEC §9.2 play on `/blog`, a tag page, a post and the 404.
- In Chrome: cards settle and tapes slap as they scroll in; h2 highlights draw; the cover parallaxes; the footer grows;
  the progress bar fills to 100% at the end of a post.
- In a browser without `animation-timeline` (Firefox, or Chrome with the `@supports` block commented out locally):
  everything is visible and still; no progress bar.
- With reduced motion: only fades; nothing moves (check each item in §9.6).
- After every animation ends, card hover (straighten + bigger shadow) still works.

## K08 Cover morph

**Files:** `src/components/blog/PostList.tsx`, `src/components/blog/ArticleView.tsx`, `src/styles/ink.css`.
**How:** SPEC §9.5. Read the Next view-transitions guide first.
**Acceptance**
- Clicking the featured card or a list card morphs its cover into the post cover; browser Back morphs it back (if the
  guide's pattern supports it; otherwise report).
- `/` → `/blog` → post → `/`: no flash or jump; on `/`, `lenis` class and ScrollTriggers behave as in T16.
- Reduced motion: plain navigation.

---

## K09 Sign-in screens ⚑ security-sensitive

**Files:** new `src/components/admin-auth/{AuthShell.tsx,AuthShell.module.css,OtpInput.tsx,useShake.ts}`,
`src/app/admin/(auth)/login/LoginClient.tsx`, `src/app/admin/(auth)/invite/[token]/InviteClient.tsx`, plus unit tests
`OtpInput.test.tsx` if the test setup supports components (otherwise test the paste/spread helper as a pure function).
**How:** SPEC §11, §8, §9.2 (sign-in row), mockups `Login`, `Verify`, `Backup`, `Invite`. Wrap each screen in
`<InkScope forceDark>`.
**Acceptance**
- `git diff` shows no change under `src/lib/**` or `src/app/api/**`, and no change to the server actions each form
  calls, the field names, `autoComplete` values or `required`/length attributes.
- Credentials step: real sign-in works; wrong password shows today's "Invalid email or password." and the card shakes.
- Code step: typing, Backspace, paste of a 6-digit code and paste of junk all behave per SPEC §11.3; the request body
  (DevTools Network, form data) contains exactly one `code` field with 6 digits; backup mode sends the backup code in
  `code`; trust-device, resend countdown, Back and the error/notice texts work as today.
- Backup-codes step: shows the codes, Copy codes copies all of them (one per line, as today), Continue goes to `/admin`.
- Invite: create-account flow works with a real invite; the length bar is decorative.
- Always dark, even with `cde-theme=light`. 375px: no horizontal scroll, six digit boxes fit.
- Reduced motion: no card drop, no shake, no drift.
**Do not:** add client-side validation that blocks a submit, log anything, or change redirects.

## K10 Cleanup

**Files:** delete `src/components/Header.tsx`, `src/components/blog/BlogFooter.tsx`; remove now-unused CSS from
`globals.css` (`.site-header` …) and `admin.css` (`.admin-auth-*`, `.admin-backup-grid`); `README.md` project layout
(mention `src/components/ink/`, `src/styles/ink*.css`, `src/components/admin-auth/`).
**How:** grep before each deletion; delete only what nothing uses.
**Acceptance**
- `grep -rn "components/Header\"\|BlogFooter\|admin-auth-\|site-header" src` finds nothing.
- Lint, test and build pass; every page from K03–K09 looks the same as before this task.
- `for f in $(find src/components/ink src/components/admin-auth -name '*.module.css') src/styles/ink.css src/styles/ink-blog.css; do grep -oE '^\.[A-Za-z][A-Za-z0-9_-]*\s*\{' "$f" | sort | uniq -d | sed "s|^|$f: |"; done`
  prints only grouped-selector false positives (report them).

---

## Prompts for Gemini (Carls pastes these into Antigravity)

**Batch:**

> You're implementing the blog and sign-in redesign on branch `redesign/ink-by-night`. Read `AGENTS.md`, then
> `docs/redesign-blog/SPEC.md`, `docs/redesign-blog/TASKS.md` and `docs/redesign-blog/mockups/README.md`. The
> mockups in `docs/redesign-blog/mockups/` are the visual and motion reference (read them for exact values; don't copy
> their scripts). Do the tasks of step **B<n>** in the "Batches and gates" table, in order, and stop at the end of that
> step so Claude can review. If a `docs/redesign-blog/REVIEW-R<n>.md` file lists open fixes, do those first. Follow
> the ground rules in TASKS.md: one commit per task, lint/test/build green before each commit, no pushing or branch
> changes, no edits under `docs/`, no invented values or copy, and never touch the "must not change" list in SPEC §3.
> If something is unclear or looks wrong, stop and describe it instead of guessing. When you stop, list your commits,
> what you checked in a browser, and anything you couldn't check.

**Fix round:**

> Read `docs/redesign-blog/REVIEW-R<n>.md` and do the open fixes, one commit each (`fix(blog): R<n>.<k> …`), with
> lint, test and build passing. Change only what each fix names, don't start the next batch, don't push or edit
> `docs/`. Report each commit and how you checked it.
