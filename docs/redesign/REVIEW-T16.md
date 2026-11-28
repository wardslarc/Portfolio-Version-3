# T16 final review: **passed in headless Chrome; real-browser checks are Carls's**

Reviewed 2026-11-28 by Claude at `270227d` (code as of `df22609`), on a production build (`next start -p 3100`) in
headless Chrome. **No fixes are needed. Gemini has nothing to do.**

## Results

| Check (TASKS T16) | Result |
|---|---|
| `npm run build`; `/` static | ✅ passes, `/` is `○` |
| Console: no errors, hydration warnings or CSP violations on `/`, `/blog`, `/blog/<slug>`, `/admin/login`, a 404 | ✅ none (only the known local `/_vercel/*insights` 404s and `/api/chess` 503) |
| Lighthouse **mobile** on `/` (lighthouse 12): Performance ≥ 85, Accessibility ≥ 95 | ✅ **87 / 100**. FCP 1.1s, LCP 3.4s, TBT 240ms, **CLS 0** |
| 375px: no horizontal overflow anywhere | ✅ checked at every 80% viewport step down the page, full and reduced motion |
| Reduced motion: no Lenis, no pins; desktop layout at 1440 and 1900; stacks at 375 | ✅ (no `lenis` class, no pin height; screenshots) |
| Hero pins and fits at 1024×560, 1280×600, 1440×900 (D24) | ✅ the pinned section is viewport + 1000px at each size; the 1024×560 screenshot fits |
| No class defined twice per module | ✅ the grep finds only `.splitRight` and `.sketchNote2`, both grouped selectors (`.a, .b {}` plus a specific rule), not collisions |
| SEO: title, description, canonical, OG, Twitter card, JSON-LD; `robots.txt`; `sitemap.xml` | ✅ all present; robots disallows `/api/` and `/admin`; sitemap `lastmod` 2026-11-28 |
| Résumé link | ✅ `/Escalo-CarlsDale_Resume.pdf` returns 200 |
| Theme rules (T02) on all four routes, light and dark stored | ✅ `/`: `data-home`, no `data-theme`, a single `#F3F1EC` theme-color tag, `scroll-behavior: auto`. `/blog`, `/admin/login` and the 404 follow the stored theme, with two media-scoped tags and `smooth` |
| Activity: `/` → `/blog` → back → post → back | ✅ ScrollTriggers 62 → 0 → 62 → 0 → 62, `lenis`/`data-home` follow the route, no pin-spacers, no inline styles on `<html>`/`<body>`. The hidden home nodes keep only empty `style=""` (GSAP revert) and the 12 static React custom properties from SSR |
| Contact form | ✅ see `REVIEW-R3.md` (real submit, honeypot, rate limit, clipboard) |

**Nit (no action needed):** Lighthouse's unscored `label-content-name-mismatch` flags the hero portrait toggle: its
visible text is the sketch notes ("brow line…") and its `aria-label` is "Show the sketch under the photo". Optional fix
later: add `aria-hidden="true"` to the note text, or start the label with the visible words.

## Left for Carls (real browsers and devices)

Run the whole page top to bottom in each: hero intro and pin, portrait tap, the track, split scene, gallery
parallax, fan, chess board, contact form, and the dark/light toggle on `/blog`.

- [ ] Chrome desktop  - [ ] Safari desktop  - [ ] Firefox desktop
- [ ] iOS Safari (also check that the address bar collapsing doesn't make the pins jump)
- [ ] Android Chrome
- [ ] macOS/iOS "Reduce motion" on: things fade but nothing slides or pins

## Summary for Carls

**What changed:** 35 commits, 68 files under `src/` (+4.4k / −0.5k lines). The homepage is rebuilt in
`src/components/home/` with CSS Modules and GSAP + ScrollTrigger + Lenis motion (in `motion/`), with section themes
(paper/sand/dark), a pinned hero with a portrait/sketch reveal, a horizontal work track, a split day/night scene, the
night gallery and sketchbook fan, the compact chess card, "Latest from the blog", and the new contact panel. The old
`Intro/Greeting/About/Work/Writing/Experience/Contact` components are deleted. `/blog`, `/admin` and the 404 keep
their own theme toggle.

**New dependencies:** `gsap` ^3.15.1 and `lenis` ^1.3.29.

**Placeholders waiting for assets** (ARCHITECTURE §12; set `src` in `assets` in `src/content/home.ts`):
`portraitSketch` (`/images/portrait-sketch.png`), `signature` (`/images/signature.svg`), `deskPhoto`,
`favoriteDrawing`, `workRmk`/`workBilyo`/`workRelato`/`workTicketing` (`/images/work/…`), `art01`–`art09`
(`/images/art/…`), `post1`–`post5` (`/images/sketchbook/…`). Also the contact signature note
`[your real signature]` in `contact.signatureNote`.

**Tuning:**
- Pin lengths: `src/components/home/hero/Hero.module.css` (`calc(var(--stage-h) + 1000px)`) and
  `src/components/home/SplitScene.module.css` (`+ 1400px`). The track's length follows its content.
- Card drift: `drift` per project in `src/content/home.ts` (−50, 40, −30, 50 px).
- Gallery parallax: `speed` per column in `src/content/home.ts` (60, −80, 110).
- Every other number is in `docs/redesign/DESIGN_TOKENS.md` §3 and §5.

**Before going live:** delete the three "R3 review test" messages in `/admin/messages`, then merge
`redesign/ink-by-night` into `main` once the device checks pass.
