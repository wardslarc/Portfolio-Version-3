# Claude handoff: homepage redesign "Code by day, ink by night" (2026-11-27)

Paste this into a new chat to continue: **"Read `docs/redesign/HANDOFF.md`, then continue."**

## Where things stand

- **Phase:** planning is finished. Gemini is working on step **B1** (TASKS.md "Handoff batches"); it had started T01
  (gsap and lenis added to `package.json`) on 2026-11-27. Next for Claude is review gate **R1** once B1's commits land.
- **Branch:** `redesign/ink-by-night`, tracking `origin/redesign/ink-by-night`. All of `docs/redesign/` is committed and
  pushed (`1d2fa49`, `9667366`).
- **Who codes:** Gemini (Antigravity, "Gemini Hydrogen") implements **every** task, T01–T15. Claude writes **no feature
  code**; it runs review gates R1–R3 and the final review T16. Carls decided this on 2026-11-27 to save Claude usage.

## Files

| What | Where |
|---|---|
| Brief and original prototype (inputs) | `REDESIGN_PROMPT.md`, `portfolio-v3-prototype.dc.html.txt` (repo root) |
| Decisions (D1–D26) | `docs/redesign/DECISIONS.md` |
| Architecture (file map, tree, motion lifecycle, layouts) | `docs/redesign/ARCHITECTURE.md` |
| Every number (colors, type, spacing, motion, media queries) | `docs/redesign/DESIGN_TOKENS.md` |
| 17 tasks, gates, acceptance criteria, Gemini prompt | `docs/redesign/TASKS.md` |
| Working prototype (GSAP + ScrollTrigger + Lenis, vanilla JS) | `docs/redesign/prototype/index.html` |
| Headless browser check for reviews | `docs/redesign/tools/cdp-check.mjs` (usage in its header comment) |
| Review results Claude writes | `docs/redesign/REVIEW-R1.md` … `R3.md` (don't exist yet) |

**Prototype artifact:** https://claude.ai/artifact/1Qgd9KA9C2drKuwu3bed7i (slug `034e867d-5e5d-4321-a6e0-3589f881e1bd`,
live version `1795785022-6a09`). To change it, edit `docs/redesign/prototype/index.html`, then `publish_files` with that
slug and `base_version`, listing only `index.html` (`portrait.jpg`, from `public/carls-dale-escalo-portrait.jpg`,
is already uploaded and kept). The page has a "Prototype panel" (bottom left) that forces Full, Mobile or Reduced
motion and remembers the choice in localStorage (`inkProtoMode`).

## Decisions Carls made (don't re-ask)

- **D1:** on `/` only, the section themes (paper/sand/dark) replace the light/dark toggle, with no dark flash. The
  toggle and stored preference keep working on `/blog`, `/admin` and 404s.
- **D22:** add a "Latest from the blog" row (task T07b) after the experience strip: 3 newest posts, `getLatestPosts(3)`,
  with a plain reveal.
- **The five prototype-found spec fixes are approved:** smooth scroll set to `scroll-behavior: auto` on `/`;
  `context.add(null, fn)`; portrait toggle mask `1000px` from the centre; `lenis@^1.3.27`; static track cards capped at 500px.
- **D23:** no class-name collisions (from the `.sr` bug).
- **D24:** the hero pins at **1024 × 560** and up, with content sized against the stage height; the pinned hero pulls up
  under the 74px header.
- **D25:** reduced motion is a **calm tier**. It keeps the color tween, the word fade, opacity-only reveals and the
  onigiri draw, and drops Lenis, pins, the track, parallax, the hero shrink, the fan animation, clip-path growth and
  heading slides.
- **D26:** reduced motion keeps the **desktop layout** at 760px and wider (2-column cards, split cards beside the
  heading). Stacking happens only below 760px.
