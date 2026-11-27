# Redesign decision log: "Code by day, ink by night"

Branch: `redesign/ink-by-night`. Written by Claude on 2026-11-27 from `REDESIGN_PROMPT.md` (the brief),
`portfolio-v3-prototype.dc.html.txt` (the prototype), and a read of the repo and the bundled Next.js docs.

Each entry lists the options, the choice and the reason. **Implementers don't reopen these.** If one turns
out to be wrong, stop and tell Claude, who will update this file.

Facts every entry relies on (checked in the repo on 2026-11-27):

- Next.js **16.4.6**, App Router, Turbopack, React 19.3, TypeScript 5. `next.config.ts` sets
  `cacheComponents: true` and `partialPrefetching: true`.
- With `cacheComponents`, Next **keeps up to 3 visited routes in the DOM, hidden by React `<Activity>` with
  `display: none`**, instead of unmounting them. Effects clean up when a route is hidden and run again when it
  shows (`node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`). The homepage's DOM stays in
  the document while you read `/blog`.
- Styling is one global file, `src/app/globals.css`: plain CSS with custom-property tokens and a light/dark theme
  via `data-theme` on `<html>`, set before first paint by an inline script in `src/app/layout.tsx`
  (`localStorage["cde-theme"]`). The blog, admin and 404 pages use the same file and tokens.
