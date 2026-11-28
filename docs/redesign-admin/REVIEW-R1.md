# Review R1 (A01, A02) — passed with 4 small fixes

Reviewed by Claude on 2026-11-28, commits `d2183ef`, `6902fef`. Carls signed in with a backup code in a visible CDP
Chrome (`.env.local` has no Resend key, so emailed codes don't send on localhost; that predates this work).

## Checks

| Check | Result |
|---|---|
| `npm run lint`, `npm test` (155), `npm run build` | pass; `/` ○, `/blog` ◐ |
| "Must stay empty" diff (SPEC §4.2 paths) | empty |
| Duplicate selectors in `admin.css` (same selector in the same media context) | none |
| Blue left (`#2f5bd3`, `#8aa8ff`), 2px outlines | none |
| Computed tokens on `.admin-shell`: `cde-theme` light, dark, unset + OS light, unset + OS dark, light + OS dark | all match SPEC §5; body background and sidebar follow |
| `theme-color` on panel pages | one tag, `#16161A` |
| ThemeToggle in sidebar | switches `data-theme`, writes `cde-theme`, label flips |
| Keyboard focus (Tab through sidebar → page) | 3px coral ring on every stop, visible on ink and on paper |
| 375px (chess, messages dark) | no page scroll; ink top bar; tabs scroll; active tab in view; all sidebar targets 44px tall except the "Admin" brand link (22px, as before) |
| Invite dialog (opened and closed, nothing submitted) | ink style, coral shadow, blurred backdrop |
| Sign-in screens | use no `admin-*` classes, so they're untouched by the new rules |
| Screens: Overview, Blog, Admins, Chess, Messages, Media, Engagement (1440 light/dark) | match the mockup apart from the items below and A03–A05 work |

## Fixes (Gemini: do these first in B2, one commit `fix(admin): R1 fixes`)

**R1.1 Chess heading dot lands after the badge.** `chess/ChessAdminClient.tsx` puts the "Active" badge inside the
`h1`, so the serif `.` from `.admin-page-head h1::after` renders after the badge ("Game 1 Active."). In `admin.css`
make the heading a wrapping flex row (`display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 12px`) and
give `.ink .admin-page-head h1 > .admin-badge` `order: 1` plus `align-self: center`, so the dot follows the text and the
badge comes after it. Don't change the markup.
*Check:* `/admin/chess` heading reads "Chess · Game 1." with the badge to the right of the dot.

**R1.2 Card inside a card.** On `/admin/admins` the Team `.admin-table-wrap` sits inside an `.admin-card` and gets a
second border and shadow. Add `.ink .admin-card .admin-table-wrap { box-shadow: none; border-radius: 12px; }` (keep the
1.5px border). Grep for other `.admin-table-wrap` inside `.admin-card` (chess move log, sessions) and check they look
right with it.
*Check:* one shadow per card on Admins and Chess.

**R1.3 Dialog titles.** `dialog.admin-dialog h2` still uses Geist. Give it the card heading style (Bricolage 800 20px,
-.02em, margin 0), defined once (extend the `.ink .admin-card h2` selector list rather than adding a new rule).
*Check:* "Invite admin" dialog title matches card headings.

**R1.4 Grey scrollbar on the ink tab strip (375px).** Add `scrollbar-color: #F3F1EC33 transparent; scrollbar-width:
thin;` to `.ink .admin-nav` in the mobile block.
*Check:* the strip under the tabs is a faint paper line, not grey.

## Notes for A03 (spec updated)

- `/admin` has **five** stat cards, not four. SPEC §7.3 and §10 now say: tilt cycles `-.8, .6, -.4, .8deg` over the
  cards (`:nth-child(4n+1)` … `:nth-child(4n+4)`), drop-in delays `.1s + .08s × index`.
- The mobile `.admin-stats-grid { grid-template-columns: 1fr }` rule is unscoped, so `.ink .admin-stats-grid`
  (auto-fit) beats it. It doesn't show today (auto-fit gives one column at 375), but scope it when A03 rewrites the
  stat grid. Also widen the stat grid gap to 24px (the tilt and 8px shadows need the room).
- The Overview "Moves per day" tracks are invisible (inline `var(--surface)` on a surface card): expected, that's A03 §8.
