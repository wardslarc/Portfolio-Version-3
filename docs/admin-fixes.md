# Admin area: security fixes after review

Status: ready to build. This follows `docs/admin-plan.md` (all 12 tasks are done, at `78ee619`).
A review found five issues. They are all race conditions or trust problems. None of them shows up in
normal single-user testing.

Work through the tasks in order and make one commit per task. Keep `npm run lint`, `npm test` and
`npm run build` passing after each one. The ground rules in `admin-plan.md` still apply: read
`AGENTS.md`, use only `node:crypto`, store hashes only, and check on the server.

**The pattern behind most of these fixes:** don't read a document, check it in JavaScript, and then
write. Do the check and the write in **one** MongoDB operation, with the condition in the filter of
`findOneAndUpdate`, `findOneAndDelete` or `updateOne`. Use a transaction when a decision depends on
more than one document.

---

## Task 1: Make the sign-in code attempt limit atomic, and stop resends from resetting it

**Files:** `src/lib/admin/auth.ts`, `src/lib/admin/auth-actions.ts`, `src/lib/admin/auth.test.ts`

**Problem:**
- `verifyLoginChallengeCode` reads `attempts`, compares the code, and only later runs `$inc`. If many
  guesses arrive in parallel, they all read `attempts: 0`, so the limit of 5 doesn't hold.
- `resendLoginChallenge` sets `attempts: 0` and moves `expiresAt` 10 minutes forward. Resending every 60
  seconds keeps one challenge alive forever, at 5 fresh guesses a minute.
- `verifyLoginCodeAction` has no rate limit.

Someone who has the password can brute-force the 6-digit code.

**Changes:**

1. Add `createdAt: Date` and `resendCount: number` to `AdminLoginChallengeDoc`. Set them in
   `createLoginChallenge` (`createdAt: now`, `resendCount: 0`).
2. Add these constants: `CHALLENGE_MAX_LIFETIME_MS = 30 * 60 * 1000` and `CHALLENGE_MAX_RESENDS = 3`.
3. Rewrite the start of `verifyLoginChallengeCode` so it **uses up an attempt before comparing the code**:
   ```ts
   const challenge = await challenges.findOneAndUpdate(
     { _id: challengeId, expiresAt: { $gt: now }, attempts: { $lt: CHALLENGE_MAX_ATTEMPTS } },
     { $inc: { attempts: 1 } },
     { returnDocument: "after" },
   );
   if (!challenge) {
     // Work out why, so the existing reasons and messages still apply.
     const existing = await challenges.findOne({ _id: challengeId });
     if (!existing) return { ok: false, reason: "not_found" };
     if (existing.expiresAt.getTime() <= now.getTime()) {
       await challenges.deleteOne({ _id: challengeId });
       return { ok: false, reason: "expired" };
     }
     return { ok: false, reason: "too_many_attempts" };
   }
   ```
   Every submission now counts as an attempt, including the correct one. That's intended: 5 tries
   means 5 submissions in total.
4. Remove the trailing `$inc: { attempts: 1 }`, because the attempt was already counted above.
5. **Make sure a correct code only works once** (this is also review issue 5). Don't use a plain
   `deleteOne`. Claim the challenge like this:
   ```ts
   const claimed = await challenges.findOneAndDelete({ _id: challengeId, codeHash: challenge.codeHash });
   if (!claimed) return { ok: false, reason: "not_found" }; // a parallel request already used it
   ```
   Do the same on the backup-code path. After the `$pull` succeeds, delete the challenge with
   `findOneAndDelete({ _id: challengeId })`. The backup code is still used up even if that returns
   null, which is fine.
6. Change `resendLoginChallenge`:
   - Don't reset `attempts`.
   - Refuse once `resendCount >= CHALLENGE_MAX_RESENDS`, with a new reason `"resend_limit"`.
   - New expiry: `min(now + CHALLENGE_TTL_MS, createdAt + CHALLENGE_MAX_LIFETIME_MS)`.
   - Do the update atomically, so two resends at the same moment can't both pass the cooldown:
     ```ts
     const updated = await col.findOneAndUpdate(
       { _id: challengeId, expiresAt: { $gt: now }, resendAvailableAt: { $lte: now },
         resendCount: { $lt: CHALLENGE_MAX_RESENDS } },
       { $set: { codeHash, expiresAt, resendAvailableAt }, $inc: { resendCount: 1 } },
       { returnDocument: "after" },
     );
     ```
     If it returns null, read the document to choose `not_found` / `expired` / `cooldown` (with
     `retryAfterSec`) / `resend_limit`.
   - In `resendCodeAction`, handle `resend_limit` by returning
     `{ step: "credentials", error: "Too many codes requested. Sign in again." }` and deleting the challenge cookie.
7. Add a rate limit to `verifyLoginCodeAction`, before it calls `verifyLoginChallengeCode`:
   `consumeRateLimit(db, \`admin-code:ip:${meta.ipHash}\`, 15 * 60 * 1000, 20)`. When it's over the
   limit, return the `code` step with the error "Too many attempts. Wait 15 minutes and try again."
   (Move `getRequestMeta()` above this check.)

**Tests** (add to `auth.test.ts`):
- Send 20 wrong codes at once with `Promise.all` against one challenge. At most 5 return
  `invalid_code` and the rest return `too_many_attempts`. The stored `attempts` is never above 5.
- 4 wrong codes, then a resend: the 5th try with the **new** correct code works, and a 6th try is refused.
  This shows a resend doesn't reset the count.
