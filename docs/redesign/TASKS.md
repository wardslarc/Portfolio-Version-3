# Homepage redesign tasks

Branch: **`redesign/ink-by-night`**. Do the tasks **in order**. A task can start once every task it depends on is done.

**Handoff batches**

| Batch | Who | Tasks | Starts when |
|---|---|---|---|
| A | Claude | T02 | now (before Gemini starts) |
| B | Gemini | T01, T03, T04, T05, T06, T07, T07b, T08, T09 | T02 is committed |
| C | Claude | T10 | batch B is done |
| D | Gemini | T11 | T10 is committed |
| E | Claude | T12, T13, T14 | T11 is done |
| F | Gemini | T15 | T14 is committed |
| G | Claude | T16 | T15 is done |

- `[gemini]`: well-scoped build work for Gemini in Antigravity.
- `[claude]`: judgment work (ScrollTrigger and Lenis integration, wiring the existing chess and contact features in,
  the theme and security-sensitive bits, and the final review). Gemini skips these and stops when it reaches one.

Read first, every time: `AGENTS.md`, `docs/redesign/DECISIONS.md`, `docs/redesign/ARCHITECTURE.md` and
`docs/redesign/DESIGN_TOKENS.md`. The **visual and motion reference** is `docs/redesign/prototype/index.html`, a working
vanilla-JS build of this spec. Serve it to look at it: copy `public/carls-dale-escalo-portrait.jpg` next to it as
`portrait.jpg` and run `python3 -m http.server`. It's a reference, not code to copy: it sets layout modes with `data-mode`
attributes so its panel can force them, where the real build uses CSS media queries (D8). ARCHITECTURE §n and DESIGN_TOKENS §n are section references. Take every number
from DESIGN_TOKENS; if a number you need isn't there, **stop and ask**, don't invent one.

## Ground rules (apply to every task)

1. One commit per task, Conventional Commits: `feat(home): T06 hero …`. Finish the commit message with the
   attribution lines your tool normally adds.
2. Before every commit: `npm run lint`, `npm test` and `npm run build` all pass.
3. **Don't push, merge, rebase, switch branches or open PRs.**
4. **Global "Do not" list.** Unless a task explicitly says otherwise, don't modify:
   - `src/app/api/**`, `src/lib/**` (except the new `src/lib/theme.ts` in T02), `src/proxy.ts`
   - `next.config.ts` (CSP and headers), `src/app/robots.ts`, `src/app/manifest.ts`, `src/app/*opengraph-image*`,
     `src/app/twitter-image.tsx`
   - `src/app/blog/**`, `src/components/blog/**`, `src/app/admin/**`, `src/app/not-found.tsx`
   - `src/app/globals.css` (only T02 adds one block)
   - `src/components/ChessSection.tsx` (only T13 adds one attribute), `src/components/Header.tsx` (only T15 removes one entry)
   - `src/content/projects.ts`, `src/content/experience.ts`
   - `package.json` dependencies (only T01 adds two)
   - `REDESIGN_PROMPT.md`, `portfolio-v3-prototype.dc.html.txt` and `docs/**`
5. Don't copy the prototype's template syntax (`{{…}}`, `<sc-for>`, `<sc-if>`, `DCLogic`), its inline `style="…"`
   attributes or its Google Fonts `<link>`. Port to TSX plus CSS Modules.
6. No `"use client"` in a file the tree in ARCHITECTURE §3 marks `[S]`.
7. Don't add libraries beyond T01's two. No Tailwind, no `@gsap/react`, no jsdom.
8. Class names are descriptive and each one has one job (D23). Never define the same class twice in one module.
   Hidden text uses the global `.sr-only`.

### How to check in a browser

- Dev: `npm run dev` → http://localhost:3000. Production check: `npm run build && npm start`.
- Reduced motion: Chrome DevTools → ⋮ → More tools → **Rendering** → "Emulate CSS media feature
  prefers-reduced-motion" → `reduce`.
- Mobile: DevTools device toolbar, **375 × 667**, and also 759 × 900 (just under the breakpoint).
- Stored dark theme: in the console, `localStorage.setItem("cde-theme","dark")`.
- "No horizontal overflow": in the console, `document.documentElement.scrollWidth === innerWidth` is `true`.

---

## T01 [gemini] Install GSAP and Lenis

**Depends on:** none.
**Files:** `package.json`, `package-lock.json`.

**Steps**
- `npm install gsap@^3.15.1 lenis@^1.3.27`
- Check the Lenis stylesheet path: `ls node_modules/lenis/dist/lenis.css`. If it's somewhere else, write the real
  path in the commit message body. T04 imports it.

**Acceptance**
- `npm ls gsap lenis` shows gsap 3.15.x and lenis 1.3.x as direct dependencies.
- `npm audit --omit=dev` reports 0 vulnerabilities. If it doesn't, stop and report.
- `npm run build` passes, and `/`, `/blog` and `/admin/login` look exactly as before (nothing imports the packages yet).

**Do not:** add `@gsap/react` or any other package, or change the `overrides` block.

---

## T02 [claude] Homepage theme scope and no-flash (D1)

**Depends on:** none.
**Files:** `src/lib/theme.ts` (new), `src/lib/theme.test.ts` (new), `src/app/layout.tsx`, `src/app/globals.css`
(one block), `src/components/home/HomeThemeScope.tsx` (new), `src/app/page.tsx` (render `<HomeThemeScope />` and
add `export const viewport`).

