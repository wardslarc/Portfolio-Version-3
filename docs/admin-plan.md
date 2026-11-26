# Admin area + Vercel Analytics: implementation plan

Status: approved, ready to build. Layout reference (clickable mockup):
https://claude.ai/artifact/CwdKnwY2DUgKvmBg2UFPQj

This file is the spec for the coding agent. Work through the tasks in order, one commit per task,
and keep `npm run lint`, `npm test` and `npm run build` green after each one.

## Decisions already made

| Topic | Decision |
| --- | --- |
| Sign-in | Email + password, then a 6-digit code emailed through Resend (2FA) |
| Trusted device | Optional "Trust this device for 30 days" checkbox skips the code step on that device |
| Fallback | 10 one-time backup codes per admin |
| Admins | Multiple admins, invited by email |
| Roles | Owner (everything, incl. admins), Admin (messages + chess moderation), Viewer (read only) |
| Messages | Archive (soft delete) plus a permanent delete with confirmation |
| Chess | Read-only log + replay, plus moderation: undo last move, clear a cooldown, end game and start a new one |
| Analytics | Vercel Web Analytics + Speed Insights on the public site, `/admin` excluded |

## Ground rules for the coding agent

1. **Read `AGENTS.md` first.** This repo runs Next.js 16.4 with `cacheComponents: true`, and APIs differ
   from older versions. Run `npm install`, then read the relevant guides in
   `node_modules/next/dist/docs/` (route handlers, Server Actions, `cookies()`, dynamic rendering,
   `"use cache"`, `proxy`/middleware) before writing code. Follow deprecation notices.
2. **Follow the existing patterns:**
   - `src/lib/mongodb.ts` for DB access (`getDb()`, `isMongoConfigured()`).
   - `src/lib/contact.ts` for zod validation, IP hashing and the Resend REST call (no Resend SDK).
   - `src/app/api/contact/route.ts` and `src/lib/chess.ts` for rate limiting via the `rate_limits` collection with a TTL index, and for duplicate-key retry.
   - Tests use Vitest + `mongodb-memory-server` (see `src/app/api/chess/*.test.ts`).
3. **Styling:** reuse the tokens in `src/app/globals.css` (light + dark). Put admin styles in their own
   section of that file or in `src/app/admin/admin.css`. Use no UI libraries. Match the mockup.
4. **No new auth libraries.** Use `node:crypto` only: `scrypt`, `randomBytes`, `createHmac`, `timingSafeEqual`.
5. Every admin page and every admin mutation must check the session **on the server**. Hiding a button
   in the UI is not access control.
6. **Never store raw secrets.** Session tokens, codes, invite tokens and backup codes are stored as
   hashes only. Compare them in constant time.
7. Admin pages must be dynamic (never cached or prerendered), `noindex`, and disallowed in `robots.ts`.

## Environment variables (add to `.env.example` and Vercel)

```bash
# Admin
ADMIN_OWNER_EMAIL=mail@carlsdaleescalo.com   # who the setup script makes the first Owner
ADMIN_SECRET=long-random-string               # HMAC key for codes, tokens and device trust
# Already present and reused: MONGODB_URI, MONGODB_DB, RESEND_API_KEY, CONTACT_FROM_EMAIL, IP_HASH_SALT
```

## Data model (MongoDB)

```ts
admins {
  _id, email (unique, lowercase), name, role: "owner" | "admin" | "viewer",
  passwordHash,            // scrypt: "scrypt$N$r$p$salt$hash"
  backupCodeHashes: string[],  // unused codes only, HMAC'd
  createdAt, passwordChangedAt, lastSignInAt, disabledAt: Date | null
}
admin_sessions {          // TTL index on expiresAt
  _id: tokenHash, adminId, createdAt, lastSeenAt, expiresAt,
  userAgent, city, country, ipHash
}
admin_trusted_devices {   // TTL index on expiresAt (30 days)
  _id: tokenHash, adminId, createdAt, expiresAt, userAgent
}
admin_login_challenges {  // TTL index on expiresAt (10 min)
  _id: challengeId, adminId, codeHash, attempts, expiresAt, resendAvailableAt
}
admin_invites {           // TTL index on expiresAt (48 h)
  _id: tokenHash, email, role, invitedBy, createdAt, expiresAt, acceptedAt: Date | null
}
admin_audit {
  _id, adminId, adminName, action, target, detail, at
}  // index { at: -1 }
messages                  // existing; add optional readAt: Date | null, archivedAt: Date | null
```

