# Review R2: batch B2 (T10–T13)

Reviewed by Claude on 2026-11-27, against `5a38a33..a6c2817` (T10 `5638623`, T11 `7f39462`, T12 `46b518b`,
T13 `a6c2817`).

**Result: passed (2026-11-28).** R2.1 (`2191d25`) and R2.2 (`a5f95ab`) are fixed and re-checked (see the end of this file). B3 can start.

Original result: two fixes (R2.1, R2.2). Everything else in B2 meets its acceptance criteria. The code follows
ARCHITECTURE §4, §5.3, §7 and §8 closely: synchronous `start()`, the D25 calm-tier branch, `context.add(null, fn)`,
normalized scrub timelines, sticky pins (no `pin: true`) and the full cleanup chain. Both findings are gaps in my
spec, not departures from it. R2.1 comes from the prototype's own CSS + GSAP pattern. The spec is fixed in
ARCHITECTURE §7.3/§7.4 (new "Elements with a CSS `rotate`" note) and DESIGN_TOKENS §5.5/§5.10.

## Fix list for Gemini

Commit each one as `fix(home): R2.<n> …`, with `npm run lint`, `npm test` and `npm run build` passing. Don't push.

### R2.1 GSAP transform tweens break the card hover and leave inline styles behind (T10, T12)

The track cards and split cards use the CSS `rotate` property. When GSAP first tweens `y` or `xPercent` on them, it
folds that rotation into an inline `transform` and writes `translate: none; rotate: none; scale: none` inline. Two
effects, both measured in headless Chrome:

- **Card hover is dead in full motion.** At 1440 × 900, hovering the RMK card keeps computed `rotate: none` and the
  −1.5° matrix. It should straighten to `0deg` (DESIGN_TOKENS §5.5), as it does under reduced motion.
- **Leftovers after `/` → `/blog` (T10) and after a media-query flip.** After the page is hidden, the 4
  `track-drift` articles keep `transform: rotate(…); translate: none; rotate: none; scale: none`, and `split-left` /
  `split-right` keep `transform: rotate(∓5deg); …`. The server HTML has only `--rotate` on the cards and no inline
  style on the split cards. The same leftovers stay after you resize to 700px or turn on reduced motion, so the hover
  is dead there too.

Fix (ARCHITECTURE §7.3, §7.4 and the new note under §7.4): tween a custom property, and let CSS apply it with
`translate`.

- `src/components/home/work/WorkTrack.module.css:58` `.card`: add `translate: 0 var(--drift-y, 0px);`.
- `src/components/home/motion/track.ts:52`: replace the `y` tween with
  `tl.fromTo(card, { "--drift-y": "0px" }, { "--drift-y": `${drift}px`, duration: 1, ease: "none" }, 0)`.
- `src/components/home/SplitScene.module.css:18-19` (the shared `.splitLeft, .splitRight` rule): add
  `translate: var(--split-x, 0%) 0;`.
- `src/components/home/motion/split.ts:24-38`: replace the two `xPercent` tweens with
  `{ "--split-x": "-130%" } → { "--split-x": "0%", duration: 0.35, ease: "none" }` (left) and
  `{ "--split-x": "130%" } → { "--split-x": "0%", … }` (right). Keep positions and the overlay as they are.
- Change nothing else: `track`, `track-bar`, the hero, the fan and the gallery have no CSS `rotate`, and they don't
  leak.
- Check (at 1440 × 900, full motion):
  - Hover a track card mid-track: computed `rotate` goes to `0deg`, and the card still drifts vertically while you scroll.
  - Mid-track, a card's inline style is only `--rotate: …; --drift-y: …`, with no `transform` or `rotate`.
  - At the end of the split pin, both cards sit where they did before (no visual change).
  - Go `/` → "Blog" → back → "Blog": while hidden, no `[data-anim]` element has `transform`, `translate`, `rotate` or
    `scale` in its inline style.
  - Resize to 700px, then turn on reduced motion: same result, and the hover straightens.

### R2.2 `/#experience` lands under the sticky header (T10)

`#experience` is a `<div>` (`ExperienceStrip.tsx:10`), so it doesn't get `globals.css`'s
`section { scroll-margin-top: 80px }`. Loading `/#experience` at 1440 × 900 and at 375 puts the strip's top at 0, and
the 74px header covers "Where I've built.". (`/#chess` is a `<section>` and lands correctly at 80px.)

- `src/components/home/work/MoreWork.module.css:64` `.expWrap`: add `scroll-margin-top: 80px;` (DESIGN_TOKENS §5.10,
  "Anchor offset").