**Acceptance**
- `npm test`: `theme.test.ts` runs `themeScript` against a stub `document`, `location` and `localStorage`, and
  proves that on `/` it sets `data-home` and never reads storage. On `/blog` with `"dark"` stored, it sets
  `data-theme="dark"`. With nothing stored, it sets no attribute. If storage throws, it doesn't throw.
- With `cde-theme=dark` stored, hard-reload `/` with DevTools Performance recording screenshots. **No frame** shows a
  dark canvas or dark header. `<html>` has `data-home` and no `data-theme`.
- With the OS (DevTools Rendering → `prefers-color-scheme: dark`) set to dark and nothing stored, `/` is still paper.
- With `cde-theme=dark` stored, `/blog` is dark on a hard load. Click the brand link to `/`: no dark frame, and
  `<html>` gains `data-home`. Click "Blog" (once T05 exists; before that use the browser back button) or go back:
  `/blog` is dark again, and `data-home` is gone.
- On `/blog`, the toggle switches theme and persists across reloads, as before. `/admin/login` and a 404 URL follow
  the stored theme, as before.
- `<meta name="theme-color">` on `/` is a single `#F3F1EC` tag. On `/blog` it's the two media-scoped tags, as before.
- In the console on `/`, `getComputedStyle(document.documentElement).scrollBehavior` is `"auto"`. On `/blog` it's still
  `"smooth"` (DECISIONS D7).

**Do not:** change the toggle in `Header.tsx`, the storage key, or `suppressHydrationWarning`.

---

## T03 [gemini] Homepage content module

**Depends on:** none.
**Files:** `src/content/site.ts` (add `socials.instagram`), `src/content/home.ts` (new), `src/content/home.test.ts` (new).

**Steps**
- `site.socials.instagram = "https://www.instagram.com/daleonigiri/"`.
- `home.ts` exports typed constants. **Copy the text verbatim** from the brief and prototype, with the
  characters exactly as shown here (`’` vs `'` matters: use the straight `'` the brief uses):
  - `hero`:
    - `note: "hi, I'm Carls ↘"`
    - `lines: ["I build tools", "teams ", "use."]`, with `accentWord: "actually"` placed after `"teams "` in line 2
    - `paragraph: "Full-stack & systems developer in Makati, Philippines. By day I ship internal platforms, SaaS and Android apps. By night I draw."`
    - `ctaWork: "See the work ↓"`, `ctaResume: "Résumé (PDF)"`, `ctaInstagram: "@daleonigiri ✎"`
    - `caption: "↑ hover me — there's a sketch underneath"`, `captionTouch: "↑ tap me — there's a sketch underneath"`
    - `sketchNotes: ["brow line", "it's all structure."]`
    - `portraitAlt: "Carls Dale Escalo in graduation attire, University of Makati"`
  - `marquee`: `{ repeats: 6, row2: "NEXT.JS · NODE · MYSQL · DOCKER · CLIP STUDIO · " }` (row 1 is markup, built in `Marquee.tsx`)
  - `statement`:
    - `body: "I like owning a project end to end — from the first conversation with the people who'll use it, to the database, the interface, and the server it runs on."`
    - `closing: "Then I go home and draw."`
  - `work`:
    - `label: "01 / SELECTED WORK"`, `heading: "On the "`, `headingAccent: "clock."`
    - `intro: "Things running in production right now, built end to end, from the database to the server."`
    - `note: "keep scrolling →"`
    - `cards`: an array of 4 keyed by the exact `featuredProjects` title, holding `{ displayTitle, kicker, status, statusTone: "green" | "coral" | "muted", description, rotate, drift, tape: {…} | null, note: {…} | null, asset }`,
      with every value from DESIGN_TOKENS §4.4. `displayTitle` is "Relato" for "Relato - AI Resume Builder" and the plain title otherwise.
  - `moreRows`: keyed by `moreProjects` title, `{ stack, kind }` (DESIGN_TOKENS §4.5)
  - `experienceHeading: "Where I've "`, `experienceAccent: "built."`
  - `split`:
    - `left: "On the"`, `right: "Off the"`, `word: "CLOCK"`
    - `noteLeft: "↑ that was the day job"`, `noteRight: "↓ here's the night shift"`
    - `overlay: ["Ink by", "night."]`
  - `night`:
    - `heading: "Hall of "`, `headingAccent: "sketches."`
    - blurb in 3 parts: `"Portraits and characters, painted in Clip Studio Paint and posted as "`, the link `"@daleonigiri"`, then `". Same habit as coding: one finished piece at a time."`
    - `columns` (DESIGN_TOKENS §4.8)
    - `chessNote: "one move per day, one shared game"`
  - `sketchbook`:
    - `heading: "Follow the "`, `headingAccent: "sketchbook."`
    - `copy: "New pieces every week, with process shots straight from Clip Studio."`
    - `button: "@daleonigiri on Instagram ↗"`
    - `cards` (5 entries, DESIGN_TOKENS §4.11)
  - `contact`:
    - `heading: ["Let's build", "something."]`
    - `copy` (DESIGN_TOKENS §4.9)
    - `signature: "— Carls"`, `signatureNote: "[your real signature]"`
    - `labels: { name: "Name", email: "Email", message: "What are you building, and when?" }`
    - `submit: "Send it →"`
    - `footerRight: "Coded in Next.js · drawn in Clip Studio"`, `footerPlace: "Makati, PH"`
  - `nav`: `[{ href: "#work", label: "On the clock" }, { href: "#night", label: "Off the clock" }, { href: "/blog", label: "Blog" }]`, `cta: { href: "#contact", label: "Let's talk" }`
  - `assets`: every slot from ARCHITECTURE §12, all `src: null` except `portraitPhoto: { src: "/carls-dale-escalo-portrait.jpg", width: 768, height: 960, … }`.
    `label` is the exact placeholder text, e.g. `"[Screenshot: Bilyo]"`.
