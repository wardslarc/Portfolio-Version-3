# Claude handoff: homepage redesign "Code by day, ink by night" (updated 2026-11-28, after R3)

Paste this into a new chat to continue: **"Read `docs/redesign/HANDOFF.md`, then continue."**

## Where things stand

- **Done:** B1 (T01–T09) and review gate **R1 passed** (`docs/redesign/REVIEW-R1.md`). The three R1 fixes are
  R1.1 `dae453b`, R1.2 `d6b980a` and R1.3 `34d22cf`. Everything through `5a38a33` is pushed to
  `origin/redesign/ink-by-night`.
- **B2 done and R2 passed** (`docs/redesign/REVIEW-R2.md`): T10 `5638623`, T11 `7f39462`, T12 `46b518b`, T13
  `a6c2817`, fixes R2.1 `2191d25` and R2.2 `a5f95ab`. Everything is pushed to `origin/redesign/ink-by-night`.
- **B3 done and R3 passed** (`docs/redesign/REVIEW-R3.md`, no fixes): T14 `b702e27`, T15 `df22609`. Pushed.
- **T16 done** (`docs/redesign/REVIEW-T16.md`): everything checkable in headless Chrome passed (Lighthouse mobile
  87/100, CLS 0). **Left for Carls:** real browsers and devices (checklist in REVIEW-T16), deleting the 3 "R3 review
  test" messages, then merging to `main`.
- **Next (Carls asked 2026-11-28):** bring `/blog` (index and post) and `/admin/login` into the landing page's design.
  Carls approved the plan with Claude's recommendations: keep the blog's light/dark toggle in the new palette
  (light = paper + graph grid, dark = ink #16161A with coral), the homepage header everywhere, and restyle only
  `/admin/login` (and invite, which shares its layout), not the admin panel. Mockups (design canvas):
  https://claude.ai/artifact/9cESW7sS12T127KmdZXvTS (slug `45b46c79-ca8f-4d5f-a4d1-ed3b04ce6ba1`). After Carls
  approves them, write `docs/redesign-blog/` (spec and tasks) for Gemini.
- **2026-11-28: spec written.** That phase continues in `docs/redesign-blog/HANDOFF.md`.
- **Who codes:** Gemini (Antigravity) implements **every** task, T01–T15. Claude writes **no feature code**: it runs
  review gates R1–R3 and the final review T16, and owns `docs/redesign/` (it may fix a spec gap there, as in R1).
  Carls decided this on 2026-11-27 to save Claude usage.
- **Pushing:** only after a gate passes. A push sends Gemini's unreviewed commits too. Carls approved pushing this
  branch after gates.
- **Committing docs while Gemini works:** commit with a pathspec (`git commit -m … -- docs/redesign/<files>`). New
  files need `git add <file>` first. This keeps Gemini's staged or unstaged files out of Claude's commits.

## Files

| What | Where |
|---|---|
| Brief and original prototype (inputs) | `REDESIGN_PROMPT.md`, `portfolio-v3-prototype.dc.html.txt` (repo root) |
| Decisions (D1–D26) | `docs/redesign/DECISIONS.md` |
| Architecture (file map, tree, motion lifecycle, layouts) | `docs/redesign/ARCHITECTURE.md` |
| Every number (colors, type, spacing, motion, media queries) | `docs/redesign/DESIGN_TOKENS.md` |
| 17 tasks, gates, acceptance criteria | `docs/redesign/TASKS.md` |
| Working prototype (GSAP + ScrollTrigger + Lenis, vanilla JS) | `docs/redesign/prototype/index.html` |
| Headless browser screenshots for reviews | `docs/redesign/tools/cdp-check.mjs` (usage in its header comment) |
| Review results | `docs/redesign/REVIEW-R1.md` (passed); `REVIEW-R2.md` (passed); `REVIEW-R3.md` (passed); `REVIEW-T16.md` (final review) |

**Prototype artifact:** https://claude.ai/artifact/1Qgd9KA9C2drKuwu3bed7i (slug `034e867d-5e5d-4321-a6e0-3589f881e1bd`,
live version `1795785022-6a09`). To change it, edit `docs/redesign/prototype/index.html`, then `publish_files` with that
slug and `base_version`, listing only `index.html` (`portrait.jpg` is already uploaded and kept). It has a "Prototype
panel" (bottom left) that forces Full, Mobile or Reduced motion.

