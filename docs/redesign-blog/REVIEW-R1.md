# Review gate R1 (B1: K01–K03): **passed** (after 2 fixes)

Reviewed 2026-11-28 by Claude, from `9e5e4c4` (spec commit) to `71d5bd7`. Commits: K01 `ec4ab9a`, K02 `cc12d6e`,
K03 `71d5bd7`.

## Passed

- `npm run lint` clean; `npm test` 145/145; `npm run build` passes with `/` still `○`.
- Tokens: `.ink` gives the right `--home-bg`/`--home-fg` and body background with `cde-theme` unset, light and dark;
  `.ink-dark` and the OS-dark media block are in place. `/` keeps `--bg: #F3F1EC` from `data-home` and its single
  `#F3F1EC` theme-color tag.
- Header: the `home` variant renders the same links, hrefs and sizes as before (screenshot at 1024×560 matches T16).
  The `site` variant has `/#work`, `/#night`, `/blog` (`aria-current="page"`, coral underline), `/#contact`, logo → `/`,
  a 44×44 toggle in the bar and in the mobile menu. In dark every header border is `#F3F1EC`, and the CTA keeps a
  `#16161A` border.
- Toggle: switches and stores `cde-theme` both ways, labels update, sets `--vx`/`--vy` and uses the view transition
  in Chrome; with reduced motion it's instant (no `--vx`). `/blog` → `/` → back: `data-home`/`data-theme`/body
  background follow the route, with the stored dark theme restored on `/blog`.
- Homepage leak check (T16 sequence `/` → `/blog` → back → post → back): ScrollTriggers 62 → 0 → 62 → 0 → 62,
  `lenis` only on `/`, no pin-spacers, no inline styles on `<html>`/`<body>`.
- Footer and 404 match the spec layout; blog `viewport` theme colors are `#F3F1EC`/`#16161A`; no horizontal scroll at
  375px; no console errors.

## Fixes

### R1.1 Footer "something." has the wrong color in the light theme

`src/components/ink/InkFooter.tsx:11` puts `k-serif` and `styles.serif` on the same span. `.ink .k-serif`
(`src/styles/ink.css`, specificity 0-2-0) beats `.serif` (`InkFooter.module.css:31`, 0-1-0), so with a light theme the
word is `#B8361A` on the `#16161A` band (about 2.9:1) instead of SPEC §5.4's `#FF6A47`.
**Fix:** make the module rule win (for example `.heading .serif { color: #FF6A47; }`), or drop `k-serif` and set the
serif font in the module. Watch for the same trap anywhere a module class overrides a `k-*` class.
**Check:** on `/blog` with `cde-theme` unset, light and dark, the computed color of the footer's "something." is
`rgb(255, 106, 71)`.

### R1.2 The 404 page still has the old theme-color tags

`/nope` serves `#fafaf9` / `#111113`. SPEC §4.2 put the new colors only in the blog layout, but the 404 now has the
same paper/ink page.
**Fix:** export the same `viewport` (`themeColor` light `#F3F1EC`, dark `#16161A`, media-scoped) from
`src/app/not-found.tsx`. If the Next docs say `not-found` can't export `viewport`, stop and report instead.
**Check:** `curl -s localhost:3000/nope | grep theme-color` shows `#F3F1EC` and `#16161A`.

## Fixes re-checked (2026-11-28)

- R1.1 `c0733f6`: footer "something." computes `rgb(255, 106, 71)`, Instrument Serif italic, in light and dark.
- R1.2 `43e8fb1`: `/nope` serves `#F3F1EC` / `#16161A` theme-color tags.
- Lint clean, 145/145 tests, build passes with `/` still `○`.

## Note for K06 (no action now)

`.ink` sets `min-height: 100dvh; display: flex; flex-direction: column` (`ink.css:24-27`). That's right for whole pages,
but when K06 wraps the admin preview in `<InkScope>` the preview must not stretch to a full viewport inside the admin
panel. Handle it in K06 (for example an `InkScope` prop that leaves the page layout off).