- `home.test.ts` checks:
  - every `work.cards` key exists in `featuredProjects`, and every `moreRows` key exists in `moreProjects` (and the reverse)
  - there are 4 cards, 3 columns × 3 items and 5 fan cards with `i` from -2 to 2
  - every asset slot has a non-empty `label` and `alt`

**Acceptance:** `npm test` passes. No page changes visibly yet, except that the JSON-LD `sameAs` on `/` (View
Source) now includes the Instagram URL.

**Do not:** change `projects.ts` or `experience.ts`; invent copy, numbers or stats.

---

## T04 [gemini] Fonts, `HomeShell`, home tokens and the new page skeleton

**Depends on:** T01, T02, T03.
**Files:**
- New: `src/components/home/fonts.ts`, `HomeShell.tsx`, `HomeShell.module.css`, `AssetImage.tsx`,
  `AssetImage.module.css`, `CopyrightYear.tsx`
- Changed: `src/app/page.tsx`

**Steps**
- `fonts.ts`: exactly the three calls in DECISIONS D5. Export `homeFontVariables` (the joined `.variable` class names).
- `HomeShell.tsx` `[C]`:
  - renders `<div ref className={`${styles.root} ${fontClassName}`} data-motion="off">{children}</div>`
  - imports `"lenis/dist/lenis.css"` (path from T01)
  - **no motion code yet.** T10 adds the effect.
- `HomeShell.module.css`:
  - every `--home-*` token from DESIGN_TOKENS §1.1 and §1.2, plus `--home-bg`, `--home-fg`, `--stage-h` (ARCHITECTURE §5.2, §6)
  - `.root` rules (ARCHITECTURE §5.2) and the graph paper (§4.10)
  - the theme-section rules (ARCHITECTURE §5.3)
  - `.main { display: block; gap: 0; padding: 0 }`, which overrides the global `main` rule
  - shared classes:
    - `.ln` (the heading mask: `display: block; overflow: clip; padding-bottom: .08em`)
    - `.btn` (DESIGN_TOKENS §5.10 hover)
    - `.serif` (the accent-word pattern)
    - `.note` (Caveat 700)
    - `.mono`
  - the focus style (DESIGN_TOKENS §5.10), plus `.root a { text-decoration: none }`
- `AssetImage.tsx` `[S]`: props `{ slot: AssetSlot; sizes: string; className?: string; priority?: boolean }`
  (ARCHITECTURE §12). The placeholder style comes from the per-use CSS (background color and mono label).