## Decisions Carls made (don't re-ask)

- **D1:** on `/` only, the section themes (paper/sand/dark) replace the light/dark toggle, with no dark flash. The
  toggle and stored preference keep working on `/blog`, `/admin` and 404s. (Verified in R1.)
- **D22:** a "Latest from the blog" row (T07b) after the experience strip: 3 newest posts, plain reveal.
- **The five prototype-found spec fixes are approved:** `scroll-behavior: auto` on `/`; `context.add(null, fn)`;
  portrait toggle mask `1000px` from the centre; `lenis@^1.3.27`; static track cards capped at 500px.
- **D23:** no class-name collisions.
- **D24:** the hero pins at **1024 × 560** and up, sized against the stage height, and pulls up under the 74px header.
- **D25:** reduced motion is a **calm tier**. It keeps the color tween, the word fade, opacity-only reveals and the
  onigiri draw, and drops Lenis, pins, the track, parallax, the hero shrink, the fan animation, clip-path growth and
  heading slides.
- **D26:** reduced motion keeps the **desktop layout** at 760px and wider. Stacking happens only below 760px.
- **Compact chess card** (D12): board ≤ 320px, with a 220px move list beside it.
- **Card notes never cover card text** (DESIGN_TOKENS §4.4). R1 added `top: 56px` for the RMK and Bilyo notes below
  760px **and** at 760–1023px with reduced motion (through `--note-top` / `--note-top-narrow`).
- **Header name is "carls.dale.escalo"** (one line, 320–1920px).
- Caveats already told to Carls: the hero intro and hover transitions are off under reduced motion (`globals.css`
  kills CSS animation, out of scope, D25). Dropping Skills and About follows the brief (D14).

## Open items for Carls (from R1; no Gemini action)

- **`/blog` downloads the three homepage fonts** (and the portrait preload). The cause is Next prefetching `/` from the
  blog header's home link; React applies that route's preloads. Claude recommended **accepting it** (the alternative,
  `preload: false`, risks hero font swap and CLS). Carls hasn't answered; if he wants it changed, it's a T15 item.
- **Not yet verified:** a real contact form submit and the honeypot submit (they'd write to or rate-limit the live
  DB, so ask Carls first), and Lighthouse/CLS/LCP. Both go to T16 (and the form to R3).

## How Claude reviews (R2, R3, T16)

1. `git log` and `git diff <last gate>..HEAD` (R2 starts from `5a38a33`). Read every changed file against its task's
   **How**, **Steps**, **Acceptance** and **Do not** lists, and against ARCHITECTURE §4 and §7 for motion.