- CSP is static (no nonces) in `next.config.ts`: `script-src 'self' 'unsafe-inline' …`, `style-src 'self' 'unsafe-inline'`,
  `font-src 'self'`. `docs/security-plan.md` says not to move to nonces (they'd force dynamic rendering).
- Vitest 4 runs with `environment: "node"`. There's no jsdom or Testing Library.

---

## D1. Section themes replace the light/dark toggle on the homepage only

**Decided by Carls on 2026-11-27** (the brief doesn't cover it).

**Options**
1. Keep the toggle on the homepage too, with a "night" version of each section theme.
2. Section themes drive every color on the homepage, and the toggle and its stored preference keep working everywhere else.
3. Drop the toggle site-wide.

**Choice:** option 2. The homepage has no theme toggle. Its colors come only from the section themes
(`paper`, `sand`, `dark`), whatever `localStorage["cde-theme"]` or the OS says. Every other route keeps the
existing toggle, the stored preference and the OS fallback, unchanged.

### Behavior on the four routes

| Route | What sets the colors | Toggle | Stored preference |
|---|---|---|---|
| `/` (homepage) | The section themes, via the home tokens in `HomeShell.module.css`. `<html>` gets `data-home` and has **no** `data-theme` | **None.** The homepage renders `HomeHeader`, which has no toggle | Ignored and **left untouched** in storage |
| `/blog`, `/blog/[slug]`, `/blog/tag/[tag]` | `data-theme` from storage, else `prefers-color-scheme` (as today) | Yes, `Header variant="blog"` | Read and written as today |
| `/admin/**` | `data-theme` from storage, else OS (as today; admin.css uses the global tokens) | None (as today) | Read as today |
| Any 404 (`src/app/not-found.tsx`) | `data-theme` from storage, else OS (as today) | Yes, `Header variant="blog"` | Read and written as today |

### How the homepage avoids flashing the stored dark theme

The flash can happen on two paths: a hard load of `/`, and a client-side navigation into `/` from a page that
already has `data-theme="dark"` on `<html>`. Three layers cover them:

1. **Hard load: the inline head script skips the stored theme on `/`.** The script in `src/app/layout.tsx` moves to
   `src/lib/theme.ts` as an exported string `themeScript`. On `location.pathname === "/"` it sets
   `data-home=""` on `<html>` and **doesn't** read storage. On any other path it applies the stored theme as
   today. It runs in `<head>` before the body is parsed, so the first frame already has `data-home`.
2. **CSS: `data-home` beats every dark rule.** A new block at the end of the token section of `globals.css`:
   `html:root[data-home] { --bg: #F3F1EC; --ink: #16161A; …; color-scheme: light; }`. Its specificity (0,2,1)
   beats both `:root[data-theme="dark"]` (0,2,0) and the media-query rule `:root:not([data-theme="light"])` (0,2,0),
   so even an OS-dark visitor gets the paper canvas. The homepage content doesn't read the global tokens at all.
   `.root` in `HomeShell.module.css` defines its own `--home-*` tokens and re-points the few global tokens that
   reused components need (see ARCHITECTURE §5). With JavaScript off, the content is still themed correctly; only
   the bare canvas falls back to the `data-home` values set by the head script.
3. **Client navigation: a layout effect swaps the attributes before paint.** `HomeThemeScope` (a client component
   rendered by `src/app/page.tsx`) runs `useLayoutEffect`:
   - on mount or show: `html.setAttribute("data-home", "")` and `html.removeAttribute("data-theme")`
   - on cleanup (unmount, **or Activity hiding the homepage when you navigate away**):
     `html.removeAttribute("data-home")`, then `applyStoredTheme()` from `src/lib/theme.ts`, which reads storage
     again and sets `data-theme` (or leaves it unset for the OS default)

   `useLayoutEffect` runs before the browser paints the committed tree, so neither direction shows a frame of the
   wrong theme. This is the pattern the bundled docs recommend for global state under Activity
   (`preserving-ui-state.md`, "Global styles").

### Every route change

| Path | What happens |
|---|---|
| Hard load `/` (stored = dark) | Head script sets `data-home` and skips storage. First paint is paper. |
| Hard load `/blog` (stored = dark) | Head script sets `data-theme="dark"`, as today. |
| `/blog` → `/` (client `Link`, e.g. the brand link in the blog header) | `HomeThemeScope` mount effect: adds `data-home`, removes `data-theme`, before paint. |
| `/` → `/blog` (client `Link` "Blog" in `HomeHeader`) | Activity hides `/`. `HomeThemeScope` cleanup removes `data-home` and re-applies the stored theme before `/blog` paints. |
| Back/forward between them | The same effects run on Activity show and hide. |
| Toggle on `/blog`, then go to `/` | The toggle writes storage as today. `/` ignores it. Going back to `/blog` re-reads storage, so the new choice shows. |
| `/blog` header links `/#work` etc. | These are plain `<a>` tags, so a hard load of `/` (row 1). |

`theme-color`: `src/app/page.tsx` exports `viewport = { themeColor: "#F3F1EC" }`. That replaces the root layout's
light/dark `themeColor` pair on `/` only, so mobile browser chrome doesn't go dark either.

**Why:** the section themes are the design; a stored dark preference fighting them would break the
day/night story. Carls wants the toggle kept for reading the blog. Storage is never written on `/`, so a
visitor's blog preference survives a trip through the homepage.

---

## D2. Animation lifecycle: one manual `gsap.matchMedia()` per mount, loaded with a dynamic import (no `useGSAP`)

**Options**
1. `useGSAP` from `@gsap/react` in each section component.
2. `useGSAP` once, in `HomeShell`, importing GSAP statically.
3. A plain `useLayoutEffect` in `HomeShell` that dynamically imports `src/components/home/motion/start.ts`, which
   builds everything inside one `gsap.matchMedia()` and returns a cleanup function.

**Choice:** option 3. `gsap.matchMedia()` is a `gsap.context()` (it records and reverts everything created
inside it), so this meets the brief's "use gsap.context()/useGSAP so animations clean up" rule without the
`@gsap/react` dependency.

**Why**
- **Activity.** When the homepage is hidden, its effects clean up. We need *one* synchronous cleanup that reverts every
  ScrollTrigger, every inline style GSAP wrote, the Lenis instance and the ticker hook. One `mm.revert()` plus
  `lenis.destroy()` in a single layout-effect cleanup does that. Per-section hooks (option 1) would spread that across
  ten components and make the order of creation (which ScrollTrigger depends on) follow React's effect order.
- **Bundle and Lighthouse.** GSAP, ScrollTrigger and Lenis load in their own chunk after hydration, so the
  hero's first paint and hydration don't wait for them. The hero's on-load intro is CSS (D10), so nothing visible waits on
  that chunk. `useGSAP` runs its callback synchronously, so it can't wrap an async import without `contextSafe`
  workarounds.
- **The race.** The effect sets `let cancelled = false`. If the cleanup runs before the import resolves,
  `start()` is never called (or its returned cleanup runs straight away). See ARCHITECTURE §4.

---

## D3. Pins: CSS `position: sticky`, with ScrollTrigger used only for scrubbed progress (no `pin: true`)

**Options**
1. ScrollTrigger `pin: true` on each pinned stage (it wraps the element in a `.pin-spacer` div).
2. The prototype's approach: a tall section with a `position: sticky` stage inside it, and ScrollTrigger tweens
   scrubbed over the section's scroll distance.

**Choice:** option 2 for all three pinned scenes (hero, work track, split scene).

**Why**
- **No DOM surgery on React-owned nodes.** `pin: true` re-parents a server-rendered node into a spacer that
  GSAP inserts. That's survivable on a plain mount, but under Activity hide and show it runs on every navigation, and any
  revert ordering mistake leaves a stray spacer in a hidden route.
- **No layout shift.** The tall section heights are plain CSS (`calc(var(--stage-h) + 1000px)` etc.), present in the
  server HTML under the same media query that turns motion on. The page has its final height before JavaScript runs, so
  there's no CLS when ScrollTrigger starts. The only JavaScript-measured length is the work track's horizontal
  distance, and it has a CSS fallback close to the real value (ARCHITECTURE §6).
- **Lenis works with native sticky**, because Lenis drives the real window scroll.
- **Reduced motion and mobile** just get a different media query: height `auto` and `position: static`.
  On screens 760px and wider, reduced motion keeps a real desktop layout (D26).

The scroll distance matches the prototype exactly: `start: "top top"` and
`end: () => "+=" + (section.offsetHeight - stage.offsetHeight)`. The prototype's progress is
`-rect.top / (rect.height - stick)` where `stick = min(100vh, 900px)`, which is the same thing. The root keeps
`overflow-x: clip` (not `hidden`) so sticky still works.

---

## D4. Styling: CSS Modules per component, with the home tokens on one root class (not Tailwind, not globals.css)

**Options**
1. Tailwind v4 (`@tailwindcss/postcss`).
2. More global CSS appended to `src/app/globals.css` under a `.home-*` prefix.
3. CSS Modules (`*.module.css`) next to each component, with home tokens as custom properties on `.root`.

**Choice:** option 3.

**Why**
- **Activity again.** The homepage's stylesheets stay loaded while `/blog` is showing. Module-scoped class names can't
  match anything on the blog, so they can't leak. Global rules could (the docs' "Global styles" warning).
- Tailwind isn't installed. Adding it means a PostCSS config and a preflight reset that would restyle the blog and admin.
  It also doesn't suit the prototype's many one-off values (`clamp(52px, 8.4vw, 124px)`, `rotate: -1.5deg`).
- It matches the repo: plain CSS with custom properties, no UI libraries.

**Rules**
- GSAP finds elements by **`data-anim="…"` attributes**, never by module class names (those are hashed).
- **One class name, one job** (D23). Inside a module, never reuse a short name for two things. For visually hidden
  text, use the existing global **`.sr-only`** from `globals.css`; don't define a module-local copy.
- Only these files touch `globals.css`: the `html:root[data-home]` block (D1) and nothing else. **No other changes to
  `globals.css`**, including no deletions of old homepage classes: `.cx-*`, `.btn` and `.section-label` are still
  used by `ChessSection`, and the rest is harmless dead CSS for a later cleanup.
- Global element rules in `globals.css` that reach the homepage, and must be overridden inside `.root`:
  `main { display: grid; gap: 88px; padding-block: 56px 96px }`, `a { text-underline-offset… }`,
  `:focus-visible { outline: 2px solid var(--accent) }` and `html { scroll-behavior: smooth }`. The last one is on
  `<html>`, which `.root` can't reach. It's handled by `scroll-behavior: auto` in the `html:root[data-home]` block (D7).

---

## D5. Fonts: the three display fonts load on the homepage only; Geist stays global

**Options**
1. Add all five fonts to the root layout.
2. Load Bricolage Grotesque, Instrument Serif and Caveat in a home-only module, and apply their variables on the
   homepage root. Geist and Geist Mono stay in the root layout as they are.

**Choice:** option 2. File: `src/components/home/fonts.ts`, imported only by `src/app/page.tsx`.

| Font | `next/font/google` call | CSS variable | Why these options |
|---|---|---|---|
| Bricolage Grotesque | `Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz"], display: "swap", variable: "--font-bricolage" })` (variable font, no `weight`) | `--font-bricolage` | The prototype loads `opsz 12..96` with weights 500/700/800 and uses 700 and 800. The variable font covers both weights plus optical sizing in one file |
| Instrument Serif | `Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["italic"], display: "swap", variable: "--font-instrument" })` | `--font-instrument` | Every serif use in the prototype is italic 400. Upright isn't used, so it isn't loaded |
| Caveat | `Caveat({ subsets: ["latin"], weight: "700", display: "swap", variable: "--font-caveat" })` | `--font-caveat` | The prototype loads 500 and 700 and uses only 700 |
| Geist / Geist Mono | unchanged in `src/app/layout.tsx` | `--font-geist-sans`, `--font-geist-mono` | Already global; the blog uses them |

All three keep the default `preload: true`, because all three are above the fold in the hero. `next/font`
self-hosts the files, which the CSP's `font-src 'self'` needs. The prototype's Google Fonts `<link>` must **not**
be copied: the CSP would block it. These options are checked against
`node_modules/next/dist/compiled/@next/font/dist/google/font-data.json` (Bricolage has an `opsz` axis, Instrument
Serif is 400 normal/italic only, Caveat's weights are 400–700).

---

## D6. Background color transitions: GSAP tweens two custom properties on the homepage root

**Options**
1. The prototype's approach: register `@property --bg`/`--fg` as `<color>` and use a CSS
   `transition: --bg .9s ease`, set from a rAF loop.
2. GSAP tweens `--home-bg` and `--home-fg` on the root element from ScrollTrigger callbacks.

**Choice:** option 2: `gsap.to(root, { "--home-bg": bg, "--home-fg": fg, duration: 0.9, ease: "power1.inOut", overwrite: "auto" })`.
GSAP interpolates colors held in custom properties.

**Why:** `@property` is a global at-rule that CSS Modules won't scope, and it would be one more global that outlives the
page under Activity. A GSAP tween is recorded in the matchMedia context (created through `context.add(null, fn)`), so cleanup
reverts it and removes the inline custom properties. `power1.inOut` stands in for CSS `ease`; the brief only fixes
the 0.9s duration.

**How it works:** while motion is on (`data-motion="on"` on the root), every `[data-home-theme]` section's own
background is `transparent` and its color `inherit`, so the tweened root color shows through. This is the
prototype's `.live [data-bg]{background:transparent!important}`. With reduced motion the color tween **still runs**; only movement is removed (D25). Details in ARCHITECTURE §5.

---

## D7. Lenis: homepage only, driven by the GSAP ticker, destroyed on hide

**Choice**
- Created inside `start()` for the `full` and `mobile` conditions, never for `reduce` (the brief: "no Lenis").
- Options: `new Lenis({ autoRaf: false, lerp: 0.09, smoothWheel: true, anchors: true })`. `lerp: 0.09` is the
  prototype's own easing (`cur += (target - cur) * 0.09` per frame). `syncTouch` stays at its default (`false`), so
  touch scrolling stays native, as in the prototype, which only smooths wheel input.
- Wiring, as the brief says: `lenis.on("scroll", ScrollTrigger.update)`,
  `gsap.ticker.add(raf)` where `raf = (t) => lenis.raf(t * 1000)`, and `gsap.ticker.lagSmoothing(0)`.
- Cleanup: `gsap.ticker.remove(raf)`, `gsap.ticker.lagSmoothing(500, 33)` (GSAP's default), `lenis.destroy()`.
  `destroy()` removes the `lenis*` classes from `<html>`, so the blog never sees them.
- Lenis's stylesheet (`lenis/dist/lenis.css`) is imported once in `HomeShell.tsx`. Its rules only match
  `html.lenis…`, so they're inert off the homepage. Check the path after install (TASKS T01).
- **Native smooth scrolling must be off on the homepage.** `globals.css` has `html { scroll-behavior: smooth }`, and
  Lenis 1.3.x's stylesheet **no longer** resets it (checked in the 1.3.27 and 1.3.29 builds on 2026-11-27). With both
  active, the browser's smooth scroll fights Lenis on every frame. The `html:root[data-home]` block (D1) therefore also
  sets `scroll-behavior: auto`. In-page anchors are still smooth through Lenis's `anchors: true`, and they jump
  instantly under reduced motion, as they should.
- Scroll containers inside the page get `data-lenis-prevent`, so wheel input scrolls them and not the page:
  the chess move list (`.cx-moves` in `ChessSection.tsx`) and the contact `<textarea>`.

**Why homepage-only:** the brief asks for it on the redesign. The blog is a reading page, and the existing blog TOC and
scroll code weren't built for it.

---

## D8. Three motion conditions, and the CSS uses the same media queries

The brief says "below 760px". The prototype uses `max-width: 760px` in CSS but `vw >= 760` in JavaScript, so at
exactly 760px they disagree. We use **mobile = `< 760px`**, written as `(max-width: 759.98px)`.

```js
mm.add({
  full:   "(min-width: 760px) and (prefers-reduced-motion: no-preference)",
  mobile: "(max-width: 759.98px) and (prefers-reduced-motion: no-preference)",
  reduce: "(prefers-reduced-motion: reduce)",
}, (context) => { … })
```

The hero has a stricter test inside `full` (D24): `heroPinned = window.matchMedia("(min-width: 1024px) and (min-height: 560px)")`.
It's implemented as a fourth `mm.add` key, so it re-evaluates on resize:
`heroPinned: "(min-width: 1024px) and (min-height: 560px) and (prefers-reduced-motion: no-preference)"`.

`reduce` is **not** "no motion": it runs the calm tier (D25). Layout CSS also uses `wideCalm`
(`(min-width: 760px) and (prefers-reduced-motion: reduce)`) for the reduced-motion desktop layouts (D26).

**Every layout difference is pure CSS using the same query strings** (copied into each `*.module.css`). JavaScript
never switches layouts; it only adds motion to whichever layout CSS has already chosen. So there's no layout jump
when the motion chunk loads, and reduced-motion and no-JS visitors get a complete layout.

---

## D9. One motion orchestrator and server-rendered sections, not a client component per section

**Options**
1. Make every section a client component with its own animation hook.
2. Keep sections as server components that render plain markup with `data-anim` attributes. One client
   `HomeShell` runs `start(root)`, which calls one function per section (`heroMotion`, `trackMotion`, …) in DOM order.

**Choice:** option 2. Client components are used only where there's real interaction: `HomeHeader` (menu),
`PortraitReveal` (pointer), `MoreWork` (show more), `ChessSection` (existing), `ContactPanel` (form),
`HomeThemeScope`, `HomeShell`.

**Why:** less client JavaScript (better for Lighthouse), one cleanup (D2), and ScrollTriggers get created
top to bottom, which is the order ScrollTrigger needs to compute pin-affected start positions.

---

## D10. The hero's on-load intro is CSS keyframes, not GSAP, and runs only with `no-preference`

The prototype's `.in` / `@keyframes up` and the underline's `@keyframes draw` are ported as CSS in
`Hero.module.css`. They play on first paint without waiting for the motion chunk (good for LCP and for perceived speed).

**Important:** the hidden starting state (`opacity: 0`, `stroke-dashoffset: 1000`) must live **inside**
`@media (prefers-reduced-motion: no-preference)`. `globals.css` has
`@media (prefers-reduced-motion: reduce) { * { animation: none !important } }`. If the `opacity: 0` sat outside
the query, reduced-motion visitors would get an invisible hero.

The marquee rows (`mq` 28s and `mqr` 32s, linear, infinite) are CSS too, behind the same media query.

When Activity shows the homepage again (back from `/blog`), the CSS intro replays, because elements that were
`display: none` restart their animations. That's acceptable and arguably nice, so don't suppress it.

---

## D11. Refreshing ScrollTrigger: fonts, specific resize observers and the URL hash, not a global observer

Positions go stale when content above a trigger changes height. Sources here: web fonts swapping in, the "Show more"
list in `MoreWork` and the chess block (board load, history bar, hint text).

**Choice**
- `document.fonts.ready.then(() => ScrollTrigger.refresh())`, guarded by `cancelled`.
- A `ResizeObserver` on every element with `data-refresh-on-resize` (only the `MoreWork` list and the chess wrapper),
  which calls `ScrollTrigger.refresh()` debounced to 150 ms. Neither element contains a sticky stage, so the
  refresh can't change their size and loop.
- After the first refresh, if `location.hash` names an element, `lenis.scrollTo(target, { immediate: true })` (or
  `target.scrollIntoView()` when Lenis is off). That fixes the blog header's `/#work`-style links landing in the wrong
  place after heights settle.
- **Not** one `ResizeObserver` on the root: ScrollTrigger's own refresh writes `--hz-extra` and could loop.

---

## D12. Chess: reuse `ChessSection` as is, restyle it through tokens, and drop the prototype's teaser

The prototype shows a fake teaser board with a "Play your move →" link to the old site. The brief says to hook up the
real feature "in the new styling" and not rebuild its logic.

**Choice**
- `NightSection` renders the existing `<ChessSection />` inside a framed block (prototype teaser frame: 1.5px
  `#F3F1EC33` border, 20px radius, 32px padding, 120px top margin), with the Caveat note "one move per day, one shared game" above it.
- Restyling goes through a wrapper class `.chessFrame` in `NightSection.module.css` that **re-points the global
  tokens** `ChessSection`'s `cx-*` classes already read (`--bg`, `--surface`, `--ink`, …; values in
  DESIGN_TOKENS §1.4). Optional extra polish uses `.chessFrame :global(.cx-…)` selectors. Its rules never leave
  `.chessFrame`.
- **The only change to `src/components/ChessSection.tsx`:** add `data-lenis-prevent` to the `.cx-moves` div. Nothing
  else: not the polling, ETags, optimistic moves, keyboard handling or markup.
- **The chess frame must never be inside an element with a `transform`.** `.cx-toast` is `position: fixed`, and a
  transformed ancestor would trap it. So the chess frame gets an **opacity-only** reveal (no `y`), and it isn't inside a parallax column.
- The section keeps `id="chess"` (it comes from `ChessSection`), so `/#chess` links keep working.
- **Compact, not dominant (Carls, 2026-11-27).** The chess frame is a small card in the night section; the art grid
  stays the star. At ≥ 1024px: text (`.cx-head`) on the left; board column (max **320px**) and move list (**220px**)
  side by side on the right. 760–1023px: the text sits above, with the board and list side by side. Below 760px:
  everything stacks, board `min(100%, 320px)` centered, move list `max-height: 220px`. Frame padding is 24px.
  It's all done with `.chessFrame :global(...)` overrides; the markup doesn't change (DESIGN_TOKENS §4.8).

---

## D13. Contact: pull the logic into a hook, keep the API, honeypot and analytics as they are

**Choice**
- Move the logic of `src/components/Contact.tsx` (validate, submit, status, field errors, copy email,
  `track("contact_submitted")`) **without changing behavior** into `src/components/home/contact/useContactForm.ts`. Move
  `validate()` to `src/components/home/contact/validate.ts` so it can be unit-tested in node.
- New markup in `src/components/home/contact/ContactPanel.tsx`, following the prototype layout. Field `name`s,
  `id`s, `maxLength`s, `autoComplete`s, `aria-invalid`/`aria-describedby` and error elements stay the same.
- **Honeypot:** kept exactly. The wrapper stays off-screen (`position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden`)
  with `aria-hidden="true"`, the input stays `name="website"`, `tabIndex={-1}`, `autoComplete="off"`, and it's still
  sent in the JSON body. That keeps it hidden from sight and from screen readers, as the brief requires. Don't switch to
  `display: none` or remove the field. `src/app/api/contact/route.ts` and `src/lib/contact.ts` don't change.
- Copy email follows the prototype's labels (`copy` → `copied!` for 1800 ms) and keeps the existing fallback
  (select the text, then "Selected. Press Ctrl+C to copy.") for blocked clipboards.
- Landmarks: the dark panel is a wrapper `<div data-anim="contact-grow">` placed **after `</main>`**. It contains
  `<section id="contact">` (a region, labelled by its heading) and the page's `<footer>` (contentinfo). The footer
  sits visually inside the panel, as in the prototype.
- `src/components/Contact.tsx` is deleted once nothing imports it (TASKS T16).

---

## D14. Old homepage sections the brief leaves out

The brief's page sequence has no "Writing" list (latest 3 posts), no "Skills" list and no About bio/facts.

**Choice:** follow the brief and don't render them. Keep the data: `skills` still feeds the JSON-LD `knowsAbout`, and
`getLatestPosts` stays in `src/lib/blog/public.ts` (it's tested).
- The blog `Header`'s section links (`src/components/Header.tsx` `sections`) point at homepage ids. The new homepage
  keeps `about` (statement), `work`, `experience` ("Where I've built"), `chess` and `contact`. It has no `skills`,
  so **remove only the `skills` entry** from `sections`. Don't change anything else in `Header.tsx`.
- The "Writing" part of this entry is superseded by **D22**: Carls asked for a "Latest from the blog" row.

---

## D15. Content: real data wins over the prototype's placeholder copy and links

The brief says to reuse real copy and links. The prototype has placeholder links (`Résumé (PDF)` → the homepage,
`Bilyo` → the homepage, `Relato` → `play.google.com`).

**Choice**
- Links and data come from `src/content/*`: `site.resume` (opened via `TrackedLink` with `event="resume_opened"`),
  project `href`s and `tags` from `featuredProjects`, rows from `moreProjects`, jobs and education from `experience.ts`.
  Project links keep `TrackedLink event="project_link" eventData={{ project: slugifyProject(title) }}`.
- Add `instagram: "https://www.instagram.com/daleonigiri/"` to `site.socials`. It then also appears in the JSON-LD
  `sameAs` (correct, since it's Carls's account).
- Redesign-only copy (headline lines, statement, card kicker lines, handwritten notes, captions, art slots, marquee
  text) goes in a new `src/content/home.ts`, copied verbatim from the prototype and brief. Every image is an
  **asset slot** `{ src: string | null; alt: string; label: string }`. `src: null` renders the labelled placeholder, a
  path renders `next/image`. Swapping a real asset in is then a one-line content change.
- The card copy uses the prototype's shorter descriptions (`home.ts`), because they're edits of the real copy to fit
  the card. Stack lines use `featuredProjects[].tags.join(" · ")`.
- No new analytics events (Carls set the list of four in the admin plan).

---

## D16. Canvas color: paper, not the prototype's `#16161A` body

The prototype sets `body{background:#16161A}`; that's the color under its preview frame. Here the canvas is
`--bg` under `html:root[data-home]` = **`#F3F1EC`**.

**Why:** the content covers the canvas, so it only shows during overscroll and before first paint. A dark
canvas there is the exact "dark flash" D1 forbids, and it couldn't be told apart from a regression in testing.

---

## D17. Fixes where the prototype doesn't hold up outside a 1440px preview

The prototype was built for a 1440×13200 frame. These are deliberate changes, all small:

1. **Hero pin needs room.** *Revised by D24:* the threshold is now 1024 × 560, and the content is sized to fit the
   stage. The fallback below applies only under 1024px wide, under 560px tall, or with reduced motion.
   (Original:) At widths under 1024px or heights under 700px, the hero content (headline, paragraph,
   CTAs and the 4:5 portrait) is taller than the sticky stage, and the stage's `overflow: hidden` cuts off the portrait.
   So the shrink scene runs only under `heroPinned` (D8). Otherwise the hero card is in normal flow
   (height `auto`), and the dark marquee band sits below it as a plain block (CSS marquee still runs). The onigiri
   is stroked by a scrub over that band (`start: "top 80%"`, `end: "bottom 40%"`). Under `reduce` it's shown fully drawn.
2. **The split scene and work track are vertical below 760px** (the brief). The prototype only unpins the track, so
   the split scene's static layout is specified in ARCHITECTURE §6.3.
3. **No gallery parallax and no column stagger below 760px.** On one column, moving columns −80px and +110px
   would overlap their neighbours (the gap is 28px).
4. **The fan shrinks below 760px.** Card width 180px (margin-left −90px) and an x step of 70px instead of 140px.
   Rotation (9°) and y (28px) stay. At 140px the outer cards sit about 400px off center, which would clip at 375px.
5. **The mobile menu gains a "Blog" link** (the prototype's mobile menu leaves it out). The order is "On the clock",
   "Off the clock", "Blog", "Let's talk →".
6. **The portrait reveal works without a mouse** (D18).
7. **The 760px boundary** (D8).

---

## D18. Portrait sketch reveal: CSS variables set directly, plus a real button for touch and keyboard

- The photo layer has `mask-image: radial-gradient(circle var(--r) at var(--mx) var(--my), transparent 98%, #000 100%)`
  (plus `-webkit-mask-image`). The defaults are `--r: 120px` and `--mx/--my: -400px`. That's the prototype's mask with its
  `{{mx}}`/`{{my}}` holes as custom properties.
- `pointermove` (pointerType `mouse` or `pen`) sets `--mx`/`--my` with `el.style.setProperty`, **with no React state**,
  so moving the mouse doesn't re-render. On `pointerleave` they go back to `-400px`.
- The card is a `<button type="button" aria-pressed>`, labelled "Show the sketch under the photo". Clicking or
  tapping toggles the full reveal: `--r: 1000px; --mx: 50%; --my: 50%` (a `circle` radius must be a length, not a
  percentage), which shows the whole sketch, and `aria-pressed` flips. That
  covers touch ("tap-to-toggle", one of the brief's two options) and keyboard users.
- Caption: "↑ hover me — there's a sketch underneath" when `(hover: hover)`, and "↑ tap me — there's a sketch
  underneath" under `@media (hover: none)`, both in the DOM and switched with CSS.
- The photo is the real `public/carls-dale-escalo-portrait.jpg` (768×960, so 4:5, which matches the frame).
  The sketch is a placeholder: the prototype's SVG line sketch, ported as JSX, until
  `public/images/portrait-sketch.png` exists.

---

## D19. Transforms: GSAP owns `transform`; CSS hover and tilt use the separate `rotate`/`translate`/`scale` properties

GSAP writes the `transform` property. The prototype tilts cards with the separate CSS `rotate` property, and its hover
(`.case:hover{rotate:0deg}`) uses that same property. They compose without clobbering each other.

**Rules**
- Card tilt and hover-straighten: CSS `rotate`. Drift: GSAP `y` (transform).
- Buttons (`transform: translate(-3px,-3px)` on hover) and art frames (`transform: scale(1.03)`) must **never** be GSAP
  targets. Put reveals on a wrapper element. Example: the prototype's `.btn.rv` copy-email button becomes a wrapper
  `div[data-anim="reveal"]` around a plain button.
- Hero shrink: the brief allows only transform, opacity, clip-path and colors, but the prototype also animates `border-radius`
  and `box-shadow`. So:
  - the radius becomes `clip-path: inset(0% round 0px → 36px)` on the card
  - the deep shadow becomes a sibling layer behind the card, carrying a fixed `0 50px 90px rgb(0 0 0)` shadow, with
    opacity tweened `0 → 0.7`

  It looks the same at 60fps.

---

## D20. Testing: pure functions in Vitest, browser checks for motion

There's no DOM test environment, and adding jsdom just to assert GSAP calls would test mocks, not motion.

**Choice**
- Unit-test the pure parts in node:
  - `src/lib/theme.test.ts`: runs `themeScript` against a stub `document`, `location` and `localStorage`
  - `src/components/home/motion/math.test.ts`: track distance, fan transform, parallax range
  - `src/components/home/contact/validate.test.ts`
  - `src/content/home.test.ts`: content invariants
- Everything visual is checked in the browser against the acceptance criteria in TASKS.md. No new test dependencies.

---

## D21. Dependencies

| Package | Version range | Why |
|---|---|---|
| `gsap` | `^3.15.1` (latest on 2026-11-27) | Includes ScrollTrigger (`gsap/ScrollTrigger`). GSAP and all its plugins are free under the standard GSAP license |
| `lenis` | `^1.3.27` | Smooth wheel scrolling. 1.3.29 came out on 2026-11-26. The prototype artifact was verified against 1.3.27 (2026-10-15); the caret range allows either |

Not added: `@gsap/react` (D2), Tailwind (D4), jsdom or Testing Library (D20). Both added packages are client-only and
bundled from `node_modules`, so the CSP doesn't need to change. **Don't edit `next.config.ts`.**

---

## D22. "Latest from the blog" row in the sand section

**Decided by Carls on 2026-11-27.** This brings back the internal links from the homepage to posts that D14 dropped.

**Choice**
- New server component `src/components/home/work/LatestPosts.tsx` `[S]`, rendered **after `ExperienceStrip`**
  inside the same `<section data-home-theme="sand">` wrapper (the work section's sand half).
- Data: the existing `getLatestPosts(3)` from `src/lib/blog/public.ts`, unchanged. It's already `"use cache"` with
  `cacheTag("posts")`, so admin publishes refresh it and the page stays prerendered, as the old `Writing` section did.
  If it returns `[]` (no posts, or Mongo not configured), the component renders **nothing**.
- Each row: post **title**, **date** (`en-US`, `{ month: "short", day: "numeric", year: "numeric" }`, the same format
  `Writing.tsx` uses) and **read time** (`{readingMinutes} min read`). No views or likes. Each row is a `next/link` to
  `/blog/{slug}`. After the list comes an **"All posts →"** link to `/blog`.
- Look: the same row pattern as the more-projects list (1.5px ink top rule, `#16161A33` row rules, Bricolage 700 22px
  title, Geist Mono 12px muted meta). The heading is "Latest from the *blog.*" in the same style and spacing as
  "Where I've *built.*", with "blog." in Instrument Serif italic coral-text. "All posts →" is a secondary pill
  button (card background, like "Show more").
- Motion: **one `data-anim="reveal"` on the whole block** (the generic fade-up 56px). No heading-line mask, no pin, no
  scrubbed effect of its own.
- Task: **T07b** `[gemini]`, in batch B after T07.

**Why:** posts are the site's freshest content, and homepage links help crawlers and recruiters find them. The sand
section is the "on the clock" half, where write-ups about work belong. Reusing the cached helper keeps the data path the
same one the blog already uses.

---

## D23. No class-name collisions (found in the prototype)

The first prototype defined `.sr` twice: once as the screen-reader-only utility and once as the split scene's right card.
The card picked up the 1px clipped styles and never showed. The prototype now uses `.visually-hidden` and
`.split-l`/`.split-r`.

**Rule for the real build**
- CSS Modules hash class names per file, so two components can't clash. A clash **inside one module file** still can,
  and so can a module class with the same name as a global from `globals.css` used through `:global(…)`.
- Use descriptive module class names (`.splitLeft`, `.splitRight`, not `.sl`/`.sr`). Never define the same class twice
  in one module. Use the global `.sr-only` for hidden text.
- T08 and T16 check that both split cards are visible.

---

## D24. The hero pin fits laptop screens (Carls, 2026-11-27)

Most laptop browser viewports are 600–680px tall, so the original `min-height: 700px` threshold meant the hero shrink
almost never ran.

**Options**
1. Keep 700px and accept a static hero on most laptops.
2. Lower the threshold and size the hero content against the stage height, so it fits the pinned frame.

**Choice:** option 2.
- `heroPinned` = `(min-width: 1024px) and (min-height: 560px) and (prefers-reduced-motion: no-preference)`. Static
  fallback only under 1024px wide, under 560px tall, or with reduced motion.
- **The pinned hero sits under the header:** the hero section gets `margin-top: calc(-1 * var(--header-h))`, with
  `--header-h: 74px` (the measured sticky-header height: 14 + 44 + 14 + 1.5 border). Without it, the stage starts 74px
  down, and at scroll 0 the bottom 74px (the CTA row) sits below the fold. The card's top padding already clears the
  header.
- **Fitting rules under `heroPinned`** (DESIGN_TOKENS §3.1):
  - h1 `font-size: clamp(44px, min(8.4vw, calc((var(--stage-h) - 360px) * .37)), 124px)`
  - portrait width `min(100%, calc((var(--stage-h) - 280px) * .8))`, so its height is about the stage height − 280px
  - on short screens (`max-height: 759.98px`): card padding `84px 24px 20px`, hero row gap 40px, paragraph margin-top
    20px, CTA margin-top 24px, caption margin-top 12px
- **Measured in the prototype on 2026-11-27** (content block inside the card, under the 74px header):

| Viewport | h1 size | Content spans | Fits |
|---|---|---|---|
| 1024 × 560 | 74px | 88 → 537 | yes, with 23px to spare |
| 1280 × 600 | 88.8px | 89 → 576 | yes, with 24px to spare |
| 1440 × 900 | 121px | 181 → 781 | yes |

**Why:** the shrink-off-the-marquee opening is the signature moment of the design, so it has to run on ordinary
laptops. Sizing against `--stage-h` keeps one layout that scales, instead of switching the effect off.

---

## D25. Reduced motion is a calm tier, not "everything off" (Carls, 2026-11-27)

The first plan turned every effect off under `prefers-reduced-motion: reduce`. That removed the color story and the
reading rhythm, which don't trigger vestibular symptoms.

**Choice:** with `reduce`, keep effects that change color, opacity or a stroke in place, and drop everything that moves
things across the screen.

| Effect | Full / mobile | Reduced motion |
|---|---|---|
| Background/text color tween between sections (0.9s) | on | **on** |
| Statement words 20% → 100% opacity | on | **on** |
| Generic reveal (`reveal`) | opacity plus `y: 56 → 0` | **opacity only** (no `y`) |
| `reveal-fade` (chess frame) | opacity | **opacity** |
| Onigiri stroke draw | over the hero pin, or over the band | **on**, scrubbed over the marquee band (`heroStaticMotion`) |
| Heading line slide-up (`heading-line`) | on | off: shown in place |
| Lenis smooth scroll | on | off (native scroll, instant anchors) |
| Pins (hero, track, split) | on (`full` / `heroPinned`) | off |
| Horizontal track and card drift | on (`full`) | off |
| Gallery parallax | on (`full`) | off |
| Hero scale/rotate shrink | on (`heroPinned`) | off: static hero |
| Fan spread | animates from a stack | off: **shown already fanned** (CSS finished state) |
| Contact clip-path growth | on | off: panel already open (CSS finished state) |
| Marquee rows | CSS loop | off: static rows |
| Hero intro on load (CSS `up`, underline `draw`) | on | off: everything visible, underline drawn |

**Notes**
- `data-motion="on"` is set in the calm tier too, so sections go transparent and the root color tween shows through.
- The hero intro stays off under `reduce` because `globals.css` already has
  `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; animation: none !important } }`
  for the whole site, and that file is out of scope (D4). Hover transitions are also instant under `reduce` for the
  same reason, which is fine.
- Implementation: `start()` no longer returns early for `reduce`. It runs `sectionThemes`, `heroStaticMotion`,
  `wordsMotion` and `revealMotion(root, { moveY: false })` (which also applies to `reveal-fade`), plus `watchRefresh` with
  no Lenis (ARCHITECTURE §4.2).

**Why:** the brief asks to respect reduced motion. The vestibular triggers are motion across the screen, scaling,
parallax and smooth-scroll hijacking, and all of those are off. Color, opacity and stroke changes in place are
generally considered safe, and they carry the day-to-night story.

---

## D26. Reduced motion removes movement, not the desktop layout (Carls, 2026-11-27)

In the first prototype, every non-pinned layout was the phone layout, so a 1900px reduced-motion screen showed one
narrow centered column of cards.

**Rule everywhere:** layout depends on **width only**. Single-column stacking happens only below 760px. At 760px and
wider with reduced motion (`wideCalm`):
- **Work section:**
  - the intro panel ("01 / SELECTED WORK", "On the *clock.*", copy, note) is a normal heading row (max-width 640px)
    above the cards
  - the four project cards are a **2-column grid** inside the 1240px container (`gap: 64px 56px`), keeping the tilt,
    tape, ink shadows and handwritten notes; the second-column cards (Bilyo, IT Ticketing) sit **40px lower**
    (`margin-top: 40px`)
  - "+ 8 more projects *below ↓*" is a full-width row below the grid
  - no progress bar
- **Split scene:**
  - the two cards sit **beside the heading** (grid `l h r`: `minmax(0,1fr) auto minmax(0,1fr)`, cards
    `min(100%, 300px)`, centered vertically)
  - "Ink by *night.*" is a normal **full-width** dark block below, full-bleed: `width: 100vw; margin-inline: calc(50% - 50vw)`
- **Hero:** the static hero (the card in flow, the band below, the onigiri drawing over the band).
- **Gallery:** 3 columns with the 0/120/40px stagger, and no parallax.
- **Fan:** fanned out at the 140px step. **Contact:** open panel with 40px corners.

**Why:** reduced motion is a motion preference, not a screen size. Desktop visitors who set it should still get the
desktop composition.
