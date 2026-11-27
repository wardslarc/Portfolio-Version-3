# Task: Implement the "Code by day, ink by night" portfolio redesign

You're working in the codebase for my portfolio, **carlsdaleescalo.com** (Next.js, MongoDB, hosted on Vercel). Replace the current homepage design with the redesign described below. The scroll choreography is modeled on landonorris.com (by OFF+BRAND, Awwwards Site of the Year 2025). Don't copy that site. Use it as the reference for *how* sections move and transition.

A working prototype is attached as `portfolio-v3-prototype.dc.html`. It's written in a custom template format (`{{holes}}`, `<sc-for>`, `<sc-if>`, a `DCLogic` class). **Treat it as a visual and behavioral reference only.** Port the markup, styling and motion to idiomatic Next.js/React. Don't copy its template syntax.

## Before you write code

1. Explore the repo. Work out the Next.js version (App Router or Pages), the styling approach (Tailwind? CSS modules?), and how these existing features are built:
   - the **blog** at `/blog`
   - the **visitor chess game** (shared game, one move per day, stored in MongoDB)
   - the **contact form**, including its spam honeypot field
   - the **résumé PDF** link
   - SEO metadata, Open Graph and Twitter tags, and `robots`
2. Keep all of those features working. This is a redesign of the homepage UI, not a rewrite of the backend.
3. Tell me your plan (files to add or change, dependencies to install) before you start the big changes.

## Who I am (content source)

