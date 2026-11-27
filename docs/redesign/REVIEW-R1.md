# Review R1: batch B1 (T01–T09)

Reviewed by Claude on 2026-11-27, against `a3d1a25..ba69489` (T01 `bc38cc9` through T09 `ba69489`).

**Result: passed (2026-11-27).** R1.1 (`dae453b`), R1.2 (`d6b980a`) and R1.3 (`34d22cf`) are fixed and re-checked. B2 can start. T02 passed: the theme scope works on all four routes
(hard loads and client navigation). Everything else in B1 meets its acceptance criteria, apart from the items below.

## Fix list for Gemini

Commit each one as `fix(home): R1.<n> …`, with `npm run lint`, `npm test` and `npm run build` passing. Don't push.

### R1.1 Card notes cover card text below 760px (T07)

At 320 and 375 wide, "my own product ✎" (Bilyo) covers the card's kicker/status row and title, and at 320
"built from scratch!" (RMK) covers the RMK kicker row. The percentage `top` values only work on the wide cards.
The spec now has a narrow value: DESIGN_TOKENS §4.4, "Below 760px".

- `src/content/home.ts`: add `narrowTop: "56px"` to the RMK and Bilyo `note` objects (optional field on the type).
  Leave the ticketing note alone.
- `src/components/home/work/WorkTrack.tsx:64-70`: an inline `top` can't be overridden by a media query. Instead, set
  the custom properties `--note-top: card.note.top` and, when present, `--note-top-narrow: card.note.narrowTop`
  (keep `left`, `right`, `rotate` and `fontSize` inline as they are).
- `src/components/home/work/WorkTrack.module.css` `.cardNote`: `top: var(--note-top);` and, inside
  `@media (max-width: 759.98px)`, `top: var(--note-top-narrow, var(--note-top));`.
- Check: at 320, 375, 500 and 759 (both motion settings), no `.cardNote` rect intersects any card's `h3`, `p`,
  kicker/status row or tape. At 1024, 1440 and 1920, nothing changes (it passes now; keep it that way).

### R1.2 The split heading reads its handwritten notes (T08)

`src/components/home/SplitScene.tsx:32-34` and `:41-43`: the two Caveat notes are inside the `<h2>`, so a screen
reader hears "On the CLOCK ↑ that was the day job Off the CLOCK ↓ here's the night shift". T08 requires the heading to
read as "On the CLOCK Off the CLOCK", and ARCHITECTURE §13 makes handwritten notes decorative.

- Add `aria-hidden="true"` to both `.splitNote` spans. Don't change the layout.
- Check: `document.querySelector('[data-anim=split-stage] h2')` has no accessible text beyond "On the CLOCK Off the CLOCK"
  (the DevTools Accessibility pane shows that name for the heading).

## Re-check (2026-11-27): R1.1 and R1.2 passed, one new fix R1.3

- `dae453b` (R1.1) and `d6b980a` (R1.2) match the fix list exactly. Lint and build pass. `npm test` failed once
  (1 test) and then passed 4 runs in a row, so it's a timing flake, not these changes.
- R1.1: no note hits at 320, 375, 500, 759, 1024, 1440 and 1920 in both motion settings. Narrow notes compute to
  `top: 56px`; wide ones keep their percentages. R1.2: the split heading's text is "On the CLOCK Off the CLOCK".
- **New, found by an extra width (my spec gap, not a regression):** at **760px with reduced motion**, the 2-column grid
  makes cards about 330px wide, and both notes cover text (Bilyo up to about 850px). This was there before R1.1.

### R1.3 Narrow note offset in the 760–1023px reduced-motion grid (T07)

DESIGN_TOKENS §4.4 now has a "Narrow reduced-motion grid" bullet.

- `src/components/home/work/WorkTrack.module.css`: add a second block with the same rule as the narrow one,
  `@media (min-width: 760px) and (max-width: 1023.98px) and (prefers-reduced-motion: reduce) { .cardNote { top: var(--note-top-narrow, var(--note-top)); } }`.
  Change nothing else.
