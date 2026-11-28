# Review gate R2 (B2: K04–K06): **passed** (after 3 fixes)

Reviewed 2026-11-28 by Claude, from `5965109` (R1 gate) to `f99b28d`. Commits: K04 `20e49d2`, K05 `232f788`,
K06 `f99b28d`. Gemini had no browser this round, so Claude did the whole visual pass (headless Chrome, production build).

## Passed

- `npm run lint` clean; `npm test` 145/145; `npm run build` passes with `/` still `○`.
- `/blog`, `/blog/tag/cybersecurity` and the PHP2Shell post at 1440 (light, dark) and 375 (dark) match the mockups:
  hero with masked lines, underline and note; tilted stickers; taped featured card with the chip and "Read it →"; pager;
  post header with tags as stickers and "← that's me"; taped cover; sticky TOC beside the text at 1440 and the dashed
  box above it at 375; "liked it?" row; bio card; footer.
- No `a a` anywhere; no horizontal scroll at any scroll position; fonts and colors per SPEC §6 in both themes.
- Prose (checked by injecting h2, h3, inline code, lists, blockquote, a highlighted code block with the copy button,
  a table, a figure and an `hr` into the live post): all styled per SPEC §5.3 in light and dark.
- K06: `globals.css` has no `.blog-*`/`.hljs` rules left; nothing outside the blog used the removed classes
  (`blog-tag-list` in the editor is styled by `admin.css`). `InkScope contained` handles the R1 note, and the
  `:has(.ink:not(.ink-contained))` change keeps the admin panel's own background.

## Fixes

### R2.1 The share row lost its "Share" label

`src/components/blog/ShareRow.tsx:59-60` removed `<span>Share</span>`. SPEC §3/§8: today's copy stays.
**Fix:** put the label back as the first item of `.blog-share`, styled like the meta text (Geist Mono 12px uppercase,
`--k-muted`), vertically centered with the pills.
**Check:** the post's end row reads "liked it? · Like · Share · Copy link · Post on X · LinkedIn" at 1440 and wraps
cleanly at 375.

### R2.2 "copied!" is read out as part of the button's name

`src/components/blog/ShareRow.tsx:67` renders `<span className="k-note blog-copied" aria-live="polite">copied!</span>`
inside the button, so the button's accessible name becomes "Link copied copied!" and the live region appears at the
same moment as its text (often not announced). The pop is decorative; the button text "Link copied" already says it.
**Fix:** `aria-hidden="true"` on that span and no `aria-live`.
**Check:** after clicking Copy link, the button's accessible name (DevTools → Accessibility) is "Link copied".

### R2.3 Code comments fail contrast on the code panel

`src/styles/ink-blog.css:788` keeps `#73737b` for `.hljs-comment`/`.hljs-quote`: 3.84:1 on `#16161A` (14px text
needs 4.5:1). It was already low in the old dark theme; the panel is now dark in both themes, so it shows everywhere.
**Fix:** use `#A0A0A8` (6.95:1 on `#16161A`, 7.37:1 on `#0F0F12`), still italic.
**Check:** computed color of a `.hljs-comment` inside `.blog-prose pre` is `rgb(160, 160, 168)` in light and dark.

## Fixes re-checked (2026-11-28)

- R2.1 `8170f8f`: the end row reads "liked it? · Like · SHARE · Copy link · Post on X · LinkedIn" at 1440 and wraps cleanly at 375 (dark).
- R2.2 `5db7566`: after Copy link, the pop has `aria-hidden="true"` and no `aria-live`; the button's name is "Link copied".
- R2.3 `472e78a`: `.hljs-comment` computes `rgb(160, 160, 168)`.
- Lint clean, 145/145 tests, build passes with `/` still `○`.
- Side effect: the re-check clicked Copy link on the live PHP2Shell post, which recorded one real share ("Shared 1 time").
- Not a regression: `LikeButton` renders nothing until engagement data loads (unchanged code), so a fast screenshot can miss it.

## Not checked (needs Carls)

The admin post preview (`/admin/blog/[id]/preview`) and the editor's live preview sit behind the admin sign-in, so
they were only code-reviewed. Carls: open one post's preview and the editor once, and check that the preview has the
new blog look and the rest of the admin panel looks as before. This can wait until R4.
