# Claude handoff: blog and sign-in redesign (2026-11-28)

Paste into a new chat: **"Read `docs/redesign-blog/HANDOFF.md`, then continue."**

## Where things stand

- The homepage redesign is finished (T16 passed, see `docs/redesign/HANDOFF.md`). This is the follow-up phase on the
  same branch, `redesign/ink-by-night`.
- Carls approved the mockups (canvas https://claude.ai/artifact/9cESW7sS12T127KmdZXvTS, slug
  `45b46c79-ca8f-4d5f-a4d1-ed3b04ce6ba1`; sources copied to `mockups/`). Decisions BD1–BD8 are in `SPEC.md` §2.
- B1 + **R1 passed**, B2 + **R2 passed**, pushed. B3 done (K07 `ca34298`, K08 `73bd0ab`). **R3 found 2 fixes**
  (`REVIEW-R3.md`): R3.1 first-screen featured card loads faded (scroll ranges → time-based load-in + length ranges);
  R3.2 cover morph never fires under Suspense → removed (SPEC BD7 updated). Gemini is doing them. Then Claude re-checks,
  marks R3 passed, pushes and gives the B4 prompt. Carls still has to eyeball the admin preview (end of REVIEW-R2).
- **Don't click Like/Share/Copy link on the live post in reviews:** they write real engagement rows (R2 recorded one
  share by accident). Stub `fetch` first, as R3 of the homepage did for the contact form.
- Gemini has no browser in Antigravity, so Claude does the visual pass at every gate.

## How Claude reviews (same method as the homepage, see `docs/redesign/HANDOFF.md` "How Claude reviews" and "Gotchas")

1. `git log` / `git diff <last gate>..HEAD`; read every changed file against the task's How/Acceptance/Do not and SPEC §3.
2. `npm run lint`, `npm test`, `npm run build` (`/` stays `○`/`◐`).
3. Browser: `npx next start -p 3100` and headless Chrome (CDP 9333) as background tasks; `docs/redesign/tools/probe.mjs`
   and `cdp-check.mjs` for checks and screenshots. Light, dark (`--dark`), reduced motion, 1440 and 375.
4. Gate focus:
   - **R1:** `.ink` tokens in all theme combinations; `/` unchanged (header markup, `--bg`, T16 Activity check);
     theme toggle + circle; theme-color tags; no dark flash.
   - **R2:** blog pages vs mockups; no `a a`; prose styles; TOC; like/share/copy; admin preview styled, admin panel
     unchanged; old `.blog-*` rules gone from `globals.css`.
   - **R3:** load-in and scroll motion; `@supports` fallback; calm tier; card hover after animations; cover morph;
     `/` → `/blog` → post → `/` leak check (ScrollTriggers, `lenis`, `data-home`).
   - **R4:** sign-in **security review** (SPEC §11.6, TASKS K09 acceptance: diff of `src/lib`/`src/app/api` empty,
     one `code` field, field names/autoComplete unchanged) — real sign-in needs Carls's credentials, so ask him to do
     the live sign-in, code and backup-code steps; then cleanup checks and a final Lighthouse on `/blog`, a post and
     `/admin/login`.
5. Write `docs/redesign-blog/REVIEW-R<n>.md` (passed, or numbered fixes with file:line and a check each), commit it with a
   pathspec, push after a pass, update this file, and give Carls the next Gemini prompt.
