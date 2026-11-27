# Security hardening spec (2026-11-27)

Written by Claude after a security review of the codebase and the live site. Gemini implements it.
Do the tasks in order and commit each one on its own (`fix(security): …`).

Read `AGENTS.md` first. This is Next.js **16.4.6** with `cacheComponents: true` and
`partialPrefetching: true`. Check the bundled docs before writing code:

- `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md` (read **"Without Nonces"**)
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md`

## What the review found

The application code is in good shape: the auth, the role checks, the markdown sanitizer, input
validation and secret handling are all fine. **Don't refactor them.** This spec covers only these gaps:

| # | Finding | Severity | Who fixes it |
|---|---|---|---|
| 1 | No security headers (CSP, frame-ancestors, nosniff, Referrer-Policy, Permissions-Policy); HSTS has no `includeSubDomains`; `x-powered-by` is exposed | Medium | Gemini, T1 |
| 2 | Cloudflare's proxy sits in front of Vercel, so `clientIp()` sees Cloudflare IPs and per-IP rate limits key on the wrong address | Medium | **Carls, M1** (DNS setting, no code) |
| 3 | The per-email login limit counts every attempt *before* the password check, so anyone who knows the admin email can lock the Owner out | Medium | Gemini, T2 |
| 4 | `npm audit`: 4 high alerts from an old `zod@4.1.11` nested under `@vercel/blob → @vercel/oidc → @vercel/cli-config` (GHSA-mrhx-c7xc-m3w5) | Low | Gemini, T3 |
| 5 | `acceptInvite` marks an invite as accepted, then fails if an admin with that email already exists, which leaves the invite burned | Low | Gemini, T4 |

---

## T1: Security headers (`next.config.ts`)

Add `poweredByHeader: false` and an `async headers()` that returns one entry with
`source: "/:path*"` and the headers below.

**Use a static CSP with no nonces.** A nonce-based CSP forces every page into dynamic rendering, and
the Next docs say it is incompatible with Partial Prerendering. The site is mostly prerendered, so
keep it that way. `'unsafe-inline'` for scripts is needed for Next's inline RSC payload and for the
theme script in `src/app/layout.tsx`.

Build the CSP string in a small helper inside `next.config.ts` from these directives. Join them with
`"; "` and leave no newlines in the final string.

| Directive | Value | Why |
|---|---|---|
| `default-src` | `'self'` | |
| `script-src` | `'self' 'unsafe-inline' https://va.vercel-scripts.com` plus `'unsafe-eval'` **only when** `NODE_ENV === "development"` | Next inline payload, theme script, and Vercel Analytics/Speed Insights (dev loads the debug script from va.vercel-scripts.com; prod serves it from `/_vercel/…`) |
| `style-src` | `'self' 'unsafe-inline'` | Inline styles exist (e.g. the admin preview page) |
| `img-src` | `'self' data: blob: https:` | Blog markdown can use any `https` image (the sanitizer already allows only https); `blob:` covers previews in the upload/image-prep code |
| `font-src` | `'self'` | Geist is self-hosted by `next/font` |
| `connect-src` | `'self' https://vercel.com https://*.public.blob.vercel-storage.com https://va.vercel-scripts.com` | Client blob uploads go to `https://vercel.com/api/blob` (seen in `@vercel/blob/dist`) |
| `object-src` | `'none'` | |
| `base-uri` | `'self'` | |
| `form-action` | `'self'` | |
| `frame-ancestors` | `'none'` | Stops clickjacking of `/admin` |
| `upgrade-insecure-requests` | (no value), **production only** | |

**Vercel Toolbar on preview deploys:** when `process.env.VERCEL_ENV === "preview"`, also add
`https://vercel.live` to `script-src`, `connect-src` and `frame-src` (add `frame-src https://vercel.live`
only in preview). Otherwise the Toolbar breaks on previews.

The other headers, on every route:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

Don't touch `images`, `cacheComponents` or `partialPrefetching`.

**Acceptance**
- `npm run build && npm start`, then `curl -sI http://localhost:3000/` and `curl -sI http://localhost:3000/admin/login`
  both show every header above, and neither shows `x-powered-by`.
- In a browser on the production build, the console shows **no CSP violations** on: `/` (chess board loads and
  a move request goes out, the contact form submits), `/blog`, one `/blog/<slug>` with images
  (like and share buttons work), `/admin/login`, and the admin editor with an **image upload** and
  the live preview. Light/dark theme still applies before first paint.
- Add `next.config` unit coverage only if it's easy; the manual check above is the real gate.

## T2: The email login limit counts failures only (`src/lib/admin/auth-actions.ts`)

