# Review gate R3 (B3: K07–K08): 2 fixes

Reviewed 2026-11-28 by Claude, from `0d09a57` (R2 gate) to `73bd0ab`. Commits: K07 `ca34298`, K08 `73bd0ab`.
Gemini had no browser; Claude did the browser pass (headless Chrome, production build).

## Passed

- `npm run lint` clean; `npm test` 145/145; `npm run build` passes with `/` still `○`.
- Load-in sequences (SPEC §9.2) are wired with the right keyframes, delays and durations on `/blog`, tag pages, the
  post and the 404; all end by ~2.2s, `backwards` fill, nothing left mid-state at the top of the post or the 404.
- Scroll-driven rules sit inside `@supports (animation-timeline: view())`; the progress bar is hidden without support.
- Reading progress: only on post routes; `scale` goes from `0 1` at the top to `1` at the bottom.
- Footer `grow` finishes (`clip-path: none` at the end); cards keep `rotate: var(--rot)` after their animations, so the
  hover straighten still works (post cover: `-0.8deg / -.8deg`).
- Calm tier: under reduced motion every animation becomes `k-fade` or none, the progress bar is hidden, and
  (because `globals.css` already zeroes animation durations under reduced motion) content simply appears.
- Homepage leak check (`/` → `/blog` → back → post → back): ScrollTriggers 62 → 0 → 62 → 0 → 62, `lenis` only on `/`.

## Fixes

### R3.1 Reveals that depend on the element's height leave first-screen content faded

The scroll-driven ranges are percentages of the `entry` range (`ink.css` `@supports` block, `ink-blog.css:1105-1130`).
`entry 100%` is reached only when the whole element is inside the viewport (or, for elements taller than the viewport,
when its top reaches the top). So tall elements stay half-faded and tilted until scrolled a long way. Worst case: on
`/blog` at 1440×900 the **"Latest" featured card is on the first screen and loads at opacity 0.35, rotated 2.6deg**
(at 375 it's nearly invisible) until the user scrolls ~400px.
**Fix (two parts):**
1. The featured card is first-screen content, so it gets a **time-based** load-in instead of a scroll one: a new
   `.ink .k-in-settle { animation: k-settle .9s cubic-bezier(.2,.7,.2,1) backwards; }` with `animation-delay: .55s` on
   `.blog-feat`; its tape `k-in-slap` at 1.2s and the "fresh off the press!" chip a `k-pop` load-in (.45s, same easing
   as `k-in-slap`) at 1.35s. Remove their `k-sc-*` classes. Its cover keeps `k-sc-para`.
2. Every other scroll-driven reveal uses **length-based** ranges, so it finishes after a fixed scroll distance whatever
   the element's height:

   | Class / rule | New `animation-range` |
   |---|---|
   | `k-sc-up`, prose `> h2` (fadeUp part), `> blockquote`, `> pre` | `entry 0px entry 160px` |
   | `k-sc-settle`, prose `> figure`, `> img`, `> p > img` | `entry 0px entry 260px` |
   | `k-sc-settle.k-s2` / `.k-s3` | `entry 40px entry 300px` / `entry 80px entry 340px` |
   | `k-sc-slap` | `entry 160px entry 260px` |
   | `k-sc-pop`, prose `> blockquote::before` | `entry 80px entry 220px` |
   | `k-sc-under`, prose `> h2` (underline part) | `entry 60px entry 200px` |
   | `k-sc-grow` | `entry 0px entry 320px` |

   Keep `k-sc-para` (`cover`) and the progress bar (`scroll(root)`) as they are. Keep the calm-tier overrides working
   with the new ranges.

**Check:** load `/blog` at 1440×900 and 375×800; after 3s the featured card's computed opacity is `1` and its rotate is
`-0.6deg` without scrolling. On the post at 375×800, the bio card reaches opacity 1 within 260px of scrolling once its top
enters the screen.

### R3.2 The cover morph never runs, so remove it

Clicking the featured card (list → post) and going back started **no view transition at all**: a wrapper around
`document.startViewTransition` logged zero calls. The Next guide explains why
(`node_modules/next/dist/docs/01-app/02-guides/view-transitions.md:112`): "The morph plays when the destination content
renders in the same commit as the navigation … If the destination suspends into a fallback first, no pair forms."
The post body (`ArticleView`) and the blog list both stream in behind `<Suspense>`, and SPEC §3 forbids changing the
blog's data flow, so the pair can't form.
**Fix:** remove the two `<ViewTransition>` wrappers (`PostList.tsx:113-125`, `ArticleView.tsx:173-185`), their imports,
and the morph-only CSS in `ink.css` (`::view-transition-group(.morph)`, `::view-transition-image-pair(.morph)`,
`@keyframes k-via-blur`, and `::view-transition { pointer-events: none; }`). Keep the theme circle and its
reduced-motion rule. SPEC BD7 is updated to match.
**Check:** `grep -rn "ViewTransition\|\.morph\|k-via-blur" src` finds nothing; the theme toggle still circles in
Chrome; list → post → back navigates normally.
