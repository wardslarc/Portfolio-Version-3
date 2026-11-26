# Claude handoff: admin area planning session (2026-11-26)

Paste this into a new chat to continue: "Read `docs/claude-handoff.md` and `docs/admin-plan.md`, then continue."

## Where things stand

- **Phase:** Gemini implemented all 12 tasks (`c944c8d`..`78ee619`). Claude reviewed them on 2026-11-26:
  lint/test/build pass, and five race/trust issues are written up as a fix spec in `docs/admin-fixes.md`
  (4 tasks). Gemini fixed them (`9cd1ce3`..`9507197`, plus `44efb76` for an empty-`SITE_URL`
  fallback), and Claude re-reviewed them: 59 tests pass. Next: the UI vs. mockup check (themes, 360px/1280px).
- **Who codes:** Gemini in Antigravity implements `docs/admin-plan.md`. Claude's role is planning,
  design, review and answering questions. Don't start implementing unless Carls asks.
- **Git:** on `main`, clean at `4dd3024` when the session started. `docs/admin-plan.md` and this file are
  new and **not committed yet**. Ask before committing.

## Key artifacts

| What | Where |
| --- | --- |
| Security fix spec from the review (4 tasks) | `docs/admin-fixes.md` |
| Full implementation spec (decisions, data model, flows, roles, 12 tasks, definition of done) | `docs/admin-plan.md` |
| Clickable layout mockup (sample data): login + email code, invite accept, overview, messages, chess, admins | https://claude.ai/artifact/CwdKnwY2DUgKvmBg2UFPQj (slug `60b51305-6448-4a9d-ae2f-2df4a15245b8`, version `1795700292-5f9e`) |

To change the mockup, read it with `read_artifact` and republish to the same slug. The local source
file was in a session scratchpad and may be gone.

## Decisions Carls made (don't re-ask)

- An admin area for contact messages and visitor chess moves.
- 2FA through a **6-digit email code sent by Resend** after email + password.
- **Keep** the "Trust this device for 30 days" option. Each admin gets 10 backup codes.
- **Multiple admins** via email invites, with **three roles**: Owner, Admin, Viewer.
- Messages: archive plus a permanent delete. Chess: read-only log and replay, plus moderation (undo last
  move, clear a cooldown, end game).
- **Vercel Analytics** (Web Analytics + Speed Insights) on the public site, with `/admin` excluded.
  Four custom events: `contact_submitted`, `chess_move`, `resume_opened`, `project_link`.

## Context worth knowing

- Stack: Next.js **16.4.6** (`cacheComponents: true`), React 19, MongoDB driver 7, zod 4, chess.js,
  Vitest + mongodb-memory-server. `AGENTS.md` says to read `node_modules/next/dist/docs/` before
  coding. `node_modules` was **not installed** during this session.
- Existing collections: `messages`, `rate_limits` (TTL), `chess_games` (moves embedded),
  `chess_move_locks`. Resend is called through its REST API in `src/lib/contact.ts`.
- Styling: the tokens in `src/app/globals.css`, Geist / Geist Mono, one blue accent. The mockup follows these.
- Caveats Claude already told Carls about:
  - An email code is only as strong as the inbox. TOTP could be added later.
  - Vercel custom events need the **Pro** plan.
  - Vercel has no simple read API for analytics on Hobby, so the admin links out to the Vercel dashboard
    instead of charting that data.
  - Carls has to enable Analytics and Speed Insights in Vercel by hand.

## Open items

1. Docs committed (2026-11-26).
2. Save the mockup HTML into `docs/admin-mockup.html` so Gemini can reference it offline? (Offered, no answer yet.)
3. Next likely asks:
   - Review Gemini's commits against `docs/admin-plan.md`'s definition of done (use `/code-review`).
   - Adjust the mockup.
   - Answer implementation questions.