Currently `loginStepOneAction` (around lines 119–130) consumes both the IP and email buckets before
`verifyAdminCredentials`.

Change it to:

1. **IP bucket:** unchanged. It still counts every attempt (5 per 15 minutes) before verification.
2. **Email bucket:** before verifying, only **read** the current count without incrementing. Add
   `peekRateLimit(db, key, windowMs, maxPerWindow, nowMs?)` to `src/lib/admin/rate-limit.ts`, using the
   same `_id` scheme `${key}:${windowStart}`, returning `true` while `count < max`.
3. Run `verifyAdminCredentials` as before. It must always run, even when the email bucket is full, so
   response timing doesn't reveal the lockout state.
4. If the credentials are **wrong**, call `consumeRateLimit` on the email key, then return the usual
   `"Invalid email or password."` (or the too-many message if the bucket was already full).
5. If the credentials are **right** but the email bucket is full, allow sign-in **only** when the
   request also has a valid trusted-device cookie (`hasValidTrustedDevice`). Otherwise return
   `"Too many sign-in attempts. Wait 15 minutes and try again."` and **don't** start a 2FA challenge or
   send an email.
6. A correct password never increments the email bucket.

**Tests** (extend `src/lib/admin/auth-actions.test.ts` and/or `rate-limit` tests, using mongodb-memory-server
like the existing ones):
- 5 wrong passwords for an email → the 6th attempt with the **correct** password and **no** trusted device is refused,
  and no challenge document is created.
- Same setup, but with a valid trusted-device cookie → sign-in succeeds.
- Correct-password sign-ins don't increment the email bucket (sign in 6 times → never blocked by the email limit).
- `peekRateLimit` doesn't create or increment documents.

## T3: Clear the nested zod advisory (`package.json`)

Add:

```json
"overrides": { "zod": "^4.6.7" }
```

Then run `npm install` and commit `package.json` and `package-lock.json`.

**Acceptance:** `npm audit --omit=dev` reports 0 vulnerabilities; `npm ls zod` shows a single version ≥ 4.6.7;
lint, test and build pass. If `@vercel/blob` misbehaves with the override (check the upload flow from T1's
browser pass), stop and report instead of forcing it.

## T4: Don't burn an invite for an existing admin (`src/lib/admin/auth.ts`, `acceptInvite`)

When the email already belongs to an admin, either the pre-check or the duplicate-key `catch` returns an error,
and `acceptedAt` stays set. In both of those error paths, reset it:
`invites.updateOne({ _id: tokenHash }, { $set: { acceptedAt: null } })` (the generic-error path already
does this). Keep the atomic `findOneAndUpdate` claim, so two concurrent accepts still can't both succeed.

**Test:** an invite for an email that already exists → `acceptInvite` returns the "already exists" error and the
invite document has `acceptedAt: null` afterwards.

---

## M1 (Carls, manual): Turn off Cloudflare proxying for the site records

DNS check on 2026-11-27: `carlsdaleescalo.com` uses Cloudflare nameservers (`imani`/`sean.ns.cloudflare.com`),
and both the apex and `www` resolve to Cloudflare proxy IPs (`104.21.65.8`, `172.67.156.252`). Vercel
overwrites `X-Forwarded-For` with the connecting IP, which here is Cloudflare's edge. So every per-IP limit
(contact, admin login/code/invite, likes, views, chess) currently keys on Cloudflare IPs instead of real visitors.

Steps:
1. Cloudflare dashboard → DNS → for the apex `A` record and the `www` record, switch the orange cloud to
   **grey (DNS only)**. The values should be the ones Vercel shows under Project → Settings → Domains
   (typically `A 76.76.21.21` and `CNAME cname.vercel-dns.com`).
2. Wait a few minutes, then confirm `curl -sI https://www.carlsdaleescalo.com` **no longer** shows `server: cloudflare`
   or `cf-ray`, and the Vercel Domains page shows both domains as valid.
3. Vercel then issues and serves TLS and HSTS itself. No code change is needed.

If you'd rather keep Cloudflare's proxy, say so and Claude will write a follow-up task (trusting
`cf-connecting-ip`, which needs Vercel Enterprise's trusted-proxy feature or blocking direct origin access).
That route is more complicated, which is why turning the proxy off is the recommended fix.

## Definition of done

- T1–T4 committed separately; `npm run lint`, `npm test` and `npm run build` all pass.
- T1's browser pass shows no CSP violations on the listed pages.
- `npm audit --omit=dev` is clean.
- Carls has done M1, and `curl -sI https://www.carlsdaleescalo.com` shows the T1 headers with no Cloudflare headers.
- Then Claude reviews: re-runs the checks, reads the diffs, and checks the live headers.