- `CopyrightYear.tsx` `[S]`: move the existing `"use cache"` component out of `page.tsx` unchanged.
- `page.tsx`:
  - keep `structuredData`, the skip link, the JSON-LD script, `<HomeThemeScope />` and `viewport`
  - render `<HomeShell fontClassName={homeFontVariables}>` with an empty `<main id="main" className={…main}>` and,
    **temporarily**, the old `<ChessSection />` and `<Contact />` below it, so chess and contact keep working at
    every commit
  - drop the old `Header`, `Intro`, `About`, `Work`, `Writing`, `Experience` and `Skills` from the page (don't delete the files)

**Acceptance**
- `/` shows the paper graph-paper background with 32px grid lines, then the working chess board and contact form.
  They're still in the old styling: that's expected.
- In DevTools → Network → Font, `/` loads woff2 files for Bricolage Grotesque, Instrument Serif and Caveat, all
  from `/_next/static/media/…` (none from `fonts.googleapis.com`). `/blog` loads **none** of those three.
- The console has no errors and no CSP violations.
- `npm run build` passes. The build output still lists `/` as prerendered (○ or ◐, not ƒ).

**Do not:** add fonts to `layout.tsx`; change the JSON-LD.

---

## T05 [gemini] Header and onigiri mark

**Depends on:** T04.
**Files:** new `src/components/home/HomeHeader.tsx`, `HomeHeader.module.css`, `Onigiri.tsx`; `src/app/page.tsx`
(render `<HomeHeader />` as the first child of `HomeShell`).

**Steps**
- `Onigiri.tsx` `[S]`: `variant: "logo" | "drawing"`, with the paths in DESIGN_TOKENS §4.12. The drawing variant puts
  `data-anim="hero-onigiri-path"` on each `<path>` and accepts `className`. Both variants are `aria-hidden="true"`.
- `HomeHeader.tsx` `[C]`:
  - `<header>`, styled per DESIGN_TOKENS §4.3, with `<nav aria-label="Primary">`
  - left: `<a href="#top">` with the logo and "carls.dale"
  - at ≥ 760px: the `home.nav` links (Blog uses `next/link`) and the coral "Let's talk" pill (`.btn`)
  - at < 760px: only the 44×44 menu button (DESIGN_TOKENS §4.12 icons) with `aria-expanded`,
    `aria-controls="home-menu"` and `aria-label` "Open menu" or "Close menu"
  - the open menu is `<div id="home-menu">` with **On the clock, Off the clock, Blog, Let's talk →** (D17.5), per
    DESIGN_TOKENS §2.2 and §3
  - the menu closes on link click, on Escape, and in a `useLayoutEffect` cleanup (Activity)
- **No theme toggle anywhere in this component.**

**Acceptance**
- At 1440px: the logo, three links and a coral pill. The header sticks while scrolling, with a frosted
  background and a 1.5px bottom border in the text color.
- At 375px: only the logo and a 44×44 menu button. Tab to the button and press Enter: the menu opens and the
  screen reader announces "Close menu, expanded". Escape closes it, and focus stays on the button.
- "Blog" navigates to `/blog` client-side; `/blog` shows its own header **with** the theme toggle.
- Lighthouse Accessibility doesn't flag the header (names, contrast, target size).

**Do not:** import or change `src/components/Header.tsx`.

---

## T06 [gemini] Hero: layout, CSS intro, marquee, portrait reveal

**Depends on:** T05.
**Files:** new `src/components/home/hero/Hero.tsx`, `Hero.module.css`, `Marquee.tsx`, `PortraitReveal.tsx`,
`PortraitReveal.module.css`, `PortraitSketch.tsx`; `src/app/page.tsx` (render `<Hero />` first in `<main>`).

**Steps**
- Structure and data attributes:
  - section wrapper `div#top[data-anim="hero-section"]`
  - inside it `div[data-anim="hero-stage"]`, which holds:
    - `div[data-anim="hero-band"]` containing `<Marquee/>` (`aria-hidden="true"`)
    - `div[data-anim="hero-card-wrap"]`, containing `div[data-anim="hero-shadow"]` and `<section aria-label="Introduction" data-anim="hero-card">`
    - `<Onigiri variant="drawing" data-anim="hero-onigiri">`
- Layouts: the pinned and static layouts in ARCHITECTURE §6.1, with the `heroPinned` query from DESIGN_TOKENS §6.
- Card content:
  - the note
  - `<h1>` with 3 block spans; the "actually" span holds the underline SVG (DESIGN_TOKENS §4.7)
  - the paragraph
  - CTAs: "See the work ↓" → `#work`; "Résumé (PDF)" → `TrackedLink href={site.resume} target="_blank" rel="noopener noreferrer" event="resume_opened"`;
    "@daleonigiri ✎" → `site.socials.instagram`, `target="_blank" rel="noopener noreferrer"`
  - `<PortraitReveal/>`
- Intro and marquee animations: DESIGN_TOKENS §5.1 and §5.2, every hidden starting state **inside**
  `@media (prefers-reduced-motion: no-preference)` (D10).
- `PortraitReveal` `[C]` behaves as described in D18:
  - `<button type="button" aria-pressed>`
  - the sketch layer: `PortraitSketch` plus the two Caveat notes, `aria-hidden`
  - the photo layer: `AssetImage` with `portraitPhoto`, `priority`, `sizes="(max-width: 759px) 90vw, 390px"`, and the mask
  - the two captions, switched with `@media (hover: none)`
- The onigiri drawing **under `heroPinned`** starts at `opacity: 0` (ARCHITECTURE §6.1 exception). Otherwise it's fully drawn.

**Acceptance**
- At 1440 × 900, on load: the note, the three headline lines (staggered), "actually" in coral italic serif with the
  underline drawing itself after about 1.1s, then the paragraph, the CTAs and the tilted portrait. The card fills the
  stage, and scrolling doesn't animate anything yet (T11 adds the shrink).
- Moving the mouse over the portrait shows a 120px-radius hole revealing the line sketch and its notes under the
  photo. Leaving restores the photo. Clicking toggles the whole sketch on and off (`aria-pressed` flips). This works with
  Enter and Space too.
- In the touch emulator: the caption reads "↑ tap me …", and tapping toggles.
- At 375 × 667 and at 1000 × 800: the hero is in normal flow (nothing cut off). The portrait is fully visible, and the
  dark marquee band sits under the card with both rows scrolling (in opposite directions) and the onigiri fully drawn over it.
- With reduced motion: everything is visible immediately, with no motion and a static marquee.
- "Résumé (PDF)" opens `/Escalo-CarlsDale_Resume.pdf` in a new tab, and Network shows the analytics event request
  (or `track` is called, in dev).
- Lighthouse mobile: the LCP element is the h1 or the portrait, and nothing shifts while fonts load (CLS < 0.1).

**Do not:** add GSAP code; use the prototype's placeholder photo layer (we have the real photo).

---

## T07 [gemini] Statement, work track, more work and experience (static and CSS layouts)

**Depends on:** T06.
**Files:** new `src/components/home/Statement.tsx` + `.module.css`; `work/WorkTrack.tsx` + `.module.css`;
`work/MoreWork.tsx` + `.module.css`; `work/ExperienceStrip.tsx`; `src/app/page.tsx`.

**Steps**
- `Statement` `[S]`:
  - `<section id="about" data-home-theme="paper">`
  - one `<p>`; every word of `statement.body` is `<span data-anim="word">{w} </span>` (split on `" "`)
  - then `<span data-anim="word" class=serif-coral>{statement.closing}</span>`
- `WorkTrack` `[S]`:
  - `<section id="work" data-home-theme="sand" data-anim="track-section">`, containing
    `div[data-anim="track-stage"]`, containing `div[data-anim="track"]` with:
    - the intro panel (with `<h2>`)
    - the 4 cards: `<article data-anim="track-drift" data-drift={card.drift}>`, with an inline style for the CSS custom
      property `--rotate` used as `rotate: var(--rotate)`
    - the end panel
  - the progress rail and fill: `div[data-anim="track-bar"]`
  - the pinned and static layouts in ARCHITECTURE §6.2; card visuals and hover in DESIGN_TOKENS §4.4 and §5.5
  - titles with an `href` use `TrackedLink` (D15); screenshots use `AssetImage` with `sizes="(max-width: 759px) 90vw, 468px"`
- In `page.tsx`, wrap the next two in `<section data-home-theme="sand">`:
  - `MoreWork` `[C]`:
    - the rows from `moreProjects` plus `home.moreRows`; the first 3 are visible
    - `<button type="button" class=btn aria-expanded aria-controls>` with the labels in DESIGN_TOKENS §4.5
    - rows with an `href` link through `TrackedLink` (`project_link`)
    - the list wrapper gets `data-refresh-on-resize`; the whole block gets `data-anim="reveal"`
  - `ExperienceStrip` `[S]`:
    - `<div id="experience">`
    - `<h3 class="ln"><span data-anim="heading-line">Where I've <span class=serif-coral-text>built.</span></span></h3>`
    - the strip, with `data-anim="reveal"`

**Acceptance**
- At 1440: the statement is a large paragraph on paper, ending in coral italic. Below it, the sand section is about
  `900 + (track width − 1440)` px tall. While scrolling through it, the stage sticks (no motion until T12) and shows
  the intro panel and the first card. Each card is tilted, shows its tape and note chip, and on hover straightens
  with a deeper shadow.
- At 375 and with reduced motion: the panels stack vertically (intro, 4 cards, end panel), there's no progress
  bar, and `scrollWidth === innerWidth`.
- "Show 5 more projects ↓" reveals 5 more rows and changes to "Show fewer ↑". The screen reader reports expanded/collapsed.
- Bilyo, Relato and the more-project rows that have links open the real URLs in a new tab (bilyoapp.com, the Play
  listing, hardrock, citimax.ph, sticky-white-board).
- The experience strip shows 4 cells (Rustan, Citimax, Business Machine, University of Makati) and wraps to 1 column at 375.

**Do not:** add GSAP code; hard-code project text that exists in `src/content/*`.

---

## T07b [gemini] "Latest from the blog" row (D22)

**Depends on:** T07.
**Files:** new `src/components/home/work/LatestPosts.tsx`; `src/components/home/work/MoreWork.module.css` (its styles);
`src/app/page.tsx` (render `<LatestPosts />` right after `<ExperienceStrip />`, inside the same sand wrapper).

**Steps**
- `LatestPosts` `[S]` is an `async` function component:
  - `const posts = await getLatestPosts(3)` (from `@/lib/blog/public`). If `posts.length === 0`, return `null`.
  - markup: `<div data-anim="reveal">`, holding `<h3>Latest from the <span class=serif-coral-text>blog.</span></h3>`
    (same classes and spacing as the "Where I've built." heading, but **without** the `.ln` mask or `heading-line`),
    then `<ul>`.
  - each `<li>` holds one `next/link` to `/blog/{post.slug}`, which contains the title and a meta line:
    `{date} · {post.readingMinutes} min read`
  - `date` = `new Date(post.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })`
    (copy the helper from `src/components/Writing.tsx`; don't import from that file, because T15 deletes it)
  - after the list: `<Link className={btn + secondary} href="/blog">All posts →</Link>`
- Styles, taken from DESIGN_TOKENS §4.5 (the project rows):
  - list `border-top: 1.5px solid #16161A`; rows `padding: 18px 0; border-bottom: 1px solid #16161A33`, laid out
    `display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 6px 24px`
  - title: Bricolage 700 22px, -.02em
  - meta: Geist Mono 12px, `#4A463F`, `white-space: nowrap`
  - "All posts →": `margin-top: 24px; min-height: 46px; padding: 12px 22px; background: #FBFAF7`, with the `.btn` hover
  - heading `margin: 110px 0 28px`, the same as "Where I've built."
  - the row link has a visible `:focus-visible` outline (the coral focus style) and is at least 44px tall
- **No new motion code.** The `data-anim="reveal"` attribute is picked up by T11's generic reveal.

**Acceptance**
- With posts published: below the experience strip, still on sand, "Latest from the *blog.*" lists the 3 newest live
  posts (newest first), the same 3 as the top of `/blog`. Each shows its title, a date like "Nov 27, 2026" and
  "N min read". Clicking a row opens that post. "All posts →" opens `/blog`.
- With no posts (or `MONGODB_URI` unset locally), the heading, list and button don't render at all, and the sand
  section ends after the experience strip with no gap or error.
- Publish a new post in `/admin`, then reload `/`: it appears in the row (the `posts` cache tag refreshes it).
- `npm run build` still lists `/` as prerendered (○ or ◐, not ƒ), and the build shows no "uncached data" error.
- At 375px the rows wrap cleanly (the meta drops under the title) and `scrollWidth === innerWidth`.
- Keyboard: Tab reaches each post link and "All posts →", with a visible coral outline.

**Do not:** change `src/lib/blog/public.ts`; add view or like counts; add a pin, scrub or heading-line effect; import
from `src/components/Writing.tsx`.

---

## T08 [gemini] Split scene and night section (without chess)

**Depends on:** T07b.
**Files:** new `src/components/home/SplitScene.tsx` + `.module.css`, `NightSection.tsx` + `.module.css`; `src/app/page.tsx`.

**Steps**
- `SplitScene` `[S]`:
  - `<section data-home-theme="paper" data-anim="split-section">`, containing `div[data-anim="split-stage"]`
  - the stage holds:
    - `div[data-anim="split-left"]` with `AssetImage deskPhoto`
    - `div[data-anim="split-right"]` with `AssetImage favoriteDrawing` (both cards `aria-hidden` while they're placeholders)
    - the heading block, a `<h2>` holding both columns (the visual is two columns; for screen readers it reads as
      "On the CLOCK Off the CLOCK")
    - `div[data-anim="split-overlay"]` with "Ink by / night."
  - layouts per ARCHITECTURE §6.3; visuals per DESIGN_TOKENS §4.6 and §2.2
- `NightSection` `[S]`:
  - `<section id="night" data-home-theme="dark">`
  - the heading row: `<h2 class=ln><span data-anim="heading-line">…</span></h2>`, plus the blurb (`data-anim="reveal"`)
    with an Instagram link
  - the gallery: 3 `div[data-anim="parallax-col"][data-speed]` columns of `<figure>` frames, using `AssetImage` with
    `sizes="(max-width: 759px) 90vw, 400px"` and `<figcaption>`
  - leave a `{/* chess: T13 */}` comment where the chess frame goes. Don't add chess here.
  - frame hover per DESIGN_TOKENS §5.10; stagger and mobile behavior per ARCHITECTURE §6.4

**Acceptance**
- At 1440, while scrolling the split scene: the stage sticks for about 1400px. Since there's no motion until T12, the
  CSS finished state shows: both tilted cards in place and the dark "Ink by night." overlay covering the stage.
- In reduced motion (static layout), **both** split cards are visible at full size: the desk card on the left and the
  drawing card on the right. Neither is a 1px clipped box (D23). In the console,
  `[...document.querySelectorAll('[data-anim^="split-"]')].map(e => e.getBoundingClientRect().width)` shows no value under 100.
  That's expected.
- At 375 and with reduced motion: the heading, then the desk card, then the drawing card, then a full-width ink block
  reading "Ink by night." No sticking and no horizontal overflow.
- The night section is ink with paper text, and "sketches." is coral-night. 9 frames appear in 3 columns (desktop,
  staggered by 0/120/40px) or 1 column (375, no stagger). Captions match DESIGN_TOKENS §4.8. Hovering a frame scales it to 1.03.

**Do not:** import `ChessSection` (T13 does); add GSAP code.

---

## T09 [gemini] Sketchbook fan, contact panel shell and footer

**Depends on:** T08.
**Files:** new `src/components/home/Sketchbook.tsx` + `.module.css`, new `src/components/home/contact/ContactShell.module.css`
(the dark wrapper and footer styles); `src/app/page.tsx`.

**Steps**
- `Sketchbook` `[S]`:
  - `<section id="sketchbook" data-home-theme="paper" data-anim="fan-section">`
  - the heading (`.ln` and `heading-line`)
  - the stage with 5 `div[data-anim="fan-card"][data-i]`, each with inline custom properties `--i`, `--y` and `--z`
    and an `AssetImage` (`post1`…`post5`)
  - the copy, and the coral Instagram button (`target="_blank" rel="noopener noreferrer"`)
  - CSS finished state and the mobile 70px/180px variant per ARCHITECTURE §6.5
- `page.tsx`: after `</main>`, add
  `<div data-anim="contact-grow" className={contactShell}>`, containing (**temporarily**) the existing `<Contact />`, then
  `<footer>` with `© <CopyrightYear/> Carls Dale Escalo · Makati, PH` and `Coded in Next.js · drawn in Clip Studio`.
  Remove the temporary `<Contact />` that T04 added under `<main>`. **Keep** the temporary `<ChessSection />`
  (move it to the end of `<main>`).
- Wrapper visuals per DESIGN_TOKENS §3, §4.9 and ARCHITECTURE §6.6.

**Acceptance**
- The fan shows 5 cards spread from the center (outer cards ±280px, tilted ±18°, lower by 56px) at 1440. At 375,
  it's the narrower spread, with `scrollWidth === innerWidth`.
- The Instagram button opens `https://www.instagram.com/daleonigiri/` in a new tab.
- The dark panel overlaps the fan section's bottom by 60px, has 40px top corners and holds the old contact form
  (still old-styled, but it **still submits**: send a test message and get "Message sent…"). The footer shows "© 2026 …".
- Fill the hidden `website` field from the console
  (`document.querySelector('[name=website]').value='x'`) and submit: the UI shows success, and no message is
  stored (check `/admin/messages`). That's existing behavior.

**Do not:** edit `Contact.tsx` (T14 replaces it).

---

## T10 [claude] Motion bootstrap: matchMedia, Lenis, themes, refresh

**Depends on:** T09.
**Files:** new `src/components/home/motion/{start,lenis,themes,refresh,queries,math}.ts`, `math.test.ts`;
`src/components/home/HomeShell.tsx` (the effect in ARCHITECTURE §4.1).

**Acceptance**
- At 1440, wheel scrolling is smooth and inertial. `<html>` has the `lenis` classes. Trackpad and keyboard
  (Space, PgDn, arrows) still scroll.
- The background tweens over about 0.9s: paper → sand when the work section's top crosses mid-screen, → paper at
  the split scene, → ink at night, → paper at the sketchbook. Scrolling back reverses each change, and returning
  into the hero shows paper. The header follows.
- With reduced motion: no `lenis` class, `data-motion="off"`, sections keep their own solid backgrounds, and nothing animates.
- Change the window across 760px, and toggle reduced motion while the page is open: no console errors, and the
  layout and motion match the new condition with no reload.
- **Activity:** go to `/blog` with the "Blog" link. `<html>` has no `lenis` class, and wheel scrolling on `/blog` is
  native. In the console, `ScrollTrigger.getAll().length` is 0 (temporarily expose `window.ScrollTrigger` for this
  check and don't commit it). Go back: smooth scrolling and theme changes work again, with no duplicated triggers.
- Loading `/#experience` lands on the experience strip after layout settles.
- `math.test.ts` passes.

---

## T11 [gemini] Reveals, hero shrink, gallery parallax, fan and contact rise

**Depends on:** T10.
**Files:** new `src/components/home/motion/{reveals,hero,gallery,fan,contact}.ts`; `math.ts` and `math.test.ts`
(add `fanTarget`, `parallaxRange` and their tests); `start.ts` (call them **only** where ARCHITECTURE §4.2 lists them).

**Steps:** implement ARCHITECTURE §7.1, §7.2, §7.5, §7.6 and §7.7 exactly, with every number from DESIGN_TOKENS §5.
Follow the rules in §4.2: synchronous, `scrub: true`, `ease: "none"`, timelines normalized to 1, `fromTo` for every tween.

**Acceptance**
- **Hero (1440 × 900):** over the first about 1000px of scroll, the card shrinks to 0.6, rotates -2° and gains 36px
  corners and a deep shadow, revealing the dark band with the two marquee rows. From about 50% of the pin, the coral
  onigiri fades in and strokes itself; it's fully drawn at about 95%. Scrolling back reverses it frame by frame.
- **Hero (1000 × 800 and 375):** no pin. The onigiri strokes as the band scrolls through the viewport.
- **Statement:** words brighten from 20% to 100% one by one as they pass about 78% → 60% of the viewport.
- **Headings** "Where I've built.", "Hall of sketches.", "Follow the sketchbook." and "Let's build / something."
  slide up from behind a mask. Blocks marked `reveal` fade up 56px.
- **Gallery (1440):** the three columns move at visibly different speeds (middle column against the others). No
  parallax at 375.
- **Fan:** the cards start stacked and fan out while the section scrolls from 60% to 15% of the viewport.
- **Contact:** the dark panel's clip-path opens from inset 9%/5% with 96px corners to full width with 40px corners.
- **With reduced motion:** every one of these shows its finished state.
- The DevTools Performance panel shows no long tasks over 50ms while scrolling the hero, and the frame rate stays
  near 60fps on a mid-range laptop (Performance → Frames).
- Every one of these elements animates only `transform`, `opacity`, `clip-path` or `stroke-dashoffset`. Check this
  in the Animations panel and in the inline styles.

**Do not:** touch `trackMotion`, `splitMotion`, `lenis.ts`, `themes.ts` or `refresh.ts`; add a GSAP target to any
`.btn` or art frame (D19).

---

## T12 [claude] Pinned horizontal work track and split scene

**Depends on:** T11.
**Files:** new `src/components/home/motion/{track,split}.ts`; `math.ts` and `math.test.ts` (`trackDistance`); `start.ts`.

**Acceptance**
- **Track (1440 × 900):** vertical scroll moves the panels sideways until the end panel's right edge meets the
  viewport's right edge, at which point the coral bar is full. Cards drift vertically by -50/40/-30/50px across the
  pin. The section's height equals the stage height plus the measured distance (no dead scroll at the end, no
  jump at the start).
- Resize from 1440 to 900 wide during the track: the distance and height recompute and nothing jumps or overflows.
- **Split (1440 × 900):** about 1400px pin. The desk photo slides in from the left and the drawing from the right by 35%.
  From 50% to 92%, a dark circle grows from about 72%/50% (the drawing) until the screen is ink with "Ink by night."
  The night section that follows starts ink-on-ink with no seam.
- At 759px wide and below, and under reduced motion: both scenes are the static layouts from T07 and T08.
- After Show more/fewer (T07), the split scene's start is still in the right place (it doesn't start early or late).

---

## T13 [claude] Visitor chess in the night section

**Depends on:** T12.
**Files:** `src/components/home/NightSection.tsx` + `.module.css` (chess frame and token re-mapping, D12);
`src/components/ChessSection.tsx` (**only** add `data-lenis-prevent` to the `.cx-moves` div); `src/app/page.tsx`
(remove the temporary `<ChessSection />`).

**Acceptance**
- The chess frame sits below the gallery in the night section, in the dark palette (DESIGN_TOKENS §1.4), with the Caveat
  note above it. `/#chess` lands on it.
- Everything from before still works: the board loads; selecting a piece shows legal targets; a move posts to
  `/api/chess/move` and shows the toast **centered at the bottom of the viewport** (not trapped in a container);
  the cooldown pill counts down; ← and → step through history while the board is on screen; "Back to live board" works.
- Polling: with DevTools Network open, `/api/chess` is requested again about every 45s only while the board is on
  screen and the tab is visible. Scroll away and the requests stop.
- Wheel over the move list scrolls the list, not the page (Lenis prevented).
- Expanding the history view or loading the board doesn't misplace the triggers below it (the fan and contact animate at the right time).
- With reduced motion: the board is fully visible and interactive.
- The console has no CSP violations.

**Do not:** change ChessSection's logic, polling, ETag handling, API calls or markup beyond the one attribute.

---

## T14 [claude] Contact form in the new panel (security-sensitive)

**Depends on:** T13.
**Files:** new `src/components/home/contact/{ContactPanel.tsx,ContactPanel.module.css,useContactForm.ts,validate.ts,validate.test.ts}`;
`src/app/page.tsx` (replace the temporary `<Contact />` with `<section id="contact" aria-labelledby="contact-h"><ContactPanel/></section>`).

**Acceptance**
- The panel matches DESIGN_TOKENS §4.9: "Let's build / something." slides up line by line, then the copy, the email
  button (`copy` → `copied!` for 1.8s, with the clipboard holding `mail@carlsdaleescalo.com`), the signature
  placeholder and the paper form.
- Validation messages are identical to the old form's. Submitting empty focuses the first invalid field.
- A real submission succeeds, and the message appears in `/admin/messages`. The 4th message within 10 minutes
  shows the existing rate-limit error.
- Honeypot: the `website` field isn't visible, isn't reachable with Tab, and is absent from the accessibility tree
  (DevTools → Accessibility pane). Filling it from the console still produces a fake success and no stored message.
- Wheel inside the textarea scrolls the textarea.
- Lighthouse Accessibility ≥ 95, with every input labelled.
- `validate.test.ts` covers the three rules and their exact messages.

**Do not:** change `/api/contact`, `src/lib/contact.ts`, the zod schema, the payload fields or the analytics event name.

---

## T15 [gemini] Cleanup and small follow-ups

**Depends on:** T14.
**Files:**
- Delete: `src/components/{Intro,Greeting,About,Work,Writing,Experience,Contact}.tsx`
- Change: `src/components/Header.tsx` (remove **only** the `{ id: "skills", label: "Skills" }` entry from `sections`),
  `src/app/sitemap.ts` (set `lastModified` to the commit date of this task, `new Date("YYYY-MM-DD")`), `README.md`
  (update "Project layout": the homepage lives in `src/components/home/`, styles are CSS Modules, motion is GSAP and Lenis)

**Acceptance**
- `grep -rn "components/\(Intro\|Greeting\|About\|Work\|Writing\|Experience\|Contact\)\"" src` finds nothing.
- `npm run lint`, `npm test` and `npm run build` pass.
- The `/blog` header shows About, Work, Experience, Chess, Contact and Blog plus the toggle, and each section link
  lands on the right part of the new homepage.
- `/sitemap.xml` shows the new `lastModified` for `/`.

**Do not:** delete `Icons.tsx`, `TrackedLink.tsx`, `Telemetry.tsx` or `ChessSection.tsx`; remove CSS from `globals.css`.

---

## T16 [claude] Final review and verification

**Depends on:** T15.
**Files:** none, unless a finding needs a fix (small fixes are committed by Claude; larger ones become a new spec).

**Acceptance (the brief's "Done means")**
- `npm run build` passes, with no hydration warnings and no console errors or CSP violations on `/`, `/blog`, one
  `/blog/<slug>`, `/admin/login` and a 404.
- Lighthouse **mobile** on the production build of `/`: Performance ≥ 85, Accessibility ≥ 95.
- The whole sequence works in Chrome, Safari and Firefox (desktop), plus iOS Safari and Android Chrome.
- At 375px: a clean vertical layout with no horizontal overflow, anywhere on the page.
- With reduced motion: everything is visible and static; no Lenis. Both split cards and the "Latest from the blog"
  row are visible (D22, D23). No module defines the same class name twice
  (for each file: `for f in $(find src/components/home -name '*.module.css'); do grep -oE '^\.[A-Za-z][A-Za-z0-9_-]*\s*\{' "$f" | sort | uniq -d | sed "s|^|$f: |"; done`
  prints nothing).
- Blog, chess, contact form, résumé link, SEO metadata (View Source: title, description, OG/Twitter, canonical,
  JSON-LD), `robots.txt` and `sitemap.xml` all still work.
- The theme rules from T02 still hold on all four routes, after all the other changes.
- Activity: `/` → `/blog` → back → `/blog/<slug>` → back, with no leaked Lenis, triggers, `data-home` or inline styles.
- A summary for Carls: what changed, the new dependencies, every placeholder still waiting for an asset
  (ARCHITECTURE §12), and how to tune the pin lengths and parallax (DESIGN_TOKENS §3 and §5, `home.ts` drift values).

---

## Prompt for Gemini (paste into Antigravity)

> You're implementing the homepage redesign on branch `redesign/ink-by-night`. Read `AGENTS.md`, then
> `docs/redesign/DECISIONS.md`, `docs/redesign/ARCHITECTURE.md`, `docs/redesign/DESIGN_TOKENS.md` and
> `docs/redesign/TASKS.md`. Do the `[gemini]` tasks of batch **<B, D or F>** in the "Handoff batches" table, in
> order, and stop at the end of that batch. Never do a `[claude]` task. If a task's dependencies aren't committed
> yet, stop and report. Follow
> the ground rules: one commit per task, lint/test/build green before each commit, no pushing or branch changes, and
> every number from DESIGN_TOKENS.md. Don't invent values or copy. If something in the spec is unclear or seems
> wrong, stop and describe it instead of guessing. When you stop, list the commits you made and anything you
> couldn't verify in a browser.
