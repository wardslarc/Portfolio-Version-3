# Claude handoff: admin panel redesign (2026-11-28)

Paste into a new chat: **"Read `docs/redesign-admin/HANDOFF.md`, then continue."**

## Where things stand

- Homepage, blog and sign-in redesign are merged into `main` (`62aedf0`). This phase restyles the signed-in admin
  panel (`src/app/admin/(panel)/**`) on a new branch `redesign/admin-ink`.
- Claude evaluated the panel (SPEC §2), wrote `SPEC.md` (decisions AD1–AD7, proposed, waiting on Carls), `TASKS.md`
  (A01–A06, gates R1–R3) and `mockup.html` (artifact https://claude.ai/artifact/GEyYirQ462r2eTUKgk6ZnU, slug
  `7b6c98e1-6e7d-40f7-b5c6-a7a3639e32a5`).
- B1 (A01, A02) done by Gemini; **R1 passed with fixes R1.1–R1.4** (`REVIEW-R1.md`), which Gemini does first in B2.
- B2 (R1 fixes, A03–A05) done; **R2 not passed: fixes R2.1–R2.5** (`REVIEW-R2.md`; main one: media rules not scoped `.ink`, phone layouts broken).
- **Next:** Gemini does R2 fixes → Claude re-checks R2.1–R2.5 → B3 (A06).
- Gotcha: `pkill -f "next start"` leaves `next-server` running on 3100 (stale build). Kill by port: `ss -ltnp | grep 3100`.
- Local sign-in: `.env.local` has no Resend key, so Carls signs in with a **backup code** (each works once).
- Gemini codes everything; Claude only reviews (same split as the homepage and blog phases).

## Review set-up (the panel needs a real sign-in)

The panel is behind `requireAdmin` (real Mongo from `.env.local`, email two-factor). Claude can't sign in, and must not
create sessions in the database. At each gate:

1. Claude runs `npm run build && npx next start -p 3100` and a **visible** Chrome with CDP on port 9333 and a profile
   dir in the scratchpad (WSLg shows the window).
2. Carls signs in once in that window (`http://localhost:3100/admin/login`). Never ask him for the code or password in
   chat.
3. Claude drives that tab over CDP (`docs/redesign/tools/probe.mjs`, `cdp-check.mjs`) for screenshots in light/dark,
   1440/375, reduced motion. **Read-only:** don't click Save, Publish, Delete, Archive, Revoke, Invite, Upload or any
   chess moderation button; those write to production data.

## How Claude reviews

1. `git log` / `git diff main..HEAD` (or since the last gate); read every changed file against the task's
   How/Acceptance/Do not and SPEC §4.2.
2. The "must stay empty" diff from TASKS ground rules; `npm run lint`, `npm test`, `npm run build`.
3. Browser pass as above; computed-token checks from A01; grep for leftover blue (`2f5bd3`, `8aa8ff`) and visual
   inline styles.
4. Write `docs/redesign-admin/REVIEW-R<n>.md` (passed, or numbered fixes with file:line and a check each), commit it
   with a pathspec, update this file, and give Carls the next Gemini prompt. Small fixes (one-liners, CSS tweaks):
   offer to do them directly.