## Auth flows

**Sign-in (`/admin/login`)**
1. POST email + password (Server Action). Rate-limit to 5 tries per 15 minutes per email and per IP hash.
   Return the same generic error whether the email is unknown or the password is wrong.
2. If the password is valid and a valid trusted-device cookie for this admin exists, create the session now.
3. Otherwise create an `admin_login_challenges` row with a 6-digit code (`randomInt`). The code is
   stored as an HMAC, expires in 10 minutes and allows 5 attempts. Email it via Resend with the subject
   "Your admin sign-in code" and include the time and approximate location. Set a short-lived
   httpOnly `admin_challenge` cookie holding the challenge id. Show step 2 with a masked email.
4. On a correct code (or an unused backup code, which is then removed), delete the challenge and create
   a session. If "Trust this device" is checked, create a trusted-device row and cookie
   (`admin_device`, 30 days).
5. A resend is allowed after 60 seconds. It issues a new code and the old one stops working.

**Session cookie:** `admin_session` holds a random 32-byte token. The DB stores only its hash.
Set `httpOnly`, `secure` (in prod), `sameSite: "strict"` and `path: "/admin"`. The session lasts 7 days
and slides on activity. `requireAdmin(minRole)` loads the session and admin and checks the role.
If the admin is disabled or removed, the result is an immediate sign-out.

**Invites:** an Owner sends an email and a role. The invite row stores a token hash with a 48-hour
expiry. Resend emails the link `/admin/invite/<token>`. The invitee sets a name and a password
(at least 12 characters), then signs in normally (step 2 code). After the first code verification,
show 10 backup codes once with a Copy button. Inviting an email that already belongs to an admin is
an error. Re-sending an invite replaces the token.

**Bootstrap:** `npm run admin:setup` runs `scripts/admin-setup.ts` via `tsx`, which you'll need to add as
a dev dependency. If no admins exist, it creates an Owner from `ADMIN_OWNER_EMAIL` and prints a one-time
invite link. There is no public sign-up.

**Guards:**
- The last Owner can't be removed or demoted.
- Removing an admin deletes their sessions and trusted devices.
- Changing a password signs out the admin's other sessions.

## Roles → permissions

| Action | Owner | Admin | Viewer |
| --- | :-: | :-: | :-: |
| View overview, messages, chess, own security | ✓ | ✓ | ✓ |
| Mark read/unread, archive, delete messages | ✓ | ✓ | |
| Chess undo / clear cooldown / end game | ✓ | ✓ | |
| Invite, change role, remove admins | ✓ | | |
| View admin activity log | ✓ | ✓ | |

Put this table in code as one `can(role, action)` map in `src/lib/admin/permissions.ts`.

## Pages (App Router)

```text
src/app/admin/
  layout.tsx              # requireAdmin(); sidebar (desktop) / tab strip (<=760px); metadata noindex
  page.tsx                # Overview
  messages/page.tsx       # inbox list + reader (?id=, ?q=, ?filter=all|unread|noemail|archived, ?page=)
  chess/page.tsx          # current game, move log, replay, moderation, past games (?game=)
  admins/page.tsx         # admins table, invite dialog, your security, activity log
  login/page.tsx          # outside the guarded layout (use a route group, e.g. (auth))
  invite/[token]/page.tsx # accept invite
src/lib/admin/
  auth.ts                 # hashing, sessions, challenges, trusted devices, requireAdmin
  email.ts                # Resend sends: code, invite, "new device signed in"
  permissions.ts
  audit.ts                # logAudit(admin, action, target, detail)
  data.ts                 # queries for messages, chess, stats
  actions.ts              # Server Actions (each one: requireAdmin + can() + zod + logAudit)
```

## Vercel Analytics

**Add to the public site:**
- `npm i @vercel/analytics @vercel/speed-insights`.
- In `src/app/layout.tsx`, render `<Analytics />` from `@vercel/analytics/next` and `<SpeedInsights />`
  from `@vercel/speed-insights/next` inside `<body>`.
- Exclude the admin: use the `beforeSend` prop to return `null` for any URL whose pathname starts with
  `/admin`. Do the same for Speed Insights. This keeps admin traffic and admin URLs out of the stats.
- Enable **Web Analytics** and **Speed Insights** in Vercel → Project → Analytics. This is a manual
  step for Carls and needs a deploy afterwards.