- **Compact chess card** (D12): board ≤ 320px, with a 220px move list beside it.
- **Card notes never cover card text** (DESIGN_TOKENS §4.4 rule). The Bilyo note is at `left: -24px; top: 45%`.
- **Header name is "carls.dale.escalo"** (one line, fits from 320 to 1920px).
- Caveats already told to Carls: the hero intro and hover transitions are off under reduced motion, because
  `globals.css` kills CSS animation there and that file is out of scope (D25). Dropping Skills and About from the
  homepage follows the brief (D14).

## How Claude reviews (R1–R3, T16)

1. `git log` and `git diff <last gate>..HEAD`. Read every changed file against its task's **How**, **Steps**,
   **Acceptance** and **Do not** lists.
2. Run `npm run lint`, `npm test` and `npm run build` (the build must still list `/` as prerendered).
3. Browser checks with `docs/redesign/tools/cdp-check.mjs` against `npm start`, at the widths and motion settings each
   acceptance criterion names (typically 375, 1024×560, 1280×600, 1440×900, 1900, in both `full` and `reduce`).
   Look at only the screenshots that matter.
4. Gate focus:
   - **R1:** T02 theme on all 4 routes, including client navigation both ways and the stored-dark hard load.
   - **R2:** T10 Activity cleanup (`/` → `/blog` → back: no `lenis` class, no leaked triggers or inline styles); T12 pin
     distances; T13 `git diff src/components/ChessSection.tsx` is exactly one attribute.
   - **R3:** T14 as a security review (honeypot hidden and unfocusable, same payload, API untouched).
5. Write `docs/redesign/REVIEW-R<n>.md`: "passed", or a numbered fix list with file and line references. Gemini fixes
   them; Claude re-checks only those items. Claude makes no feature edits itself; at most a one-line typo, if Carls OKs it.

## Gotchas from this session

- **The Bash safety check refuses long inline scripts** (heredocs with Python or JS inside one command), even ones that
  delete nothing. Write the script to a file with the Write tool (scratchpad for throwaway ones), then run
  `python3 <file>` or `node <file>` as a one-line command.
- Start servers and the headless browser as **background tasks**, and stop them with **TaskStop**. `pkill` from Bash
  exits with code 144 and looks like an error.
- The headless shell is at
  `~/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell`. There's no
  Playwright npm package; `cdp-check.mjs` talks CDP directly.
- **`cacheComponents` keeps visited routes in the DOM** (hidden by React Activity). Every effect on `/` must clean up
  on hide. This is the most likely source of review findings.
- Lenis 1.3.x's CSS no longer sets `scroll-behavior: auto`; the `html:root[data-home]` block in `globals.css` does.
- The prototype is a reference: it switches layouts with `data-mode` attributes, while the real build uses the CSS
  media queries in DESIGN_TOKENS §6. Don't flag that difference in reviews.

## Kickoff prompt for Gemini, step B1 (paste into Antigravity)

```
You're implementing the homepage redesign on branch `redesign/ink-by-night`. Read `AGENTS.md`, then
`docs/redesign/DECISIONS.md`, `docs/redesign/ARCHITECTURE.md`, `docs/redesign/DESIGN_TOKENS.md` and
`docs/redesign/TASKS.md`. The visual and motion reference is `docs/redesign/prototype/index.html` (the note at the top
of TASKS.md says how to serve it). It's a reference, not code to copy.

Do the tasks of step B1 in the "Handoff batches" table, in order: T01, T02, T03, T04, T05, T06, T07, T07b, T08, T09.
Stop at the end of B1 so Claude can review. T02 is marked ⚑: follow its **How** line and ARCHITECTURE §5.1 exactly.
If a `docs/redesign/REVIEW-R<n>.md` file lists open fixes, do those first.

Follow the ground rules in TASKS.md: one commit per task (`feat(home): T0x …`), with `npm run lint`, `npm test` and
`npm run build` passing before each commit. Don't push, merge or switch branches. Take every number from
DESIGN_TOKENS.md, and don't invent values or copy. If something in the spec is unclear or looks wrong, stop and
describe it instead of guessing. When you stop, list the commits you made and anything you couldn't verify in a browser.
```

For B2 and B3, use the same prompt with the step name and task list from the table: B2 = T10, T11, T12, T13;
B3 = T14, T15.