- Resending a 4th time returns `resend_limit`.
- After resends, `expiresAt` is never later than `createdAt + 30 min`.
- Two parallel submissions of the correct code: exactly one returns `ok: true`.
- The same backup code submitted twice in parallel: exactly one works.

---

## Task 2: Build invite links from the configured site URL

**Files:** `src/lib/admin/actions.ts`

**Problem:** `getOriginUrl()` builds the invite link from `x-forwarded-host` / `host`. A spoofed header
could send an invite email whose link points to another domain.

**Changes:**
- Delete `getOriginUrl()`. Build links from `process.env.SITE_URL ?? site.url`, with any trailing `/`
  removed. Do this in a small helper `inviteUrl(token)`. `scripts/admin-setup.ts` already reads
  `SITE_URL`, so the two stay consistent.
- Remove the `headers` import if nothing else uses it.
- If `SITE_URL` isn't in `.env.example`, add it with a comment: `# Optional. Base URL for admin invite links (defaults to site.url). Use http://localhost:3000 locally.`

**Test:** Not required. Check by hand that a local invite link uses the `SITE_URL` from `.env.local`.

---

## Task 3: Make the last-Owner guard safe when two changes happen at once

**Files:** `src/lib/admin/mutations.ts`, `src/lib/admin/admins.test.ts`

**Problem:** `changeAdminRole` and `removeAdmin` count Owners and then write. If two Owners demote or
remove each other at the same moment, both see "2 owners", both succeed, and zero Owners are left.

A plain transaction is **not enough**. Under snapshot isolation each transaction writes a different
document, so MongoDB sees no conflict and both commit (write skew). Both transactions have to write
**one shared document** so that one of them conflicts and retries.

**Changes:**
1. Add a helper in `mutations.ts`:
   ```ts
   const ADMIN_META_COLLECTION = "admin_meta";
   async function touchOwnerGuard(db: Db, session: ClientSession) {
     await db.collection<{ _id: string; v: number }>(ADMIN_META_COLLECTION)
       .updateOne({ _id: "owner-guard" }, { $inc: { v: 1 } }, { upsert: true, session });
   }
   ```
2. Move the body of `changeAdminRole` and `removeAdmin` into a transaction. Use the same retry loop as
   `undoLastChessMove`: up to 3 attempts, retrying when `isTransientTxError` is true, and a
   `WriteConflict` has that label. Inside the transaction:
   - Call `touchOwnerGuard` **first**.
   - Read the target with `{ session }`.
   - When the target is an Owner and the change removes Owner rights, count
     `{ role: "owner", disabledAt: null }` with `{ session }`. If the count is `<= 1`, abort and return
     the existing error.
   - Write the role change or delete with `{ session }`.
   - Commit.
3. Keep `revokeAllAdminSessions` / `revokeAllAdminDevices` and `logAudit` **after** the commit.
4. Extract `isTransientTxError` if you need to share it. Don't copy it.

**Tests:** `admins.test.ts` must use `MongoMemoryReplSet`, because transactions need a replica set.
`chess-moderation.test.ts` shows the setup.
- Two Owners A and B. Run `changeAdminRole(A→B, "admin")` and `changeAdminRole(B→A, "admin")` together
  with `Promise.all`. Exactly one succeeds, the other returns "Cannot demote the last Owner.", and
  exactly one Owner is left.
- The same check with `removeAdmin` in both directions.
- The same check mixing one remove with one demote.
- The existing single-request guard tests still pass.

---

## Task 4: Make invite acceptance safe when it runs twice at once

**Files:** `src/lib/admin/auth-actions.ts`, plus a test in `admins.test.ts` or `auth.test.ts`

**Problem:** `acceptInviteAction` checks the invite, inserts the admin and only then marks the invite
accepted. Two parallel submissions both pass the check. The second insert hits the unique `email` index
and throws, so the user sees a 500 error.

**Changes:**
1. Run `hashPassword` **before** claiming the invite, because it's slow. That keeps the time between
   claiming the invite and inserting the admin short.
2. Claim the invite in one step:
   ```ts
   const invite = await invites.findOneAndUpdate(
     { _id: tokenHash, acceptedAt: null, expiresAt: { $gt: now } },
     { $set: { acceptedAt: now } },
     { returnDocument: "after" },
   );
   if (!invite) return { error: "This invite link is invalid or has expired." };
   ```
3. Keep the "admin already exists" check after the claim.
4. Put `insertOne` in a try/catch. On duplicate-key error `11000`, return
   `{ error: "An admin account with this email already exists." }`. On any other error, set
   `acceptedAt` back to `null` on that invite so the link still works, then throw the error again.
5. Keep `redirect("/admin/login?invited=1")` outside the try/catch. `redirect` works by throwing.

**Test:** To test the logic directly, pull it out into a plain function, for example
`acceptInvite(db, { token, name, password, now })` in `auth.ts` or a new `invites.ts`, and have the
action call it. Two parallel calls with the same token: exactly one creates an admin, the other returns
an error, nothing throws, and there's exactly one admin with that email.

---

## Definition of done

- `npm run lint`, `npm test` and `npm run build` pass, and all the new tests above exist and pass.
- `git grep -n "x-forwarded-host" src/lib/admin` returns nothing.
- No `findOne` → check → `updateOne`/`deleteOne` sequences are left in `verifyLoginChallengeCode`,
  `resendLoginChallenge`, `acceptInviteAction`, `changeAdminRole` or `removeAdmin`.
- Signing in still works the normal way: password, code, then the backup codes shown on first sign-in.
  The trusted-device skip and the resend after 60 s still work.
- The commit messages match the existing style, for example
  `fix(admin): make sign-in code attempt limit atomic`.
