# Review R2 (R1 fixes, A03, A04, A05) — not passed yet, 5 fixes

Reviewed by Claude on 2026-11-28, commits `d1226cd`, `4b897c5`, `5c04515`, `3dfaf96`. Same set-up as R1 (Carls's
session in the review Chrome). Read-only: no save, publish, delete or upload was clicked.

## Checks that passed

| Check | Result |
|---|---|
| lint, test (155), build | pass; `/` ○, `/blog` ◐ |
| "Must stay empty" diff | empty |
| Inline styles left with color/background/border/radius/font/shadow/overflow | none (grep) |
| TSX diffs | classes only; no logic, data, field or copy changes |
| 1440 light/dark: Overview, Messages, Media, Chess, Admins, Engagement, post stats, editor (draft and published post) | match the mockup apart from the items below; no horizontal scroll |
| Overview stat cards | five, tilt cycle and tape as specced; bar tracks now visible |
| R1.2–R1.4 | fixed |

## Fixes (one commit `fix(admin): R2 fixes`)

**R2.1 Phone and tablet layouts are broken: media rules lose to the scoped base rules.** Every rule inside an
`@media` block in `admin.css` that is **not** prefixed `.ink` is now beaten by the `.ink …` base rule for the same
element (specificity 0,2,x vs 0,1,x). Visible results at 375px:
- `/admin/blog`: posts rows keep the desktop grid, so titles wrap one word per line and the status badge overlaps
  the title.
- `/admin/blog/[id]`: the editor keeps two columns (`.admin-egrid`), so the title, toolbar and text get a ~20px sliver
  and the side panel covers them.
- At risk too: the chess move log `compact` rows, `.admin-split` Write/Preview switching, `.admin-titlein`,
  `.admin-ebar .hide-s`, `.admin-eside`.

Fix: prefix **every** selector inside the `@media (max-width: …)` blocks with `.ink ` (for example
`.ink .admin-prow`, `.ink .admin-table.stack-mobile.compact td[data-label="Ply"]`). Affected today (from a script):
`.admin-table.stack-mobile.compact …` (760px block), `.admin-prow`, `.admin-prow.readonly`, `.admin-prow .thumb`,
`.admin-prow .c-date/.c-views/.c-likes/.c-shares`, `.admin-prow.th` (900px), `.admin-egrid`, `.admin-eside` (1100px),
`.admin-split`, `.admin-split .admin-pv`, `.admin-split.p .admin-pv`, `.admin-split.p .admin-src`,
`.admin-mdbar .sp-only`, `.admin-src` (900px), `.admin-titlein`, `.admin-eside`, `.admin-ebar .hide-s` (760px). Also
switch any remaining `max-width: 760px` query to `759.98px` (SPEC §6.2 breakpoint) and keep the 900/1100px ones.
*Check:* at 375px `/admin/blog` rows show thumb · title · badge · menu without overlap; the editor is one column with
the side panel below; the chess move log uses the compact rows; at 1024px the editor side panel drops below
(1100px rule); no page-level horizontal scroll on any panel page at 375.

**R2.2 Gap before every heading dot.** R1.1 made the `h1` a flex row with `column-gap: 12px`; the gap also lands
between the text and the `::after` dot ("Blog ."). Set `column-gap: 0` and give `.ink .admin-page-head h1 >
.admin-badge` `margin-left: 12px` instead.
*Check:* "Overview." with the dot touching the word; on `/admin/chess` "Chess · Game 1." then the badge.

**R2.3 Filters don't wrap at 375px.** `.ink .admin-seg` (and the `.admin-blog-toolbar` row holding it) must have
`flex-wrap: wrap`; below 760px the search input takes the full row (`flex: 1 1 100%`) with the filters under it.
Same for the media library search + filter row.
*Check:* `/admin/blog` and `/admin/media` at 375: `document.documentElement.scrollWidth === 375`.

**R2.4 Engagement daily chart is too busy (spec correction).** The three stacked tracks per day all got a 1.5px
border, so 30 days draw ~90 outlined capsules. SPEC §7.6 is now changed: tracks inside `.admin-eng-tracks` (the
stacked views/likes/shares rows) have **no border**, height 6px, `--k-chip` fill, radius 999px, 3px gap between the
three. Single bars keep the outlined 12px track: Overview moves per day, share channels, media storage.
*Check:* `/admin/blog/engagement` daily rows read as three thin bars per day; channels keep the outlined track.

**R2.5 Editor source box has a double frame.** In Split/Write the `.admin-src textarea` draws its own 1.5px border and
radius inside the framed pane. Inside `.admin-split`, make the textarea borderless (`border: 0; border-radius: 0;
background: transparent`) and keep the 3px coral focus ring (`outline-offset: -3px` so it stays inside the pane).
*Check:* one frame around the writing area; focus ring visible when typing.

## Re-check

After these fixes Claude re-checks only R2.1–R2.5 (375, 1024 and 1440 on Blog, editor, Chess, Media, Engagement);
if they pass, R2 passes and B3 (A06) starts.