- Check: load `/#experience` at 1440 × 900 and at 375 × 800. The heading's top is at about 80px, below the header.
  `/#work` and `/#chess` still land at 80px.

## What was checked

- `npm run lint`, `npm test` (26 files, 140 tests) and `npm run build` pass. `/` is still prerendered
  (`.next/server/app/index.html`).
- **T13 diff:** `git diff 5a38a33..HEAD -- src/components/ChessSection.tsx` is exactly one added `data-lenis-prevent`.
  `page.tsx` only drops the temporary `<ChessSection />` and its import.
- **T10 Activity cleanup** (headless Chrome against `next start`; I reached ScrollTrigger's internal trigger list
  through CDP closure scopes, so no code was changed to expose it): `/` mid-page has 57 triggers and the `lenis` class.
  After "Blog", the list has **0** triggers, `<html>` has no `lenis` class, the root has no `data-motion`,
  `--home-bg` or `--home-fg`, `--hz-extra` is removed, and there are no `.pin-spacer`s. Back gives 57 again, and a
  second round trip gives 57 again (no duplicates). The only leftover inline styles are R2.1's.
- **Themes:** at 1440, 900, 375 and 1024 × 560 in full motion, and at 1440 in reduced motion, the root goes paper →
  sand → sand → paper → ink → paper, and back to paper at the top. A reload in mid-night syncs straight to ink.
- **Pins (T12):** hero 1000px at 1440 × 900 and 1024 × 560 (static at 900 and 375). Split 1400px at 1440, 1024 and
  900. Track = `scrollWidth − innerWidth` = `--hz-extra` (1813 at 1440, 2288 at 900, 2179 at 1024 × 560). The
  ScrollTrigger start/end values equal the section top and top + distance. Resizing 1440 → 900 mid-track recomputes
  the distance (2288) and height (3188) with no overflow.
- **Live media changes:** 1440 → 700 → 1440, then reduced motion on → off, while the page is open. Each tier's layout
  and Lenis state matches, with no console errors or exceptions.
- **Calm tier (D25)**, scrolled top to bottom: no GSAP transform or clip-path in any inline style, words fade, the fan
  is fanned out by CSS, and the contact panel is open (`inset(0% round 40px 40px 0 0)`).
- **Hash:** `/#chess` lands at 80px and `/#experience` lands at 0 (R2.2).
- **Chess (T13):** no transformed, filtered or paint-contained ancestor (so the toast stays fixed to the viewport).
  Frame padding is 24px. At 1440: two columns, board 320px, move list 218px + border, and the frame (531px) is much
  shorter than the gallery (1670px). At 900: one column with the board and list side by side. At 375: stacked, board
  277px and centered, move list `max-height: 220px`. `.cx-moves` has `data-lenis-prevent`. Local `/api/chess` returns
  503, so moves, the toast position and polling weren't exercised. That's the existing local behavior; T16 checks it
  on a preview.
- **R1 re-check:** no card note overlaps at 320, 375, 759, 1024, 1440 and 1920 (full) or at 760, 900, 1000 and 1440
  (reduced).
- **Spec doc fix:** DESIGN_TOKENS §4.8 said the chess frame padding was 32px, while §3, D12 and the prototype say 24px.
  Gemini used 24px, which is correct, and §4.8 now agrees.

## Not checked (left for T16)

Real wheel/trackpad feel, frame rate and long tasks, chess move/toast/polling against a live API, and the theme
staying on the last section after a jump past the sketchbook (the trigger never toggles; behavior is the same as the
prototype, and nothing sits on paper there because the contact panel is ink).

## Re-check (2026-11-28): R2.1 and R2.2 passed

- `2191d25` and `a5f95ab` match the fix list exactly (5 files, +13/−5). Lint, `npm test` (26 files, 140 tests) and the
  build pass, and `/` is still `○`.
- R2.1: at 1440 × 900 in full motion, the RMK card's inline style mid-track is `--rotate: -1.5deg; --drift-y: -1.38px`
  with no `transform`. Hover straightens it (`rotate` −1.5deg → 0deg), the same as under reduced motion. The split
  cards' `--split-x` reads −92.86% at 10% of the pin, −55.71% at 20% and 0% from 35%, which matches `xPercent` before.
  Their CSS `rotate` (±5deg) is untouched. After `/` → "Blog" → back → "Blog", the trigger list is 0 and no
  `[data-anim]` element has `transform`, `translate`, `rotate`, `scale`, `--drift-y` or `--split-x` inline. After
  resizing to 700 and turning reduced motion on, the card's inline style is just `--rotate`. No console errors.
- R2.2: `/#experience` lands at 80px at 1440 × 900 and at 375 × 800. `/#work` and `/#chess` still land at 80px.