- Carls Dale Escalo, full-stack & systems developer, Makati, Philippines.
- Day job: Systems Developer at Rustan Marketing Corporation (2026 to now). Before that: IT Staff / Web Developer at Citimax Group Inc. (2023 to 2025), and Web Developer Intern at Business Machine Corporation (2023). BS Computer Science, University of Makati (2019 to 2023).
- I also draw digitally in Clip Studio Paint, mostly portraits and character art, and post it on Instagram as **@daleonigiri** (https://www.instagram.com/daleonigiri/). The onigiri (rice ball) is my personal mark.
- Reuse the existing site's real copy, links and project data wherever possible. Don't invent stats, numbers or testimonials.

## Concept

The page has two halves, the way Lando's site splits "On Track" and "Off Track":
- **"On the clock"** (day): warm graph paper with near-black ink, for my development work.
- **"Off the clock"** (night): dark ink, for my art.

Hand-drawn marks (handwritten notes, scribbled underlines, the onigiri doodle) run through the whole page. They're what make it feel human rather than templated.

## Design tokens

| Token | Value | Use |
|---|---|---|
| paper | `#F3F1EC` | main light background |
| sand | `#E6E0D2` | work section background |
| card | `#FBFAF7` | card surfaces |
| ink | `#16161A` | text, borders, dark sections |
| muted | `#4A463F` | secondary text on light backgrounds |
| muted-dark | `#C9C5BB` | secondary text on dark backgrounds |
| coral | `#E8492A` | accent fills, large text, buttons |
| coral-text | `#B8361A` | small coral text on light backgrounds (passes AA) |
| coral-night | `#FF6A47` | coral on dark backgrounds |

- Graph-paper texture: 32px grid lines at `rgb(128 128 128 / .1)`.
- **Fonts** (Google Fonts, via `next/font`):
  - Bricolage Grotesque 800: headlines
  - Instrument Serif, italic: one accent word per headline, e.g. "teams *actually* use", "On the *clock.*"
  - Caveat 700: handwritten notes (temporary, until I provide my own handwriting)
  - Geist: body text
  - Geist Mono: labels and metadata
- **Style:**
  - 1.5px ink borders, hard offset shadows (`8px 8px 0 #16161A`), cards tilted 1–2°
  - "tape" strips on cards, made from a semi-transparent coral rectangle
  - **No** gradient washes, emoji or left-border cards
- **Accessibility:** text contrast ≥ 4.5:1, touch targets ≥ 44px, real `<button>`/`<a>`/`<label>` elements, and an `aria-label` on every icon-only button.

## Tech for motion

- Install **`gsap`** (with **ScrollTrigger**) and **`lenis`** for smooth inertial scrolling. Wire Lenis into ScrollTrigger with `lenis.on('scroll', ScrollTrigger.update)` and drive it from the `gsap.ticker`.
- Use `gsap.context()` / `useGSAP` (from `@gsap/react`) so animations clean up on unmount. Create animations only on the client.
- Use `gsap.matchMedia()` to:
  - turn the pinned horizontal track and the split-scene pin into normal vertical layouts below 760px
  - **respect `prefers-reduced-motion: reduce`**: no Lenis, no pinning, no parallax, everything static and visible. Full motion for everyone else.
- Animate only `transform`, `opacity`, `clip-path` and colors. Keep it at 60fps.

## Page sequence (top to bottom)

0. **Sticky header**
   - Contents: onigiri logo + "carls.dale" on the left; links "On the clock", "Off the clock", "Blog"; a coral "Let's talk" pill button.
   - The header background and text color follow the current page theme (see "Background color transitions" below).
   - On mobile: a 44px menu button that opens a stacked menu.

1. **Hero: pinned, then it shrinks.**
   - Pin for about 1000px of scroll. The hero is a paper card filling the whole screen.
   - **On load:**
     - a Caveat note "hi, I'm Carls ↘" fades in
     - the headline "I build tools / teams *actually* / use." slides up line by line, with "actually" in coral italic serif and a hand-drawn SVG underline that draws itself
     - then the paragraph, the CTAs (See the work, Résumé (PDF), @daleonigiri) and the portrait appear
   - **Portrait sketch reveal:** my photo sits on top of my own line sketch of myself. A 120px circular mask follows the cursor and cuts through the photo to show the sketch. Use a CSS `mask-image` radial-gradient driven by CSS variables. Caption: "↑ hover me — there's a sketch underneath". On touch devices, make it tap-to-toggle or a slow automatic sweep.
   - **On scroll (scrubbed):**
     - the card scales to 0.6, rotates -2°, gains a 36px radius and a deep shadow
     - this reveals a dark background behind it with two giant marquee rows: "CODE BY DAY ✦ INK BY *night* ✦" and an outlined row "NEXT.JS · NODE · MYSQL · DOCKER · CLIP STUDIO", moving in opposite directions
     - in the last ~45% of the pin, a large coral **onigiri drawing** is stroked over the card (SVG `stroke-dashoffset`). This replaces Lando's signature. Use my real signature or doodle once I provide it.

2. **Statement.** One big paragraph:
   - Text: "I like owning a project end to end — from the first conversation with the people who'll use it, to the database, the interface, and the server it runs on. *Then I go home and draw.*"
   - Split it into words. Each word goes from 20% to 100% opacity as you scroll through. The final sentence is coral italic serif.

3. **"On the clock": pinned horizontal track.**
   - Background: sand.
   - Vertical scroll moves a row of panels sideways (`x: -(trackWidth - viewportWidth)`), with a coral progress bar along the bottom.
   - Panels:
     - an intro panel: "01 / SELECTED WORK", heading "On the *clock.*", one line of copy, and a Caveat note "keep scrolling →"
     - four project cards: RMK Learning Hub, Bilyo, Relato, IT Ticketing System. Each has a screenshot, status, title, description and stack. Each card also drifts vertically by its own amount (±30–50px) as the track moves.
     - an end panel: "+ 8 more projects *below ↓*"
   - Handwritten notes on the cards, in coral Caveat: "built from scratch!", "my own product ✎", "no more manual logs".
   - Hovering a card straightens it and deepens its shadow.

4. **More projects and experience.** Still on sand.
   - A list of the remaining projects with a "Show more / Show fewer" toggle.
   - A "Where I've *built.*" heading that slides up from a mask.
   - A 4-column experience strip (wraps on mobile).

5. **Split scene: "On the CLOCK / Off the CLOCK".**
   - Pinned for about 1400px, on paper.
   - Centered heading: two columns. "On the" / "Off the" in serif, "CLOCK" in heavy sans. Caveat notes under each column: "↑ that was the day job" and "↓ here's the night shift".
   - In the first 35% of the pin, a photo of me at my desk slides in from the left and my favorite drawing slides in from the right, each tilted with an ink shadow.
   - From 50% to 92%, a dark circle grows out of the drawing's position (`clip-path: circle()` at about 72% 50%) until it fills the screen, revealing "Ink by / *night.*" in giant type.
   - This hands over seamlessly to the dark art section that follows.

6. **"Hall of *sketches.*"**, dark.
   - Heading, plus a short blurb linking to @daleonigiri.
   - Three columns of artwork frames, each moving at a different parallax speed (about +60px, -80px and +110px). Stagger the columns' start heights.
   - Each frame has a dark card, the image, and a mono caption.
   - Below it, the **visitor chess game**: hook up the *existing* chess feature here in the new styling. Don't rebuild its logic.

7. **"Follow the *sketchbook.*"**, paper.
   - Five Instagram-post cards stacked in the center. As the section scrolls into view, they fan out: each card moves `i × 140px` sideways, `|i| × 28px` down and rotates `i × 9°`, for i = -2 to 2.
   - Below the cards: one line of copy and a coral "@daleonigiri on Instagram ↗" button.

8. **Contact plus footer.**
   - A dark panel with large rounded top corners that **rises over** the page. Animate its clip-path inset from (9% 5% 0) to (0), so its corners settle to 40px.
   - Heading "Let's build / *something.*", which slides up line by line.
   - Copy, plus the email with a "copy" button.
   - My signature.
   - The **existing contact form**, restyled. Keep the honeypot, but make sure it's hidden visually *and* from screen readers.
   - Footer line: "© 2026 Carls Dale Escalo · Makati, PH" and "Coded in Next.js · drawn in Clip Studio".

## Global motion rules

- **Background color transitions:** each major section declares a theme (`paper`, `sand`, `dark`). When a section crosses the middle of the viewport, tween the page's background and text color to that theme over about 0.9s. Lando does this with olive → sage → cream.
- **Heading reveals:** every section heading slides up from behind an `overflow: clip` mask.
- **Generic reveals:** blocks fade in and translate up 56px on enter, scrubbed or triggered once.
- **Hover:** buttons lift with a hard offset shadow, cards straighten, and art frames scale to 1.03.

## Assets

I'll put my real assets in `public/images/`. Until then, use clearly labelled placeholders like `[Screenshot: Bilyo]` or `[Drawing from @daleonigiri]`, and list every placeholder in your final summary. Use `next/image` for all images. Needed:
- portrait photo
- self-portrait line sketch (for the hero reveal)
- signature (SVG preferred, so it can be stroke-animated)
- photo of me at my desk
- 4 project screenshots
- 6–9 drawings

Don't pull images from Instagram yourself.

## Done means

- `npm run build` passes, with no hydration errors and no console errors.
- Lighthouse on mobile: Performance ≥ 85, Accessibility ≥ 95.
- The whole sequence works in Chrome, Safari and Firefox.
- At 375px wide, the page is a clean vertical layout with no horizontal overflow.
- With reduced motion on, everything is visible and static.
- The blog, chess, contact form, résumé link and SEO metadata all still work.
- Then give me a short summary: what changed, which new dependencies you added, the placeholders still waiting for assets, and how to tune the scroll distances (pin lengths, parallax amounts).