2. Run `npm run lint`, `npm test` and `npm run build` (`/` must stay `○` or `◐`).
3. Browser: build, then `npx next start -p 3100` as a background task (Gemini's dev server holds port 3000), and
   headless Chrome as a background task (command in `tools/cdp-check.mjs`). Use `cdp-check.mjs` for screenshots. For
   measurements, write a small CDP script in the scratchpad that loads a URL at a size and motion setting, then
   evaluates a JS file. That's how R1 checked theme frames, layout numbers, note overlaps, and real Enter/Space/Escape
   key events (`Input.dispatchKeyEvent`). Stop both background tasks with TaskStop when done.
4. Gate focus:
   - **R2:** T10 Activity cleanup: `/` → `/blog` → back gives no `lenis` class on `<html>`, no leaked ScrollTriggers
     (`ScrollTrigger.getAll().length` back to its value, no pin-spacers left) and no leftover inline styles on hidden
     nodes. Check `data-motion` on/off, the theme tween and sync after a mid-page reload. T12: pin distances (hero
     1000px, split 1400px, track = `scrollWidth − innerWidth`, `--hz-extra` set and removed). T13:
     `git diff 5a38a33..HEAD -- src/components/ChessSection.tsx` is exactly one added `data-lenis-prevent`. Re-run
     the R1 note-overlap check (TASKS T07) to confirm nothing regressed.
   - **R3:** T14 as a security review (honeypot hidden and unfocusable, same payload, `/api/contact` untouched), then T16.
5. Write `docs/redesign/REVIEW-R<n>.md`: "passed", or a numbered fix list with file:line references and a concrete check
   for each fix. Gemini commits `fix(home): R<n>.<k> …`; Claude re-checks only those items, then marks the file passed,
   updates this handoff, and pushes. Give Carls the next Gemini prompt each time.

## Gotchas

- **Counting ScrollTriggers without changing code:** `ScrollTrigger` isn't on `window`. R2 found its internal trigger
  array through CDP: `DOMDebugger.getEventListeners` on `window` (evaluate it with an `objectGroup`, and call
  `Debugger.enable` first), then `Runtime.getProperties` on each handler's `[[Scopes]]`, and pick the array whose items
  have `trigger`, `progress`, `refresh` and `kill`. Store it as `window.__STL`. The script is
  `docs/redesign/tools/probe.mjs` (`node probe.mjs <url> <W>x<H> <full|reduce> <evalFile.js> --st`).
- **GSAP and CSS `rotate`/`translate`/`scale`:** a GSAP transform tween on an element with one of these folds it into an
  inline `transform` and sets the property to `none` inline, and `revert()` keeps that. Use a custom property (R2.1).

- **The Bash safety check refuses long inline scripts.** Write the script to a file (scratchpad), then run it in one line.
- Start servers and headless Chrome as **background tasks**, and stop them with **TaskStop** (`pkill` exits 144).
- Headless shell: `~/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell`,
  CDP on port 9333. No Playwright npm package.
- Headless Chrome reports **`(hover: none)`**, so the hero shows the "tap me" caption. That's not a bug.
- Local console noise to ignore: `/_vercel/*insights` 404s and `/api/chess` returning **503** (existing local behavior).
- `npm test` flaked once (1 failure, then 4 clean runs). Re-run before reporting a test failure.
- **`cacheComponents` keeps visited routes in the DOM** (hidden by React Activity). Every effect on `/` must clean up
  on hide. This is the most likely source of R2 findings.
- Lenis 1.3.x's CSS no longer sets `scroll-behavior: auto`; the `html:root[data-home]` block in `globals.css` does.
- The prototype switches layouts with `data-mode` attributes; the real build uses the media queries in DESIGN_TOKENS
  §6. Don't flag that difference.
- The old `Contact` form sits temporarily in the dark panel and is hard to read until T14. Expected.

## Gemini prompts

**B2 (already given to Carls):**

```
You're implementing the homepage redesign on branch `redesign/ink-by-night`. Read `AGENTS.md`, then
`docs/redesign/DECISIONS.md`, `docs/redesign/ARCHITECTURE.md`, `docs/redesign/DESIGN_TOKENS.md` and
`docs/redesign/TASKS.md`. The visual and motion reference is `docs/redesign/prototype/index.html` (the note at the top
of TASKS.md says how to serve it). It's a reference, not code to copy. Review gate R1 passed
(`docs/redesign/REVIEW-R1.md`); keep its fixes intact.

Do the tasks of step B2 in the "Handoff batches" table, in order: T10, T11, T12, T13. Stop at the end of B2 so Claude
can review. T10, T12 and T13 are marked ⚑:
- T10: every effect must clean up when the homepage is hidden (Next keeps visited routes in the DOM under React
  Activity). After `/` → `/blog` → back, there must be no `lenis` class on <html>, no leaked ScrollTriggers and no
  leftover inline styles. Follow ARCHITECTURE §4 exactly.
- T12: pin distances come from the spec, not from guesses.
- T13: `git diff src/components/ChessSection.tsx` must be exactly one added attribute (`data-lenis-prevent`).

Follow the ground rules in TASKS.md: one commit per task (`feat(home): T1x …`), with `npm run lint`, `npm test` and
`npm run build` passing before each commit. Don't push, merge or switch branches, and don't edit anything under
`docs/`. Take every number from DESIGN_TOKENS.md, and don't invent values or copy. If something in the spec is unclear
or looks wrong, stop and describe it instead of guessing. When you stop, list the commits you made and anything you
couldn't verify in a browser.
```

**B3 (after R2 passes):** use the same prompt with "step B3", tasks T14, T15, "Review gate R2 passed
(`REVIEW-R2.md`)", and the ⚑ note for T14: the contact form is security-sensitive, so keep the honeypot hidden and
unfocusable, send the same payload, and leave `src/app/api/**` untouched.

**Fix rounds:** "Read `docs/redesign/REVIEW-R<n>.md` and do the open fixes, one commit each (`fix(home): R<n>.<k> …`),
with lint, test and build passing. Change only what each fix names, don't start the next batch, don't push or edit
`docs/`. Report each commit and how you checked it."
