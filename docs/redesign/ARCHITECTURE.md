# Homepage redesign architecture

Read with `DECISIONS.md` (the why), `DESIGN_TOKENS.md` (every number) and `TASKS.md` (the order of work).
Section numbers here (§n) are referenced from TASKS.md.

Branch `redesign/ink-by-night`. Next.js 16.4.6, App Router, `cacheComponents: true`. Read `AGENTS.md` and these
bundled docs before coding:

- `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`: **Activity keeps hidden routes in the DOM**
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md` (CSS Modules and the "Ordering and Merging" section)
- `node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md` and `03-api-reference/02-components/font.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-viewport.md` (the `viewport` export)

---

## 1. Scope

Only the `/` route's UI changes. Unchanged: `/blog/**`, `/admin/**`, every `src/app/api/**` route,
`src/lib/**` (apart from the new `src/lib/theme.ts`), `src/proxy.ts`, `next.config.ts` (CSP and headers),
`robots.ts`, the OG/Twitter images and `manifest.ts`.

## 2. Files

`[S]` = Server Component (no directive). `[C]` = Client Component (`"use client"` on line 1).
`[M]` = plain TypeScript module, client-only, loaded with a dynamic import. **New** = new file.

```text
src/app/
  layout.tsx                        CHANGED  imports themeScript from @/lib/theme (D1); nothing else changes
  page.tsx                          REWRITTEN [S] JSON-LD, viewport, home tree (§3)
  globals.css                       CHANGED  adds ONE block: html:root[data-home] {…} (D1, DESIGN_TOKENS §1.5)
src/lib/
  theme.ts                          NEW      THEME_STORAGE_KEY, themeScript (string), applyStoredTheme()
  theme.test.ts                     NEW
src/content/
  site.ts                           CHANGED  socials.instagram
  home.ts                           NEW      all redesign copy plus image asset slots (§10)
  home.test.ts                      NEW
src/components/
  Header.tsx                        CHANGED  only: remove the { id: "skills" } entry from `sections` (D14)
  ChessSection.tsx                  CHANGED  only: data-lenis-prevent on the .cx-moves div (D12)
  Contact.tsx                       DELETED  in T16, after ContactPanel replaces it
  Intro.tsx, Greeting.tsx, About.tsx, Work.tsx, Writing.tsx, Experience.tsx   DELETED in T15
  home/
    fonts.ts                        NEW [S]  next/font: Bricolage, Instrument Serif, Caveat (D5)
    HomeThemeScope.tsx              NEW [C]  html data-home / data-theme swap (D1). Renders null
    HomeShell.tsx                   NEW [C]  root <div>, motion bootstrap (§4). Imports lenis/dist/lenis.css
    HomeShell.module.css            NEW      home tokens, .root, grid paper, theme sections, shared .ln/.btn/.note
    HomeHeader.tsx (+ .module.css)  NEW [C]  sticky header and mobile menu
    Onigiri.tsx                     NEW [S]  onigiri SVG (logo and big drawing variants)
    AssetImage.tsx (+ .module.css)  NEW [S]  next/image when the slot has src, labelled placeholder when null
    hero/
      Hero.tsx (+ .module.css)      NEW [S]  pinned hero: band, card, onigiri drawing
      Marquee.tsx                   NEW [S]  the two marquee rows (aria-hidden)
      PortraitReveal.tsx (+ .module.css) NEW [C] photo over sketch, pointer mask, toggle button
      PortraitSketch.tsx            NEW [S]  the prototype's placeholder sketch SVG as JSX
    Statement.tsx (+ .module.css)   NEW [S]  word-split paragraph, id="about"
    work/
      WorkTrack.tsx (+ .module.css) NEW [S]  "On the clock" horizontal track, id="work"
      MoreWork.tsx (+ .module.css)  NEW [C]  project rows plus Show more/fewer
      ExperienceStrip.tsx           NEW [S]  "Where I've built." and 4-cell strip, id="experience"
      LatestPosts.tsx               NEW [S]  "Latest from the blog." rows plus "All posts →" (D22)
      (MoreWork.module.css holds the MoreWork, ExperienceStrip and LatestPosts styles)
    SplitScene.tsx (+ .module.css)  NEW [S]
    NightSection.tsx (+ .module.css) NEW [S] "Hall of sketches.", gallery, chess frame, id="night"
    Sketchbook.tsx (+ .module.css)  NEW [S]  fan of 5 cards, id="sketchbook"
    contact/
      ContactPanel.tsx (+ .module.css) NEW [C] heading, copy, email button, signature, form
      useContactForm.ts             NEW      logic moved verbatim from Contact.tsx (D13)
      validate.ts                   NEW      validate() moved from Contact.tsx
      validate.test.ts              NEW
    CopyrightYear.tsx               NEW [S]  "use cache" year, moved from page.tsx
    motion/
      start.ts                      NEW [M]  start(root): registers ScrollTrigger, builds gsap.matchMedia (§4)
      lenis.ts                      NEW [M]  createLenis(): Lenis plus ticker wiring and cleanup (D7)
      themes.ts                     NEW [M]  sectionThemes(root, context) (§5.3)
      refresh.ts                    NEW [M]  watchRefresh(root, lenis): fonts, ResizeObservers, hash (D11)
      reveals.ts                    NEW [M]  words, reveal, reveal-fade, heading-line (§7.1)
      hero.ts                       NEW [M]  heroPinnedMotion, heroStaticMotion (§7.2)
      track.ts                      NEW [M]  trackMotion (§7.3)
      split.ts                      NEW [M]  splitMotion (§7.4)
      gallery.ts                    NEW [M]  galleryMotion (§7.5)
      fan.ts                        NEW [M]  fanMotion(root, step) (§7.6)
      contact.ts                    NEW [M]  contactGrowMotion (§7.7)
      math.ts                       NEW      pure helpers: trackDistance, fanTarget, parallaxRange
      math.test.ts                  NEW
      queries.ts                    NEW      the media query strings (DESIGN_TOKENS §6), shared by start.ts
```

The images go in `public/images/**` (§10). `public/carls-dale-escalo-portrait.jpg` already exists and is the hero photo.

## 3. Component tree

```text
<RootLayout>                         [S] src/app/layout.tsx  (Geist vars on <html>, head themeScript, <Telemetry/>)
└─ <Home>                            [S] src/app/page.tsx
   ├─ <a class="skip" href="#main">  (global .skip class, unchanged)
   ├─ <script type="application/ld+json">   (unchanged structuredData; sameAs gains Instagram)
   ├─ <HomeThemeScope/>              [C] renders null
   └─ <HomeShell fontClassName={…}>  [C] <div class={root + font vars} data-motion="off" ref>
      ├─ <HomeHeader/>               [C] <header> sticky
      ├─ <main id="main" class={styles.main}>
      │  ├─ <Hero/>                  [S] <div id="top" data-anim="hero-section">
      │  │  ├─ <Marquee/>            [S]
      │  │  ├─ card wrap > shadow layer + <section aria-label="Introduction"> card
      │  │  │  └─ <PortraitReveal/>  [C]
      │  │  └─ <Onigiri variant="drawing"/> [S]
      │  ├─ <Statement/>             [S] <section id="about" data-home-theme="paper">
      │  ├─ <WorkTrack/>             [S] <section id="work" data-home-theme="sand">
      │  ├─ <section data-home-theme="sand">  (in page.tsx: a wrapper around the next two)
      │  │  ├─ <MoreWork/>           [C] data-refresh-on-resize
      │  │  ├─ <ExperienceStrip/>    [S] id="experience"
      │  │  └─ <LatestPosts/>        [S] async, getLatestPosts(3); renders null when empty (D22)
      │  ├─ <SplitScene/>            [S] <section data-home-theme="paper">
      │  ├─ <NightSection/>          [S] <section id="night" data-home-theme="dark">
      │  │  └─ <div class=chessFrame data-anim="reveal-fade" data-refresh-on-resize>
      │  │     └─ <ChessSection/>    [C] existing, its own <section id="chess">
      │  └─ <Sketchbook/>            [S] <section id="sketchbook" data-home-theme="paper">
      └─ <div data-anim="contact-grow" class=contactPanel>     (after </main>, D13)
         ├─ <section id="contact" aria-labelledby="contact-h">
         │  └─ <ContactPanel/>       [C]
         └─ <footer>  © <CopyrightYear/> Carls Dale Escalo · Makati, PH | Coded in Next.js · drawn in Clip Studio
```

Server Components pass into Client Components only as `children` (`HomeShell`), never as props
of a client component that renders them conditionally. `ContactPanel` doesn't render the footer; the footer is a
server sibling inside the same wrapper div, which `page.tsx` renders.

`HomeShell` props: `{ fontClassName: string; children: React.ReactNode }`. `fontClassName` is
`` `${bricolage.variable} ${instrument.variable} ${caveat.variable}` ``, built in `page.tsx` from `fonts.ts`.

## 4. Motion lifecycle

### 4.1 `HomeShell` (the only place motion starts and stops)

```text
useLayoutEffect(() => {
  const root = rootRef.current; if (!root) return;
  let cancelled = false;
  let stop: (() => void) | null = null;
  import("./motion/start").then(({ start }) => {
    if (cancelled) return;
    stop = start(root);
  });
  return () => { cancelled = true; stop?.(); stop = null; };
}, []);
```

That's the full contract. `start()` must be **synchronous** once called and must return a function that undoes
**everything** it did. The cleanup runs:

- on unmount, and
- **when Activity hides the homepage** (you navigate to `/blog`). It runs again on show (back/forward or a `Link` to `/`).

Don't use `useEffect` here: the cleanup has to run in the same commit that hides the route.

### 4.2 `start(root): () => void` in `motion/start.ts`

In order:

1. `gsap.registerPlugin(ScrollTrigger)` (safe to call repeatedly).
2. `const mm = gsap.matchMedia()`.
3. `mm.add({ full, mobile, reduce, heroPinned }, (context) => { … })`, with the query strings from `motion/queries.ts`
   (DESIGN_TOKENS §6). Inside the callback, read `const { full, mobile, reduce, heroPinned } = context.conditions`, then:
   - **if `reduce` (the calm tier, D25)**, in this order: `root.dataset.motion = "on"`; `sectionThemes(root, context)`;
     `heroStaticMotion(root)`; `wordsMotion(root)`; `revealMotion(root, { moveY: false })` (opacity only, applied to both
     `reveal` and `reveal-fade`); `const unwatch = watchRefresh(root, null)`; `ScrollTrigger.refresh()`. **No** Lenis,
     `headingLineMotion`, track, split, gallery, fan or contact growth. Return the same cleanup as below, without the
     Lenis line. CSS has already rendered the right static layout (D26).
   - otherwise, in this exact order (DOM order, which ScrollTrigger needs):
     1. `root.dataset.motion = "on"`
     2. `const lenis = createLenis()` (D7)
     3. `sectionThemes(root, context)` (§5.3)
     4. `heroPinned ? heroPinnedMotion(root) : heroStaticMotion(root)`
     5. `wordsMotion(root)`; `revealMotion(root)`; `headingLineMotion(root)`
     6. `if (full) cleanups.push(trackMotion(root))` (it returns a cleanup, §7.3)
     7. `if (full) splitMotion(root)`
     8. `if (full) galleryMotion(root)`
     9. `fanMotion(root, full ? 140 : 70)`
     10. `contactGrowMotion(root)`
     11. `const unwatch = watchRefresh(root, lenis)` (§8)
     12. `ScrollTrigger.refresh()`
   - return a cleanup that calls, in order: `unwatch()`; every cleanup returned by section functions (e.g. `trackMotion`);
     `lenis.destroy()` (the `destroy` from `createLenis`, which also removes the ticker hook); `delete root.dataset.motion`;
     `root.style.removeProperty("--home-bg")`; `root.style.removeProperty("--home-fg")`.
4. Return `() => mm.revert()`. `mm.revert()` runs every condition's cleanup and reverts every tween and
   ScrollTrigger created inside the callbacks.

When a media query flips (resize across 760px, or toggling reduced motion in OS settings), GSAP reverts the old
condition and runs the callback again with the new one. The code above handles that with no extra work.

**Section functions** have the signature `(root: HTMLElement, …) => void`. They find elements with
`root.querySelectorAll('[data-anim="…"]')` (or `gsap.utils.toArray` over that NodeList), and they create tweens and
ScrollTriggers **synchronously** inside the callback, so the matchMedia context records them. Anything created later
from a callback (the theme tweens) must be wrapped with `context.add(null, fn)`, which returns a context-safe function
**without running it**. Plain `context.add(fn)` runs `fn` straight away; checked in the GSAP 3.15.1 source. Anything a function writes outside GSAP
(`style.setProperty`, event listeners) must be undone in the condition's returned cleanup.

**Scrub timelines** are normalized to duration 1, so positions equal progress (`tl.to(x, {…}, 0.55)` means "at 55%
of the pin"). End each one with `tl.set({}, {}, 1)`, so the duration is exactly 1 even when the last tween ends
early. Use `scrub: true` (not a number), because Lenis already smooths the input. Use `ease: "none"` on every scrubbed tween.

### 4.3 Lenis

`motion/lenis.ts` exports `createLenis(): { lenis: Lenis; destroy(): void }`:

- `new Lenis({ autoRaf: false, lerp: 0.09, smoothWheel: true, anchors: true })`
- `lenis.on("scroll", ScrollTrigger.update)`
- `const raf = (time: number) => lenis.raf(time * 1000)`, then `gsap.ticker.add(raf)` and `gsap.ticker.lagSmoothing(0)`
- `destroy()`: `gsap.ticker.remove(raf)`; `gsap.ticker.lagSmoothing(500, 33)`; `lenis.destroy()`

Elements that scroll on their own carry `data-lenis-prevent`: the chess `.cx-moves` list and the contact `<textarea>`.
Lenis's `anchors: true` turns same-page `href="#…"` clicks (header links, "See the work ↓", "Let's talk") into
smooth scrolls.

## 5. Themes and colors

### 5.1 The `<html>` level (D1)

- `src/lib/theme.ts`
  - `export const THEME_STORAGE_KEY = "cde-theme"`
  - `export const themeScript: string`. A single-line IIFE, wrapped in `try/catch` like today. If
    `location.pathname === "/"` it sets `data-home=""` on `document.documentElement` and stops. Otherwise it reads
    `localStorage.getItem("cde-theme")` and, if that's `"light"` or `"dark"`, sets `data-theme` to it. That's the
    existing logic, unchanged.
  - `export function applyStoredTheme(): void`: removes `data-theme`, then sets it from storage if `"light"` or
    `"dark"`, inside `try/catch`.
- `src/app/layout.tsx` uses `themeScript` in place of its local constant. Keep the existing `<head><script
  dangerouslySetInnerHTML>` and the `suppressHydrationWarning` on `<html>`, which already covers the attribute the
  script adds before hydration.
- `HomeThemeScope` is `useLayoutEffect(() => { set data-home; remove data-theme; return () => { remove data-home; applyStoredTheme(); } }, [])`.
- `globals.css`: one block, `html:root[data-home] { … }` (DESIGN_TOKENS §1.5).

### 5.2 Home tokens

`HomeShell.module.css` `.root` declares every `--home-*` token (DESIGN_TOKENS §1) plus:

```text
--home-bg: #F3F1EC;  --home-fg: #16161A;          (the tweened pair; the starting state is paper)
background-color: var(--home-bg); color: var(--home-fg);
overflow-x: clip;  font-family: var(--font-geist-sans), system-ui, sans-serif;
```

It also re-points the global tokens that shared global classes read inside the homepage:
`--accent: #E8492A` (the global `:focus-visible` outline becomes coral, as in the prototype). Chess gets its own
re-pointing in `.chessFrame` (§9).

### 5.3 Section themes and the background tween

- Each themed section has `data-home-theme="paper" | "sand" | "dark"`. Theme to colors (DESIGN_TOKENS §1.3):
  `paper` = bg `#F3F1EC`, fg `#16161A`; `sand` = bg `#E6E0D2`, fg `#16161A`; `dark` = bg `#16161A`, fg `#F3F1EC`.
- CSS: `[data-home-theme="paper"] { background: var(--home-paper); color: var(--home-ink) }` and the same for sand and
  dark. Then:
  `.root[data-motion="on"] [data-home-theme] { background: transparent; color: inherit; }`. Write it in
  `HomeShell.module.css` as `.root[data-motion="on"] :global([data-home-theme])`.
- `sectionThemes(root, context)`:
  - `const setTheme = context.add(null, (name: Theme, immediate = false) => gsap.to(root, { "--home-bg": bg, "--home-fg": fg, duration: immediate ? 0 : 0.9, ease: "power1.inOut", overwrite: "auto" }))`
  - for each `[data-home-theme]` element:
    `ScrollTrigger.create({ trigger: el, start: "top 50%", end: "bottom 50%", onToggle: (self) => self.isActive && setTheme(el.dataset.homeTheme) })`
  - the first themed element (the statement) also gets `onLeaveBack: () => setTheme("paper")`. Scrolling back into
    the hero, which has no theme, returns to paper (the prototype's `scrollY < stick` branch).
  - after `ScrollTrigger.refresh()` in `start()`, sync once: find the trigger with `isActive`, or `"paper"` if none,
    and call `setTheme(name, true)`. That covers loads and Activity restores in mid-page.
- The **hero** and the **contact panel** have no `data-home-theme`. The hero paints its own dark band and paper card;
  the contact panel is always ink.
- `HomeHeader` follows the theme by reading the inherited values: `background: color-mix(in srgb, var(--home-bg) 88%, transparent); color: var(--home-fg); border-bottom: 1.5px solid currentColor`.

## 6. Layout modes (pure CSS, D8)

Each pinned scene has a **pinned layout** under one media query and a **static layout** otherwise. Copy the query
strings exactly from DESIGN_TOKENS §6. `--stage-h` is defined on `.root` as `min(100vh, 900px)`, then redefined as
`min(100svh, 900px)` (later declaration, for browsers that support `svh`).

Rule for initial values: **CSS describes the finished, fully visible state.** GSAP `fromTo` (with default
`immediateRender`) applies the starting state when motion starts. Reduced-motion and no-JS visitors therefore see
everything. The one exception is §6.1's onigiri under `heroPinned`.

### 6.1 Hero (`Hero.module.css`)

- Pinned (`heroPinned` query, D24):
  - section `height: calc(var(--stage-h) + 1000px); margin-top: calc(-1 * var(--header-h))`, background ink.
    `--header-h: 74px` is on `.root`. The pull-up puts the stage under the frosted header, so the whole stage is in the
    first screen.
  - fitting: h1 `font-size: clamp(44px, min(8.4vw, calc((var(--stage-h) - 360px) * .37)), 124px)`; portrait
    `width: min(100%, calc((var(--stage-h) - 280px) * .8)); margin-inline: auto`; under `(max-height: 759.98px)`: card
    padding `84px 24px 20px`, hero row gap 40px, paragraph margin-top 20px, CTA row margin-top 24px, caption margin-top 12px
  - stage `position: sticky; top: 0; height: var(--stage-h); overflow: hidden`
  - band `position: absolute; inset: 0`
  - card wrap `position: absolute; inset: 0; z-index: 1`
  - onigiri `position: absolute; left: 50%; top: 50%; translate: -50% -50%; rotate: -8deg; z-index: 2; pointer-events: none`,
    **starting state `opacity: 0`**, with `stroke-dashoffset: 1000` on the paths. This is the exception, because the
    hero is above the fold and a fully drawn onigiri would flash before the chunk loads.
- Static (any other case):
  - section `height: auto`
  - stage `display: grid; grid-template-areas: "card" "band"`
  - card wrap `grid-area: card; position: relative`, with its own padding (no `inset: 0`)
  - band `grid-area: band; position: relative; padding: 48px 0`
  - onigiri `grid-area: band; place-self: center`, at its finished state (`opacity: 1`, `stroke-dashoffset: 0`)

### 6.2 Work track (`WorkTrack.module.css`)

- Pinned (`full`):
  - section `height: calc(var(--stage-h) + var(--hz-extra, max(0px, calc(3080px + 12vw - 100vw))))`. The
    fallback approximates the measured distance: 420 + 4×500 + 340 + 5×64 = 3080px of panels, plus 6vw of padding on
    each side.
  - stage `position: sticky; top: 0; height: var(--stage-h); overflow: hidden; display: flex; align-items: center`
  - track `display: flex; gap: 64px; align-items: center; padding: 40px 6vw 0; width: max-content`
- Narrow static (`< 760px`, either motion preference):
  - section `height: auto`
  - stage `position: static; height: auto; padding: 80px 0`
  - track `flex-direction: column; width: auto; padding: 0 20px`
  - track `align-items: center`, and every child `width: min(100%, 500px)`
  - the progress bar is `display: none`
- Wide calm (`wideCalm`: ≥ 760px with reduced motion, D26):
  - section `height: auto`; stage `position: static; padding: 120px 24px`
  - track `display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 64px 56px; align-items: start; max-width: 1240px; margin: 0 auto; padding: 0`
  - every child `width: auto`; intro panel `grid-column: 1 / -1; max-width: 640px`; end panel `grid-column: 1 / -1`
  - cards keep `rotate`, tape, shadow and notes; the 2nd and 4th card (`:nth-of-type(even)` of the card element) get `margin-top: 40px`
  - the progress bar is `display: none`

### 6.3 Split scene (`SplitScene.module.css`)

- Pinned (`full`):
  - section `height: calc(var(--stage-h) + 1400px)`
  - stage `position: sticky; top: 0; height: var(--stage-h); overflow: hidden; display: flex; align-items: center; justify-content: center`
  - the left and right cards and the overlay are absolute (DESIGN_TOKENS §4.6)
  - the overlay's finished state is `clip-path: circle(150% at 72% 50%)`
- Static:
  - section `height: auto; padding: 120px 24px 0`
  - below 760px: stage `display: grid; gap: 48px; justify-items: center; grid-template-columns: 1fr; grid-template-areas: "heading" "left" "right" "overlay"`,
    cards `position: static; width: min(80vw, 300px)`, keeping their tilt and shadow
  - `wideCalm` (D26): stage `display: grid; grid-template-columns: minmax(0,1fr) auto minmax(0,1fr); grid-template-areas: "left heading right" "overlay overlay overlay"; align-items: center; justify-items: center; gap: 48px 32px; max-width: 1240px; margin: 0 auto`,
    cards `position: static; width: min(100%, 300px)`, overlay full-bleed `width: 100vw; margin-inline: calc(50% - 50vw)`
  - overlay `position: static; clip-path: none; width: 100%; padding: 120px 24px`. It's a full-width ink block
    with "Ink by night." visible.

### 6.4 Gallery (`NightSection.module.css`)

At `< 760px`, the column `margin-top` stagger is `0`. Parallax motion runs only under `full` (§7.5).

### 6.5 Sketchbook fan (`Sketchbook.module.css`)

The finished state is in CSS, from per-card custom properties set inline on each card (`--i`, `--y`, `--z`):
`transform: translateX(calc(var(--i) * var(--fan-step))) translateY(var(--y)) rotate(calc(var(--i) * 9deg))`, where
`--fan-step: 140px`. Below 760px: `--fan-step: 70px`, card width 180px, `margin-left: -90px`.

### 6.6 Contact panel

The finished state is in CSS: `clip-path: inset(0% 0% 0% 0% round 40px 40px 0px 0px)`.

## 7. Motion catalog

All numbers are copied in DESIGN_TOKENS §5. "Range" gives the ScrollTrigger `start` and `end`. Every one is
`scrub: true` with `ease: "none"`.

### 7.1 Reveals (`reveals.ts`; `full` and `mobile`, plus the calm tier with `moveY: false`, D25)

Under `reduce`: `word` runs as below; `reveal` and `reveal-fade` both run as opacity-only; `heading-line` doesn't run.

| `data-anim` | Tween | Trigger | Range |
|---|---|---|---|
| `word` (each statement word span) | `opacity: 0.2 → 1` | the span | `"top 78%"` → `"top 60%"` |
| `reveal` | `opacity: 0 → 1`, `y: 56 → 0` | the element | `"top bottom"` → `"top 70%"` |
| `reveal-fade` | `opacity: 0 → 1` (no transform, D12) | the element | `"top bottom"` → `"top 70%"` |
| `heading-line` (inner span of a `.ln` mask) | `yPercent: 110 → 0` | **the parent mask** (`el.parentElement`) | `"top 95%"` → `"top 75%"` |

Elements that get `reveal`: the more-projects block, the experience strip, the latest-posts block (D22), the night blurb, the contact copy
paragraph, a wrapper around the email button (never the button itself, D19), and the form. The chess frame gets
`reveal-fade`.
`heading-line` masks: "Where I've *built.*", "Hall of *sketches.*", "Follow the *sketchbook.*", and contact's
"Let's build" and "*something.*", which are two separate masks.

### 7.2 Hero (`hero.ts`)

`heroPinnedMotion`: one timeline. Trigger is the `hero-section`, `start: "top top"`,
`end: () => "+=" + (section.offsetHeight - stage.offsetHeight)`, `invalidateOnRefresh: true`.

| At | Duration | Target | From → to |
|---|---|---|---|
| 0 | 1 | `hero-card-wrap` | `scale: 1 → 0.6`, `rotation: 0 → -2` |
| 0 | 1 | `hero-card` | `clipPath: "inset(0% round 0px)" → "inset(0% round 36px)"` |
| 0 | 1 | `hero-shadow` | `opacity: 0 → 0.7` |
| 0.5 | 0.05 | `hero-onigiri` | `opacity: 0 → 1` |
| 0.55 | 0.4 | `hero-onigiri-path` (all) | `strokeDashoffset: 1000 → 0` |
| 1 | — | `tl.set({}, {}, 1)` | |

`heroStaticMotion` (any case where `heroPinned` doesn't match, **including `reduce`**, D25): on `hero-onigiri` set
`opacity: 1`; then `hero-onigiri-path` `strokeDashoffset: 1000 → 0`, trigger `hero-band`,
`"top 80%"` → `"bottom 40%"`.

The intro animation on load and the marquee are CSS (D10). They're not in this file.

### 7.3 Work track (`track.ts`, `full` only)

- `const distance = () => trackDistance(track.scrollWidth, window.innerWidth)`, where `math.ts` gives
  `trackDistance(w, vw) = Math.max(0, w - vw)`.
- `const setExtra = () => section.style.setProperty("--hz-extra", distance() + "px")`. Call it once right away, then
  `ScrollTrigger.addEventListener("refreshInit", setExtra)`.
- Timeline: trigger `track-section`, `start: "top top"`,
  `end: () => "+=" + (section.offsetHeight - stage.offsetHeight)`, `invalidateOnRefresh: true`. At 0 for
  duration 1: `track` `x: 0 → () => -distance()`; `track-bar` `scaleX: 0 → 1` (transform-origin left, in CSS); each
  `track-drift` card `"--drift-y": "0px" → Number(card.dataset.drift) + "px"` (a custom property; CSS turns it into
  `translate`, see "Elements with a CSS `rotate`" below). Finish with `tl.set({}, {}, 1)`.
- Return a cleanup: `ScrollTrigger.removeEventListener("refreshInit", setExtra)` and
  `section.style.removeProperty("--hz-extra")`. Gather these cleanups in `start()`'s condition cleanup.

### 7.4 Split scene (`split.ts`, `full` only)

Timeline: trigger `split-section`, same start/end pattern as §7.2.

| At | Duration | Target | From → to |
|---|---|---|---|
| 0 | 0.35 | `split-left` | `"--split-x": "-130%" → "0%"` (custom property, see below) |
| 0 | 0.35 | `split-right` | `"--split-x": "130%" → "0%"` |
| 0.5 | 0.42 | `split-overlay` | `clipPath: "circle(0% at 72% 50%)" → "circle(150% at 72% 50%)"` |
| 1 | — | `tl.set({}, {}, 1)` | |

**Elements with a CSS `rotate` (R2.1).** The track cards (`rotate: var(--rotate)`, straightened on hover) and the
split cards (`rotate: ±5deg`) use the CSS `rotate` property. A GSAP transform tween (`y`, `xPercent`) on such an element
folds the CSS rotation into an inline `transform` and writes `rotate: none` inline. That kills the card hover while
motion is on, and `mm.revert()` leaves those inline values behind. So these two never get a GSAP transform tween:
GSAP tweens a custom property, and CSS applies it with the independent `translate` property:
`.card { translate: 0 var(--drift-y, 0px) }` and `.splitLeft, .splitRight { translate: var(--split-x, 0%) 0 }`.
`--split-x` in `%` of the card's own width is the same as `xPercent`. `revert()` removes the custom properties.

### 7.5 Gallery (`gallery.ts`, `full` only)

For each `parallax-col` with `data-speed` = s (60, −80, 110): `y: -s → s`, trigger the column,
`start: "center bottom+=50%"`, `end: "center top-=50%"`. That's the prototype's `p = (center − vh/2)/vh` running
from +1 to −1, with `translate = −p·s`.

### 7.6 Fan (`fan.ts`, `full` and `mobile`)

Trigger `fan-section`, `"top 60%"` → `"top 15%"`. For each `fan-card` with `data-i` = i:
`fromTo({ x: 0, y: 0, rotation: 0 }, fanTarget(i, step))`, where `fanTarget(i, step) = { x: i*step, y: Math.abs(i)*28, rotation: i*9 }`.

### 7.7 Contact grow (`contact.ts`, `full` and `mobile`)

Trigger `contact-grow`, `"top bottom"` → `"top 30%"`:
`clipPath: "inset(9% 5% 0% 5% round 96px 96px 0px 0px)" → "inset(0% 0% 0% 0% round 40px 40px 0px 0px)"`.
Both strings need the same structure, so GSAP can interpolate them.

### 7.8 Not GSAP (CSS)

- Hero intro (`up`, `draw`) and the marquee (`mq`, `mqr`): see D10.
- Hovers (`.btn`, cards, frames): see DESIGN_TOKENS §5.9.
- The chess piece drop (existing).

## 8. Refresh and hash (`refresh.ts`, D11)

`watchRefresh(root, lenis): () => void`:

1. `document.fonts.ready.then(() => { if (!stopped) ScrollTrigger.refresh() })`
2. One `ResizeObserver` over `root.querySelectorAll("[data-refresh-on-resize]")`. Its callback debounces 150 ms
   (`setTimeout`), then calls `ScrollTrigger.refresh()`. Skip the observer's first callback for each element; that's
   its initial size.
3. `ScrollTrigger.addEventListener("refresh", onFirstRefresh)`, once: if `location.hash` matches an element in
   `root` (`document.getElementById(decodeURIComponent(location.hash.slice(1)))`, and check that `root.contains(el)`), call `lenis.scrollTo(el, { immediate: true })`.
4. The returned cleanup sets `stopped = true`, disconnects the observer, clears the timer and removes the listener.

## 9. Visitor chess integration (D12)

- `NightSection.tsx` (server) imports `ChessSection` from `@/components/ChessSection` and renders it inside
  `<div className={styles.chessFrame} data-anim="reveal-fade" data-refresh-on-resize>`. Above it, inside the frame,
  goes the Caveat note "one move per day, one shared game".
- `.chessFrame` re-points the global tokens to the dark palette (DESIGN_TOKENS §1.4). Everything inside `ChessSection`
  (`.cx-*`, `.sq`, `.btn`, `.section-label`, `.cx-toast`) already reads them.
- `ChessSection.tsx`'s only change: `<div className="cx-moves" ref={movesBoxRef} data-lenis-prevent>`.
- Compact layout (D12, DESIGN_TOKENS §4.8), all through `.chessFrame :global(...)`:
  - ≥ 1024px: `#chess { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 32px; align-items: start }`
  - `.cx-grid { grid-template-columns: minmax(0,320px) 220px }`
  - `.cx-boardcol { max-width: 320px }`
  - 760–1023px: `#chess` is one column (`.cx-head` above)
  - < 760px: `.cx-grid` is one column, the board column is `width: min(100%, 320px); margin-inline: auto`, and `.cx-moves`
    gets `max-height: 220px`
- Constraints this layout has to respect, all checked in the code:
  - **No transformed ancestor**, because `.cx-toast` is `position: fixed`.
  - The section's IntersectionObserver (`threshold: 0.05`) and the arrow-key check (`getBoundingClientRect`
    against the viewport) need the chess `<section>` in normal flow, not pinned and not clipped. It is.
  - The board loads with `fetch("/api/chess")` from the client. The CSP's `connect-src 'self'` covers it.
- Under Activity, the polling effect cleans up when the homepage is hidden and starts again on show (existing behavior).

## 10. Contact integration (D13)

- `useContactForm()` returns `{ errors, status, sending, onSubmit, copyEmail, copied, emailRef }`. Its body is
  `Contact.tsx`'s logic moved over line for line. `validate` comes from `./validate`.
- `ContactPanel.tsx` renders the prototype layout (DESIGN_TOKENS §4.9) with the existing field contract:

| Field | id | name | Attributes kept |
|---|---|---|---|
| Name | `f-name` | `name` | `autoComplete="name"`, `maxLength={80}`, `aria-invalid`, `aria-describedby="e-name"` |
| Email | `f-email` | `email` | `type="email"`, `autoComplete="email"`, `inputMode="email"`, `maxLength={200}`, `aria-*` |
| Message | `f-msg` | `message` | `maxLength={2000}`, `rows={4}`, `data-lenis-prevent`, `aria-*` |
| Honeypot | `f-website` | `website` | wrapper `aria-hidden="true"`, off-screen CSS (D13), `tabIndex={-1}`, `autoComplete="off"` |

  - The form keeps `noValidate` and `onSubmit`. The submit `<button type="submit">` reads "Send it →", or "Sending…"
    while sending.
  - The status line keeps `aria-live="polite"` and the ok/error styling. Error text uses `#B8361A` on the paper form.
  - The email button is a `<button type="button">` showing `site.email` and a Caveat label `copy` / `copied!`,
    with a visually hidden `aria-live="polite"` span that announces the label change.
- **Unchanged:** `/api/contact`, the zod schema, rate limiting, `track("contact_submitted")`.

## 11. SEO, metadata, analytics

- `page.tsx` keeps the `structuredData` object and the `<script type="application/ld+json">` exactly, including the
  `.replace(/</g, "\\u003c")`.
- Root `metadata` in `layout.tsx` doesn't change (title, description, OG, Twitter, robots, canonical).
- `page.tsx` adds only `export const viewport: Viewport = { themeColor: "#F3F1EC" }` (D1).
- There's still exactly one `<h1>`: the hero headline "I build tools / teams actually / use." Section headings are `<h2>`, and
  card titles and "Where I've built." are `<h3>`.
- Internal links: `LatestPosts` links the 3 newest posts and `/blog` (D22). The header also links `/blog`.
- `src/app/sitemap.ts`: bump `lastModified` to the redesign ship date (TASKS T16).
- Analytics: `resume_opened` (hero résumé button), `project_link` (track cards and more-project rows with an `href`),
  `chess_move` (inside ChessSection) and `contact_submitted` (hook). No new events.

## 12. Asset slots

`src/content/home.ts` exports `assets`, a record of `AssetSlot = { src: string | null; alt: string; label: string; width?: number; height?: number }`.
`AssetImage` renders `next/image` (with `sizes` from the caller) when `src` is set. Otherwise it renders a
`<div role="img" aria-label={alt}>` showing `label` in mono (the prototype's placeholder style).

| Slot key | Real path when it arrives | Until then | Used in |
|---|---|---|---|
| `portraitPhoto` | `/carls-dale-escalo-portrait.jpg` (**exists**) | — | Hero |
| `portraitSketch` | `/images/portrait-sketch.png` | `PortraitSketch` SVG | Hero |
| `signature` | `/images/signature.svg` | Hero: onigiri drawing. Contact: Caveat "— Carls" plus `[your real signature]` | Hero, contact |
| `deskPhoto` | `/images/desk.jpg` | `[Photo: you at your desk / code on screen]` | Split left |
| `favoriteDrawing` | `/images/favorite-drawing.jpg` | `[Your favorite drawing]` | Split right |
| `workRmk`, `workBilyo`, `workRelato`, `workTicketing` | `/images/work/{rmk-learning-hub,bilyo,relato,it-ticketing}.jpg` | `[Screenshot: RMK Learning Hub]`, `[Screenshot: Bilyo]`, `[Screenshot: Relato on a phone]`, `[Screenshot: Ticketing dashboard]` | Track |
| `art01`…`art09` | `/images/art/art-01.jpg` … `art-09.jpg` | `[Drawing from @daleonigiri]` | Gallery |
| `post1`…`post5` | `/images/sketchbook/post-1.jpg` … `post-5.jpg` | `[Instagram post]` | Fan |

Don't fetch anything from Instagram (the brief).

## 13. Accessibility contract

- Every interactive element is a real `<a>` or `<button>`, at least 44×44px (DESIGN_TOKENS §3).
- Icon-only buttons have an `aria-label`. The menu button reads "Open menu" or "Close menu" and has `aria-expanded`
  and `aria-controls="home-menu"`.
- Decorative layers (marquee, tape strips, handwritten notes on cards, the big onigiri, the split cards' placeholder
  frames) are `aria-hidden="true"`.
- The statement's word spans sit inside one `<p>` and read as normal text.
- `HomeHeader` closes its menu in a `useLayoutEffect` cleanup (Activity), on Escape, and when a menu link is clicked.
- Contrast is listed in DESIGN_TOKENS §1.6. `coral` (#E8492A) is used only for large text (≥ 24px, or ≥ 18.66px
  bold) and fills. `coral-text` on sand is large text only.
