# Admin area: UI polish after the screenshot pass

Status: ready to build. This follows `docs/admin-plan.md` and `docs/admin-fixes.md`. Everything in both
is done, up to `bf5e0d6`.

Claude ran the admin locally with sample data and took screenshots at 360px and 1280px in light and dark
themes. The pages render, and both themes work. The items below are small visual and usability fixes.
None of them touch auth or data.

**Ground rules:** make one commit per task, and keep `npm run lint`, `npm test` and `npm run build`
passing. Use no UI libraries. Use the existing tokens in `src/app/globals.css` and classes in
`src/app/admin/admin.css`. Don't change anything outside `src/app/admin/` unless a task says so. After
each task, check it in a browser at **360px and 1280px, in both light and dark**.

---

## Task 1: Fix the mobile tab strip and the sidebar header

**Files:** `src/app/admin/(panel)/AdminShellNav.tsx`, `src/app/admin/admin.css`

1. **Scroll the active tab into view on mobile.** The tab strip (`.admin-nav`) scrolls sideways at
   ≤760px. On the Admins page the active tab sits partly off the right edge.
   - Add a `ref` to the link with `aria-current="page"`. In a `useEffect` that depends on `pathname`,
     call `el.scrollIntoView({ block: "nearest", inline: "nearest" })`.
   - Only do this when the strip actually overflows (`nav.scrollWidth > nav.clientWidth`). Otherwise the
     desktop sidebar might scroll the page.
   - Add `scroll-padding-inline: 16px` to `.admin-nav` in the mobile media query, so the tab doesn't sit
     against the edge.
2. **Keep "Site ↗" on one line.** In the desktop sidebar the arrow wraps onto a second line. Add
   `white-space: nowrap` to `.admin-btn`. If that pushes the brand block wider than the sidebar, let
   the subtitle `.admin-brand-sub` shrink instead (`min-width: 0` on its wrapper div and
   `overflow: hidden; text-overflow: ellipsis` on the subtitle).
3. **Fix the "signed in as" capitalization.** `.admin-user-role` uses `text-transform: capitalize`, so
   it renders as "Signed In As · Owner". Remove that rule. In `AdminShellNav.tsx`, render
   `Signed in as · {roleLabel}`, where `roleLabel` capitalizes only the role (`Owner` / `Admin` /
   `Viewer`). Add a small `ROLE_LABELS` map in `src/lib/admin/permissions.ts` and reuse it anywhere
   else a role is shown to people (the Admins table role badge and the invite dialog), if those
   places format roles by hand.

**Check:** at 360px on `/admin/admins`, the "Admins" tab is fully visible when the page loads. At
1280px, "Site ↗" is on one line and the page doesn't jump when it loads.

---

## Task 2: Remove the large empty gaps

**Files:** `src/app/admin/admin.css`, plus whichever page component turns out to cause the gap

The screenshots show three places with large empty space:
- **Messages:** about 90px of space between the page header (title + search) and the filter buttons
  (All / Unread / Email failed / Archived). The Overview also has extra space under its title.
- **Overview, "Site traffic" card:** the card stretches to match the "Latest messages" card next to it,
  and its text floats in the middle with the button pushed to the bottom.
- **Admins, "Backup codes" card:** the same problem next to the change-password card.

**Likely cause:** `.admin-card` and `.admin-stack` are `display: grid`. When a grid container is taller
than its content, for example because it was stretched to match a neighbour, the default
`align-content` spreads the extra height across its rows.

**Changes:**
1. Add `align-content: start` to `.admin-card` and `.admin-stack`.
2. Reload Messages and Overview. If a gap is still there, find the element in DevTools that adds the
   height (an empty wrapper, a margin, or a grid container stretched by `.admin-shell`'s
   `min-height: 100svh`), and fix it at its source. Don't add negative margins.
3. Keep side-by-side cards the same height. Only the content inside should stay at the top.

**Check:** the space between sections should match the rest of the admin (`.admin-stack` gap of 20px,
`.admin-page-head` margin of 24px).

---

## Task 3: Keep row actions reachable on mobile

**Files:** `src/app/admin/(panel)/admins/AdminsClient.tsx`, `src/app/admin/(panel)/chess/ChessAdminClient.tsx`, `src/app/admin/admin.css`

At 360px, the tables in `.admin-table-wrap` scroll sideways inside their card. Their action buttons
are in the last column, so they're off-screen unless you scroll the table. This affects:
- Team: role select and **Remove**
- Pending invites: **Resend** / **Revoke**
- Signed-in sessions: **Sign out** (on mobile only the Device column is visible)
- Chess move log: **Clear** (cooldown)

**Changes:** at ≤760px, show these tables as stacked rows instead of wide tables. Add one shared
class, for example `.admin-table.stack-mobile`, and apply it to these four tables:
- Hide `thead`. Make each `tr` a card-like block (`display: grid; gap: 4px`, with a bottom border and
  padding).
- Make each `td` show its column name first with `content: attr(data-label)`. Add `data-label="…"`
  to each `<td>` in the JSX, using the same text as the header.
- Put the actions cell last, at full width, with its buttons in a wrapping row (`.admin-row-actions`).
- Leave the 1280px table layout exactly as it is now.

Leave the Activity log and Games tables as sideways-scrolling tables. They have no row actions.

Keep the 44px minimum touch target from the earlier accessibility pass.

**Check:** at 360px, every Remove, Resend, Revoke, Sign out and Clear button is visible without
sideways scrolling, and `document.documentElement.scrollWidth` is still 360 on every admin page.

---

## Task 4: Hide "Remove" on your own row, and fix the visually hidden labels

**Files:** `src/app/admin/(panel)/admins/AdminsClient.tsx`, `src/app/admin/admin.css` (or `globals.css`), and any file that uses `className="skip"` on a label

1. **No Remove on your own row.** In the Team table, don't render the Remove button when
   `a.id === currentAdminId`. Show nothing in its place, or a muted "—". People change their own
   security in "Your security". Keep the server-side guards as they are. This is a UI change only.
2. **Use a real screen-reader-only class.** Two labels in the admin, including the Messages search
   label, use `className="skip"`. That class is the "Skip to content" link style. It's positioned
   off-screen and **becomes visible on focus**, so it's the wrong tool for a label.
   - Add a standard `.sr-only` utility to `globals.css` (position absolute, 1px × 1px, `overflow:
     hidden`, `clip: rect(0 0 0 0)`, `white-space: nowrap`, no margin or padding).
   - Switch both admin labels to `.sr-only`. Find them with `grep -rn 'className="skip"' src/app/admin`.
   - Don't change the real skip link on the public site.

**Check:** with the keyboard, tab into the Messages search box. No dark "Search messages" pill
appears at the top left. Your own row in Team has no Remove button.

---

## Definition of done

- `npm run lint`, `npm test` and `npm run build` pass.
- At 360px, every admin page has `document.documentElement.scrollWidth === 360`, and every row action
  can be reached without sideways scrolling, except in the read-only Activity log and Games tables.
- At 1280px, the layout matches the current screenshots apart from the fixes above.
- Light and dark both look right. No new colors: use only the existing tokens.
- Commit messages follow the existing style, for example `fix(admin): scroll active tab into view on mobile`.