- Check: with reduced motion at 760, 800, 900, 1000 and 1023, no note hits card text. With reduced motion at 1024 and
  1440, the notes still use their percentage tops. With full motion at 760–1023, nothing changes (the track cards
  there are 500px and pass now).

## What was checked

- `npm run lint`, `npm test` (25 files, 137 tests) and `npm run build` pass. `/` is still prerendered
  (`.next/server/app/index.html` exists). `git diff` touches no file on the global "Do not" list except T02's one
  `globals.css` block, which matches DESIGN_TOKENS §1.5 exactly.
- **T02** (headless Chrome against `next start`):
  - Hard loads with `cde-theme=dark` stored: `/` has `data-home`, no `data-theme`, a paper canvas, a paper header,
    `scroll-behavior: auto` and a single `#F3F1EC` theme-color. `/blog`, `/admin/login` and a 404 are dark, keep the
    two media-scoped theme-color tags and stay `smooth`. With nothing stored, `/` is paper and `/blog` is light.
  - Client navigation, sampled every animation frame: `/blog` → brand link → `/` → "Blog" → back → forward. No frame
    on `/` ever has `data-theme`, and no frame on `/blog` keeps `data-home`. `Header.tsx` is unchanged.
  - `theme.test.ts` covers the four required cases plus `applyStoredTheme`.
- **T04–T09 layout** at 320, 375, 759, 760, 1000×800, 1024×560, 1280×540, 1280×600, 1440×900 and 1920×1080, in full
  and reduced motion where the criteria ask:
  - The header fits on one row at every width (logo 30px tall, so one line). Below 760px only the 44×44 menu button
    shows. Enter and Space open the menu, Escape closes it and keeps focus on the button, and a link click closes it.
  - The hero pins at 1024×560, 1280×600 and 1440×900, and every part of the card sits above the fold (CTA bottom
    539/560, 578/600 and 782/900). The h1 is 120.96px at 1440×900. It stays static at 1000×800, 1280×540 and 375.
    Under reduced motion it's static, with the marquee stopped and the underline and onigiri drawn.
  - The portrait mask follows the mouse, resets on leave, and Enter and Space toggle `aria-pressed` and the full reveal.
  - The track section is 2713px at 1440 (= 900 + 3253 − 1440). The reduced-motion grid has 2 columns at 1024, 1440
    and 1920, with cards 2 and 4 40px lower. There are no note overlaps at 1024, 1440 and 1920 in either layout.
  - "Show 5 more projects ↓" toggles with `aria-expanded` and changes between 3 and 8 rows. Bilyo, Relato, hardrock,
    citimax and sticky-white-board open in new tabs.
  - The split cards are never under 100px wide. The reduced-motion split puts the cards beside the heading with a
    full-bleed ink block.
  - The gallery has 3 columns at 0/120/40px, with no stagger below 760px.
  - The fan spreads ±280px (±140px below 760px).
  - The contact panel overlaps the section above it by 60px with 40px corners, and the footer reads "© 2026 …".
  - There's no horizontal overflow at any width, and there's exactly one `<h1>`.
- No CSP violations or page errors appear. The only console noise is local-only: `/_vercel/*insights` 404s and
  `/api/chess` returning 503.

## Notes for Carls (no Gemini action)

1. **`/blog` downloads the three homepage fonts** (T04 acceptance says it shouldn't). This isn't a bug in Gemini's
   code: Next prefetches `/` from the blog header's home link about 45ms after load, and React applies that route's
   font preloads to the current page. The fonts are preloaded but never used on `/blog`, and the portrait image
   preload comes along too. The fix would be `preload: false` on the three fonts, which makes `/` show fallback fonts
   for longer and risks layout shift in the hero. Recommendation: accept it. The extra transfer is small and happens
   after the blog page has rendered.
2. **Not verified in R1:** sending the contact form and the honeypot submit (T09). Both would write to or rate-limit
   the live database, `Contact.tsx` is unchanged, and T14 replaces the form. The Lighthouse/CLS/LCP numbers (T05,
   T06) move to T16. The "hover me" caption swap was checked from the CSS only, because headless Chrome reports
   `(hover: none)`.
3. The temporary old contact form is hard to read on the ink panel (its email field text is near-invisible). That's
   expected until T14 restyles it.
