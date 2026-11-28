# Review gate R6: T18 gentler height-aware scaling, smaller hero, one container (D28), 2026-11-28

**Result: passed**, with one fix that Claude made itself (R6.1).

Commits: spec `27876a7`, T18 `2e1ce41` (Gemini), R6.1 `642f848` (Claude).

## Measured (headless Chrome, `next dev`, full motion, scroll 0)

| Screen | --u | h1 | Portrait | Note gap under header | CTA gap above bottom | Left edges (logo = h1 = sections) |
|---|---|---|---|---|---|---|
| 1366×657 | 13.84 | 90.0 | 285 | 12.0% | 12.5% | 139 |
| 1440×900 | 16 | 104.0 | 330 | 16.9% | 17.2% | 93 |
| 1903×945 | 16.40 | 106.6 | 338 | 17.7% (was 1.2%) | 18.0% (was 3.6%) | 309 |
| 1920×1080 | 17.60 | 114.4 | 363 | 19.6% | 20.0% | 270/271 |
| 2560×1440 | 20.80 | 135.2 | 429 | 23.2% | 23.5% | 466/467 |
| 1280×720 | 14.40 | 93.6 | — | 14.0% | 14.4% | 75 |
| 1024×560 | 12.98 | 84.4 | 268 | 7.7% | 8.2% | 19 |

- Left edges checked: header logo, h1, "On the clock." (track at progress 0), "Hall of sketches.", the More work list,
  "Let's build something.". Also equal at 1024×768, 820×1180 and 760×1024.
- No horizontal overflow at any size; hero pin = 1 screen, split pin = 1.5 screens (1903×945, 2560×1440).
- `/blog` header at 1440 and 1920: logo 117 / 357px, height 74.09px, as before T18.
- 760–~850px wide (not pinned): the hero now stacks the portrait under the text (u is 13.69 there, was 11.38), which
  is the normal tablet stack.
- `npm run lint`, `npm test` pass after R6.1 (Gemini ran build on T18).

## R6.1 (fixed by Claude, `642f848`)

The portrait column kept its `flex: 1 1 18.75u` basis, so the portrait was 300px at 1440, not 330. Added
`flex-basis: calc(20.625 * var(--u))` in the ≥ 760px block.

Comparison page (before/after hero at 5 sizes, sections at 1903×945 and 1366×657):
https://claude.ai/artifact/EehhhYsdE6aUpUcLnvMT4i
