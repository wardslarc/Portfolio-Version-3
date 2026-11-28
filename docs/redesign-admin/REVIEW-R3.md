# Review R3 (A06, final) — passed; one pre-existing accessibility item left

Reviewed by Claude on 2026-11-28, commit `a6a3647`, with Carls's session in the review Chrome (read-only).

## Checks

| Check | Result |
|---|---|
| lint, test (155), build | pass; `/` ○, `/blog` ◐ |
| "Must stay empty" diff (SPEC §4.2) | empty for the whole branch (`main..HEAD`) |
| Deleted rules | `.admin-auth-card h1` (fallback has no h1) and `.admin-prow.readonly` (no `readonly` class anywhere in `src/`, also not on `main`): correct |
| Page head | `k-fadeUp`, ends at opacity 1 |
| Overview stat cards | `k-drop` with staggered delays; after the animations finish: `rotate` = -.8, .6, -.4, .8, -.8deg, `translate` none, opacity 1; at 375 they drop straight (0deg) |
| Dialog | `k-fadeUp` on open |
| Toast | `k-slap` on `.on` (read in CSS; not triggered, since every toast follows a write) |
| Reduced motion | no animation at all in the panel: the global `globals.css` rule (`* { animation: none !important; transition: none !important }`) wins over the panel's `k-fade` swap. Calmer than SPEC §10 asks (fade or nothing), accepted. Resting tilt kept. |
| Lighthouse Accessibility, desktop, light and dark | `/admin` 100 · `/admin/blog` 95 · `/admin/messages` **94** |

## Open item (pre-existing, not caused by this branch)

Both Lighthouse misses are `aria-required-children`, from markup that is the same on `main`:

- **R3.1 `/admin/messages` (94):** `MessagesClient.tsx:125` gives the filter links `role="tablist"`, but its
  children are plain links (`a[aria-current]`), not `role="tab"`. Fix: `role="group"` (as the posts filter at
  `PostsListClient.tsx:195` already does). One attribute; brings the page to ≥ 95.
- **R3.2 `/admin/blog` (95, at target):** the `role="row"` divs in `PostsListClient.tsx` hold links and the menu button
  directly, without `role="cell"` wrappers. Fixing it means wrapping each grid child in `<span role="cell">` (or
  dropping the table roles), which touches the row grid; leave it for a later accessibility pass.

## Phase summary

The signed-in admin panel now uses the ink design: paper/ink palette with the coral accent through a token bridge
on `.admin-shell`, ink sidebar with the theme toggle, Bricolage headings with a serif dot, pill buttons, outlined
badges, hard-shadow cards, five tilted Overview stat cards with tape, restyled tables, forms, dialogs, toast, charts,
chess board and editor, phone and tablet layouts, and a small CSS motion layer. Sign-in screens, blog, homepage,
server code and data paths are unchanged. Gates: R1 passed with 4 fixes, R2 needed one fix round (unscoped media
rules), R3 passed.
