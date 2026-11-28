# Review gate R4 (B4: K09–K10): 6 fixes, then Carls's live checks

Reviewed 2026-11-28 by Claude, from `11fb770` (R3 gate) to `1c7cc88`. Commits: K09 `f331685`, K10 `1c7cc88`.

## Security review (K09) — passed

- `git diff 11fb770..HEAD -- src/lib src/app/api next.config.ts` is empty.
- `LoginClient.tsx`: the same three server actions in the same order (`loginStepOneAction`, `verifyLoginCodeAction`,
  `resendCodeAction`, `cancelChallengeAction`); credentials fields unchanged (`email`/`email`/`autoComplete="email"`,
  `password`/`current-password`, both `required`, `autoFocus` on email); code step submits exactly one `code` field
  (hidden input in email-code mode, the original text input in backup mode — never both); `trustDevice` checkbox
  unchanged; error and notice texts unchanged (`role="alert"` / `role="status"`); nothing logged or stored.
- `InviteClient.tsx`: hidden `token`, `name` (`maxLength=80`, `required`), `password` and `confirmPassword`
  (`new-password`, `minLength=12`, `required`) unchanged; the length bar is `aria-hidden` and only reads the length.
- Rendered `/admin/login`: fields as above, `noindex, nofollow` robots meta, focus starts in Email, always dark
  (`ink ink-dark`) even with `cde-theme=light`, no horizontal scroll at 375.
- `OtpInput` helpers are unit-tested (`OtpInput.test.ts`); 150/150 tests pass, lint clean, build passes, `/` still `○`.

## K10 cleanup — passed

`Header.tsx` and `BlogFooter.tsx` are gone and nothing imports them; the removed global classes (`.site-header`,
`.site-footer`, `.bar`, `.brand`, `.nav`, `.header-right`, `.icon-btn`) have no remaining users except
`MediaLibraryClient`'s `<div class="bar">`, which `admin.css` (`.admin-usage .bar`) fully styles. `.admin-auth-*` stays
because the admin panel and the pages in R4.5 still use it.

## Fixes

### R4.1 Digit boxes block overwriting and phone autofill (spec error)

`OtpInput.tsx` gives each box `maxLength={1}` (SPEC §11.3 asked for it; that was Claude's mistake). With it, typing into a
filled box does nothing unless its text is selected, and browsers that enforce `maxlength` on autofill cut an iOS/Android
"one-time-code" fill in the first box down to one digit, so the `handleChange` spread never runs.
**Fix:** remove `maxLength` from the six visible boxes (the handler already keeps one digit and spreads longer input),
and select the box's content on focus (`onFocus={(e) => e.currentTarget.select()}`) so typing replaces it. SPEC §11.3 is
updated.
**Check:** unit test for `handleChange`-style input "123456" in box 1 spreading to all six (extend the helper tests);
in a browser, typing "7" into a box that holds "5" leaves "7" and moves focus right.

### R4.2 "copied!" on the backup-codes step is read as part of the button

`LoginClient.tsx` (Copy codes button) renders `<span … aria-live="polite">copied!</span>` inside the button, the same
issue as blog R2.2. **Fix:** `aria-hidden="true"`, no `aria-live`. **Check:** the button's accessible name is "Copied".

### R4.3 The card doesn't drop in

SPEC §9.2 (sign-in row): card `cardIn` .9s at .3s with `cubic-bezier(.2,.9,.25,1.2)`. `AuthShell.module.css` `.card`
has no animation (`getComputedStyle(card).animationName` is `none`). **Fix:** add it (the `k-cardIn` keyframes already
exist in `ink.css`; use `backwards` fill). Below 760px the card's rotate is 0, so end the animation at `var(--card-rot)`
or make the narrow card use a keyframe ending at 0 (no snap at the end). Reduced motion: fade only. The shake classes must
still win over it while shaking. **Check:** on load the card drops in and settles; after an error it shakes; with reduced
motion it only fades.

### R4.4 The page behind the sign-in screens is paper, not ink

On `/admin/login` the body background computes `rgb(243, 241, 236)` (paper). In `globals.css:46-48` the light rule
`:root:not([data-home]):has(.ink:not(.ink-contained))` (specificity 0-4-0) beats the dark rule's
`:root:not([data-home]):has(.ink-dark)` (0-3-0). It shows on overscroll (iOS rubber-band) and in the browser chrome.
**Fix:** raise the dark selector, e.g. `:root:not([data-home]):has(.ink.ink-dark)`. **Check:** body background on
`/admin/login` is `rgb(22, 22, 26)` with `cde-theme` unset, light and dark; `/blog` is unchanged.

### R4.5 Loading, invalid-invite and not-configured states still use the old card

`src/app/admin/(auth)/invite/[token]/page.tsx:22-25, 42-45, 63` ("Database not configured", "Invite invalid or
expired", the "Checking invite…" fallback) and `src/app/admin/(auth)/login/page.tsx:68` (the "Loading…" fallback)
render `admin-auth-wrap`/`admin-auth-card` on a white page. An expired invite link lands there.
**Fix:** render them with `AuthShell` (no form): kicker `Portfolio control panel`; titles split from today's h1 —
"Invite invalid / *or expired.*", "Database not / *configured.*"; the existing sentence as the card text; the loading
states use the screen's normal title ("Admin / *sign-in.*", "Accept admin / *invite.*") with "Loading…" / "Checking
invite…" in the card. Note text: `staff only ✎` for all of them. No new copy beyond this.
**Check:** `/admin/invite/not-a-real-token` shows the dark page with "Invite invalid or expired" after loading.

### R4.6 "← back to the site" wraps at 375px

At 375×800 the top-bar link breaks onto two lines beside the logo. **Fix:** below 760px give it
`white-space: nowrap; font-size: 12px`. **Check:** one line at 375 and 320.

## After the fixes: Carls's live checks (needs his admin account)

1. Sign in at `/admin/login` with a wrong password once: "Invalid email or password." and the card shakes.
2. Sign in properly; on the code step, paste the 6-digit code from the email into the first box (all six fill), tick
   "Trust this device", and verify. Also try one wrong code first: "Invalid code. Check your email or use an unused backup
   code." and a shake.
3. "Use backup code" switches to the single field; "Resend" counts down; "Back" returns to step 1.
4. Open one post's preview in the admin panel and the editor: the preview has the new blog look; the rest of the admin
   panel looks as before (REVIEW-R2).
5. On a real screen, the "Latest" card's tilted top border looks smooth (REVIEW-R3).
6. Optional: phone check of the blog and the sign-in page (iOS Safari / Android Chrome).