**Custom events** (`track()` from `@vercel/analytics`). Custom events need a Vercel Pro plan, and the
code is harmless on Hobby. Keep event names and properties free of personal data:

| Event | Where | Properties |
| --- | --- | --- |
| `contact_submitted` | Contact form, after a 2xx response | none |
| `chess_move` | ChessSection, after a successful move | `{ ply }` |
| `resume_opened` | Intro resume button click | none |
| `project_link` | Work section outbound links | `{ project }` (slug) |

**In the admin Overview:**
- Add a "Site traffic" card that links out to the project's Vercel Analytics and Speed Insights
  dashboards. Store the dashboard URL in `src/content/site.ts` as `analyticsUrl`.
- Vercel has no simple read API for Web Analytics on Hobby, so don't try to chart Vercel data inside
  the admin. The Overview charts (moves per day, messages per week, top countries) come from MongoDB.

## Tasks (one commit each)

1. **Setup.** Run `npm install`, read the Next 16 docs listed above, and add the env vars to `.env.example`.
   Add `/admin` to the `disallow` list in `robots.ts`.
2. **Vercel Analytics.** Add the packages, `<Analytics>` and `<SpeedInsights>` with the `/admin`
   exclusion, and the four `track()` events. Test that `beforeSend` drops `/admin` URLs.
3. **Auth core (`src/lib/admin/auth.ts`, `permissions.ts`, `audit.ts`, `email.ts`).** Covers password hashing,
   sessions, challenges, trusted devices, backup codes, `requireAdmin`, `can()` and the indexes
   (`ensureAdminIndexes`, same pattern as `ensureChessIndexes`).
   Unit tests: hash and verify, code expiry, attempt limits, a code working only once, trusted-device
   skip, a disabled admin being rejected, and constant-time comparisons.
4. **Bootstrap script.** `scripts/admin-setup.ts` and the `admin:setup` npm script.
5. **Login + invite pages.** Two-step sign-in, resend cooldown, backup-code mode, the trust checkbox,
   invite acceptance, and a one-time display of backup codes. Rate limits. Sign out.
6. **Admin shell.** Guarded layout, sidebar / mobile tab strip, unread count badge, "signed in as · role".
7. **Messages.** List, search, filters and pagination (25 per page). Reader with Reply (`mailto:`),
   mark read/unread, archive and delete (confirm dialog). The "Emailed to you / Email failed" badge.
   Opening a message sets `readAt`. Tests: filters, permissions (a Viewer can't mutate), and pagination.
8. **Chess.** Current game stats and the move log (ply, SAN, from → to, city/country, visitor hash
   prefix, time). A replay board built from `startFen` + moves with chess.js, using « ‹ › » buttons and
   arrow keys. Past games list, with `?game=` opening the same viewer.
9. **Chess moderation.** Server Actions:
   - **Undo last move:** pop the last move, recompute `fen`, `version + 1`, delete that visitor's and IP's lock for that ply.
   - **Clear cooldown:** delete the lock by visitor hash.
   - **End game:** set the status, then let `getOrCreateActiveGame` start the next one.

   Each action runs in a transaction like `commitMoveTransaction` and is audited.
   Tests: undo keeps the ETag/version logic consistent, and a concurrent visitor move during undo fails cleanly.
10. **Admins page.** Table, invite dialog, resend/revoke invite, change role, remove (with the
    last-Owner guard), "Your security" (regenerate backup codes, change password, signed-in devices
    with sign-out), and the activity log. Tests for every guard.
11. **Overview.** Stat cards (unread, messages in 7 days, moves today, current game), latest
    messages, moves per day (last 7 days), top countries, and the Vercel "Site traffic" link card.
12. **Docs + polish.** Update `README.md` (admin section, setup script, analytics). Accessibility pass:
    44px targets, focus states, labels, and dialogs built with `<dialog>`. Check both themes at 360px and
    1280px.

## Definition of done

- `npm run lint`, `npm test` and `npm run build` pass.
- A signed-out request to any `/admin/*` page or admin action is redirected to login or rejected.
- A Viewer can't perform any mutation, even by calling the Server Action directly (test this).
- No raw token, code or password appears in the DB, logs or analytics events.
- Admin pages are never in the Vercel Analytics data and never in the sitemap.
- The UI matches the mockup in light and dark themes, on desktop and on mobile.
