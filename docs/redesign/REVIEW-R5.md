# Review gate R5: T17 fluid scaling and uncapped stage height (D27), 2026-11-28

**Result: passed**, with one fix that Claude made itself (R5.1).

Commits: spec `fce0304`, spec fixes `80989c6` (Gemini's four questions: hero/contact radii in JS, inline px in
`home.ts`, vw clamps kept as the mobile base, 11px floor), T17 `5968022` (Gemini), R5.1 `5d5057b` (Claude).

## Measured (headless Chrome, `next dev`, full motion)

| Screen | --u | h1 | Stage | Hero pin | Split pin | Track pin | Bottom row at scroll 0 |
|---|---|---|---|---|---|---|---|
| 1024×560 | 11.38 | 86.0 | 560 | 560 | 840 | 1289 | hero card |
| 1280×720 | 14.22 | 107.5 | 720 | 720 | 1080 | 1611 | hero card |
| 1440×900 | 16 | 121.0 | 900 | 900 | 1350 | 1813 | hero card |
| 1903×945 | 21.14 | 159.9 | 945 | 945 | 1418 | 2396 | hero card (was band) |
| 1920×1080 | 21.33 | 161.3 | 1080 | 1080 | 1620 | 2417 | hero card (was band) |
| 2560×1440 | 28.44 | 215.0 | 1440 | 1440 | 2160 | 3223 | hero card (was band) |
| 2560×1080 | 24.55 (height guard) | 185.6 | 1080 | 1080 | 1620 | 2472 | hero card |

- Track pin equals `track.scrollWidth − innerWidth` everywhere; resizing 1440×900 → 1920×1080 mid-track re-measures it (2417 = 2417).
- Mobile 390×844: screenshots at 0 and 1500px are **byte-identical** to before T17.
- `/blog` at 1440 and 1920: `--u` 16px, header 74.09px, as before.
- 1024×768 text: nothing under 12px except the 11px placeholder labels (allowed) and the chess coordinates (10.5px, ChessSection, untouched).
- No horizontal overflow and no page exceptions at any size.

## R5.1 (fixed by Claude, `5d5057b`)

`--header-h: calc(4.625 * var(--u))` ignored the header's `max(44px, …)` tap-target floor, so below 1440 the real header
was taller than the pull-up (12px at 1024×560, 4px at 1280×720) and the hero card started below the viewport top. Now
`--header-h` is the sum of the header's parts with the same floors. Residual: ≤ 2px at 2560 wide (pill line-height
rounding), hidden under the sticky header.

Comparison page (before/after, 5 sizes + 2560×1080): https://claude.ai/artifact/VNt1bHeTb4R6fEHVPocNrR
