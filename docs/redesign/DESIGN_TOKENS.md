# Design tokens and motion numbers

Values are copied verbatim from `REDESIGN_PROMPT.md` (marked **B**) and `portfolio-v3-prototype.dc.html.txt` (marked
**P**, with the line number), or derived by Claude where neither covers a case (marked **D**, with the reason).
**Don't round, rename or "improve" any value.** If a value looks wrong, ask Claude.

Where both sources give a value, they agree unless noted.

---

## 1. Color

### 1.1 Core palette (B, table; P throughout)

| CSS variable on `.root` | Value | Use |
|---|---|---|
| `--home-paper` | `#F3F1EC` | main light background |
| `--home-sand` | `#E6E0D2` | work section background; background of the handwritten note chips on cards |
| `--home-card` | `#FBFAF7` | card surfaces, secondary buttons, form inputs |
| `--home-ink` | `#16161A` | text, borders, dark sections, hard shadows |
| `--home-muted` | `#4A463F` | secondary text on light backgrounds |
| `--home-muted-dark` | `#C9C5BB` | secondary text on dark backgrounds |
| `--home-coral` | `#E8492A` | accent fills, large text, buttons, focus outline |
| `--home-coral-text` | `#B8361A` | small coral text on light backgrounds |
| `--home-coral-night` | `#FF6A47` | coral on dark backgrounds |

### 1.2 Extra colors in the prototype only (P)

| CSS variable | Value | Where (P line) |
|---|---|---|
| `--home-grid-line` | `rgb(128 128 128 / .1)` | graph paper lines (17; B "Graph-paper texture") |
| `--home-placeholder` | `#E9E6DF` | screenshot and desk-photo placeholder background, fan cards 1 and 5, chess mini-board light square (115, 187, 350) |
| `--home-placeholder-2` | `#DCD8CF` | favorite-drawing placeholder, fan cards 2 and 4 (188, 350) |
| `--home-fan-mid` | `#E8492A33` | fan card 3 (center) (350) |
| `--home-tape` | `#E8492A99` | tape strips (114, 126) |
| `--home-green` | `#1F7A4D` | status "● in production", "● on Google Play" (117, 140) |
| `--home-photo-layer` | `#2A2824` | placeholder photo layer in the portrait (85) |
| `--home-photo-label` | `#D8D4CB` text on `#16161A` | "[Your photo goes here]" chip (86); unused once the real photo is in |
| `--home-track-rail` | `#16161A22` | progress bar track (160) |
| `--home-rule` | `#16161A33` | project row borders, experience cell dividers (168, 177) |
| `--home-frame-border` | `#F3F1EC26` | art frame border (209) |
| `--home-frame` | `#1F1F25` | art frame background (209) |
| `--home-frame-image` | `#2B2B33` | art image placeholder background (210) |
| `--home-night-rule` | `#F3F1EC33` | chess frame border, footer top border (218, 260) |
| `--home-board-dark` | `#8E8A80` | chess mini-board dark square (354); reused as `--sq-d` (§1.4) |
| `--home-menu-rule` | `rgb(128 128 128 / .3)` | mobile menu link borders (48) |
| `--home-fan-shadow` | `rgb(0 0 0 / .18)` | fan card shadow (236) |
| (hero shadow) | `rgb(0 0 0 / .7)` at the end of the pin | `.shrink` (22) |

### 1.3 Section themes (P 97–232, `data-bg`/`data-fg`)

| `data-home-theme` | `--home-bg` | `--home-fg` | Sections |
|---|---|---|---|
| `paper` | `#F3F1EC` | `#16161A` | Statement, Split scene, Sketchbook; also the default at the top of the page (P 323) |
| `sand` | `#E6E0D2` | `#16161A` | Work track, More work and experience |
| `dark` | `#16161A` | `#F3F1EC` | Night |
| (none) | — | — | Hero (band `#16161A`, card `#F3F1EC`), Contact panel (`#16161A` / `#F3F1EC`) |

### 1.4 Chess re-mapped tokens, set on `.chessFrame` (D, D12)

Chess reads the global tokens, so `.chessFrame` re-points them for the dark section. Where possible they come from
the palette above, or from the existing dark theme in `globals.css`.

| Global token | Value | Source |
|---|---|---|
| `--bg` | `#1F1F25` | `--home-frame` |
| `--surface` | `#2B2B33` | `--home-frame-image` |
| `--ink` | `#F3F1EC` | paper |
| `--muted` | `#C9C5BB` | muted-dark |
| `--faint` | `#C9C5BB` | muted-dark (the old dark `--faint` `#73737b` would fail AA on ink) |
| `--line` | `#F3F1EC33` | `--home-night-rule` |
| `--accent` | `#FF6A47` | coral-night |
| `--ok` | `#4cc38a` | existing dark `--ok` |
| `--wait` | `#f0b351` | existing dark `--wait` |
| `--danger` | `#fb923c` | existing dark `--danger` |
| `--sq-l` | `#E9E6DF` | mini-board light square (P 354) |
| `--sq-d` | `#8E8A80` | mini-board dark square (P 354) |
| `--hl-last` | `rgb(255 106 71 / .35)` | coral-night at 35% (D) |
| `--hl-sel` | `rgb(255 106 71 / .55)` | coral-night at 55% (D) |
| `--hl-check` | `rgba(220, 38, 38, 0.55)` | unchanged |
| `--dot` | `rgb(22 22 26 / .3)` | ink at 30% (D, shows on both square colors) |

### 1.5 `<html>` canvas on the homepage: `globals.css` `html:root[data-home]` (D1, D16)

```text
--bg: #F3F1EC; --surface: #FBFAF7; --ink: #16161A; --muted: #4A463F; --faint: #4A463F; --line: #16161A33;
--accent: #E8492A; color-scheme: light; scroll-behavior: auto;
```

`theme-color` meta on `/`: `#F3F1EC`.

### 1.6 Contrast (WCAG 2.x, computed by Claude 2026-11-27)

| Foreground on background | Ratio | Allowed for |
|---|---|---|
| ink on paper / sand / card | 15.99 / 13.71 / 17.29 | anything |
| muted on paper / sand / card | 8.31 / 7.13 / 8.99 | anything |
| coral-text on paper / card | 5.20 / 5.62 | anything |
| coral-text on **sand** | **4.46** | **large text only** (≥ 24px, or ≥ 18.66px bold). All prototype uses on sand are 26–104px |
| coral on paper | 3.43 | large text only ("actually", the statement's last sentence) |
| coral on sand | **2.95** | **never text** |
| ink on coral | 4.66 | button labels ("Let's talk", "Send it →", "@daleonigiri on Instagram ↗") |
| paper on ink | 15.99 | anything |
| muted-dark on ink / frame | 10.47 / 9.51 | anything |
| coral-night on ink / frame | 6.36 / 5.78 | anything |
| green `#1F7A4D` on card | 5.09 | anything |

---

## 2. Typography

### 2.1 Families (B, D5)

| Role | Font | Weight / style | CSS |
|---|---|---|---|
| Headlines | Bricolage Grotesque | 800 (700 for the statement, project rows, experience roles, mobile menu) | `var(--font-bricolage), sans-serif` |
| Accent word | Instrument Serif | 400 italic | `var(--font-instrument), serif` |
| Handwritten notes | Caveat | 700 | `var(--font-caveat), cursive` |
| Body | Geist | 400, 500 (labels), 600 (buttons) | `var(--font-geist-sans), system-ui, sans-serif` |
| Labels, metadata | Geist Mono | 400, 500 | `var(--font-geist-mono), ui-monospace, monospace` |

The accent-word pattern applies wherever the serif appears: `font-family: serif var; font-style: italic; font-weight: 400`,
usually with `letter-spacing: -.02em` (P 65, 190–191).

### 2.2 Sizes, per element (P)

| Element | Font | Size | Line height | Letter spacing | Color | P line |
|---|---|---|---|---|---|---|
| Header logo "carls.dale" | Bricolage 800 | 18px | — | -.02em | inherit | 39 |
| Header links | Geist 500 | 14px | — | — | inherit | 40 |
| "Let's talk" pill | Geist 600 | 14px (inherited) | — | — | ink on coral | 42 |
| Mobile menu links | Bricolage 700 | 22px | — | — | inherit; the last one is coral | 47–48 |
| Hero note "hi, I'm Carls ↘" | Caveat 700 | 30px | — | — | coral-text, `rotate(-3deg)`, inline-block | 62 |
| Hero h1 | Bricolage 800 | `clamp(52px, 8.4vw, 124px)` | .9 | -.045em | ink | 63 |
| Hero "actually" | Instrument italic 400 | inherit | — | -.02em | coral | 65 |
| Hero paragraph | Geist | 19px | 1.55 | — | muted; max-width 540px | 68 |
| Hero buttons | Geist 600 | inherit (16px) | — | — | see §4.2 | 70–72 |
| Portrait notes "brow line", "it's all structure." | Caveat 700 | 24px | — | — | coral-text | 83–84 |
| Portrait caption | Caveat 700 | 24px | — | — | muted, centered | 89 |
| Marquee rows | Bricolage 800 | `clamp(72px, 13vw, 210px)` | .92 | -.045em | paper; ✦ coral-night; "night" Instrument italic 400 | 55–56 |
| Marquee row 2 | same | same | same | same | `color: transparent; -webkit-text-stroke: 2px #F3F1EC` | 57 |
| Statement | Bricolage 700 | `clamp(30px, 4.6vw, 60px)` | 1.12 | -.03em | ink; last sentence Instrument italic 400, coral | 98–99 |
| Track label "01 / SELECTED WORK" | Geist Mono | 13px | — | .08em | inherit | 107 |
| Track h2 "On the *clock.*" | Bricolage 800 | `clamp(56px, 7vw, 104px)` | .88 | -.045em | ink; "clock." coral-text | 108 |
| Track intro copy | Geist | 17px | 1.6 | — | muted | 109 |
| "keep scrolling →" | Caveat 700 | 30px | — | — | coral-text | 110 |
| Card meta row | Geist Mono | 12px | — | — | muted; status colored (§4.4) | 117 |
| Card h3 | Bricolage 800 | 32px | — | -.03em | ink | 118 |
| Card description | Geist | 15px | 1.55 | — | muted | 119 |
| Card stack line | Geist Mono | 12px | — | — | muted | 120 |
| Card handwritten notes | Caveat 700 | 28px (the ticketing note: 26px) | — | — | coral-text on sand chip | 122, 134, 155 |
| End panel "+ 8 more projects *below ↓*" | Bricolage 800 | 44px | .95 | -.03em | ink; "below ↓" Instrument italic coral-text | 158 |
| Project row name | Bricolage 700 | 22px | — | -.02em | ink | 169 |
| Project row meta | Geist Mono | 12px | — | — | muted | 170 |
| Show more button | Geist 600 | 14px | — | — | ink | 173 |
| "Where I've *built.*" (h3) | Bricolage 800 | `clamp(40px, 5vw, 64px)` | .95 | -.04em | ink; "built." coral-text | 175 |
| Experience date | Geist Mono | 12px | — | — | muted | 177 |
| Experience role | Bricolage 700 | 20px | — | — | ink | 177 |
| Experience org | Geist | 15px | — | — | muted | 177 |
| Split heading | Bricolage 800 | `clamp(44px, 7.4vw, 118px)` | .86 | -.045em | ink; "On the"/"Off the" Instrument italic 400, -.02em, `display: block` | 189–191 |
| Split notes | Caveat 700 | 26px | — | 0 | coral-text; margin-top 18px | 190–191 |
| "Ink by / *night.*" | Bricolage 800 | `clamp(64px, 12vw, 190px)` | .85 | -.05em | paper; "night." Instrument italic 400 coral-night | 194 |
| Night h2 "Hall of *sketches.*" | Bricolage 800 | `clamp(48px, 7vw, 100px)` | .9 | -.045em | paper; "sketches." coral-night | 202 |
| Night blurb | Geist | 17px | 1.6 | — | paper at `opacity: .8`; link coral-night, underlined | 203 |
| Art caption | Geist Mono | 12px | — | — | muted-dark; year coral-night | 211 |
| Chess note "one move per day, one shared game" | Caveat 700 | 26px | — | — | coral-night | 223 |
| Sketchbook h2 "Follow the *sketchbook.*" | Bricolage 800 | `clamp(48px, 7vw, 100px)` | .9 | -.045em | ink; "sketchbook." coral-text | 233 |
| Sketchbook copy | Geist | 18px | — | — | muted | 241 |
| Contact h2 "Let's build / *something.*" | Bricolage 800 | `clamp(56px, 9vw, 132px)` | .86 | -.05em | paper; "something." Instrument italic coral-night | 248 |
| Contact copy | Geist | 18px | 1.6 | — | muted-dark; max-width 440px | 249 |
| Email button | Geist Mono 500 | 16px | — | — | paper; label Caveat 700 22px coral-night, margin-left 10px | 250 |
| Signature "— Carls" | Caveat 700 | 44px | — | — | coral-night, `rotate(-4deg)`, inline-block; placeholder note in Geist Mono 11px 400 muted-dark | 251 |
| Form labels | Geist 500 | 14px | — | — | ink | 254–256 |
| Inputs | Geist | 15px (textarea 15px/1.5) | — | — | ink | 254–256 |
| Submit "Send it →" | Geist 600 | 16px | — | — | ink on coral | 257 |
| Footer | Geist Mono | 12px | — | — | muted-dark | 260 |

---

## 3. Spacing, size and layout (P)

| Item | Value | P line |
|---|---|---|
| Content max width | 1240px, `margin: 0 auto` | 38, 60, 165, 200, 246, 260 |
| Header nav | `padding: 14px 24px; gap: 16px` | 38 |
| Header link gap | 28px | 40 |
| Logo gap / icon size | 10px / 30×30 | 39 |
| "Let's talk" pill | `padding: 10px 18px` | 42 |
| Mobile menu button | 44×44 | 44 |
| Mobile menu panel | `padding: 4px 24px 20px`; links `padding: 12px 0` | 47–48 |
| Stage height (`--stage-h`) | `min(100vh, 900px)`; `min(100svh, 900px)` where supported (D: svh) | 53–54, 104, 186 |
| Hero pin extra | **1000px** (B "about 1000px"; P `calc(min(100vh, 900px) + 1000px)`) | 53 |
| Hero card padding | `92px 24px 32px` | 59 |
| Hero inner | `flex-wrap: wrap; gap: 56px; align-items: center` | 60 |
| Hero text column | `flex: 999 1 520px; min-width: 0` | 61 |
| Hero portrait column | `flex: 1 1 300px; max-width: 390px` | 75 |
| h1 margin | `12px 0 0` | 63 |
| Hero paragraph margin | `32px 0 0` | 68 |
| CTA row | `gap: 12px; margin-top: 36px; flex-wrap: wrap` | 69 |
| CTA button padding | `15px 24px` | 70–72 |
| Underline SVG | `position: absolute; left: 0; bottom: -6px; width: 100%; height: 22px` | 65 |
| Portrait aspect ratio | `4 / 5` | 76 |
| Portrait notes position | "brow line" `left: 22px; top: 20px`; "it's all structure." `right: 22px; bottom: 26px` | 83–84 |
| Portrait caption margin-top | 20px | 89 |
| Marquee row gap | 4px; item `padding-right: 60px`; **6** repeats per row | 55–57, 360 |
| Onigiri drawing size | `width: min(46vw, 420px); height: min(46vw, 420px)` | 93 |
| Statement section padding | `160px 24px`; paragraph max-width 1100px | 97–98 |
| Track | `gap: 64px; padding: 40px 6vw 0` | 105 |
| Track intro panel width | 420px | 106 |
| Track h2 margin | `14px 0 18px` | 108 |
| "keep scrolling" margin-top | 26px | 110 |
| Project card width | 500px | 113 |
| Card screenshot | `margin: 16px 16px 0; aspect-ratio: 16 / 10` | 115 |
| Card body padding | `20px 26px 26px` | 116 |
| Card h3 margin | `8px 0 6px` | 118 |
| Card stack margin | `12px 0 0` | 120 |
| End panel width | 340px | 158 |
| Progress bar | `left: 6vw; right: 6vw; bottom: 36px; height: 3px` | 160 |
| More section padding | `40px 24px 140px` | 164 |
| Project row | `padding: 18px 0; gap: 6px 24px` | 168 |
| Show more button | `margin-top: 24px; min-height: 46px; padding: 12px 22px` | 173 |
| "Where I've built." margin | `110px 0 28px` | 175 |
| Experience grid | `grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr))`; cell padding 24px; role margin-top 8px | 176–180 |
| Split pin extra | **1400px** (B "about 1400px"; P) | 185 |
| Split cards | `width: min(27vw, 380px); aspect-ratio: 3 / 4; padding: 12px`; left `left: 3%; top: 16%`; right `right: 3%; top: 12%` | 187–188 |
| Split heading | `gap: 5vw; z-index: 2; text-align: center` | 189 |
| Split overlay | `inset: 0; z-index: 3` | 193 |
| Night section padding | `80px 24px 150px` | 199 |
| Night heading row | `gap: 24px 48px; align-items: flex-end; justify-content: space-between; flex-wrap: wrap` | 201 |
| Night blurb max-width | 420px | 203 |
| Gallery | `margin-top: 80px; gap: 28px; flex-wrap: wrap; align-items: flex-start` | 205 |
| Gallery column | `flex: 1 1 260px; gap: 28px` | 207 |
| Column start offsets | `0px`, `120px`, `40px` (`margin-top`; 0 at < 760px, D17) | 346–348 |
| Art frame padding | 12px; caption `padding: 10px 4px 2px` | 209–211 |
| Chess frame | `margin-top: 120px; padding: 32px; gap: 40px` | 218 |
| Sketchbook section padding | `150px 24px 200px`; `text-align: center` | 232 |
| Fan stage | `height: 420px; margin: 70px auto 0; max-width: 900px` | 234 |
| Fan card | `width: 240px; aspect-ratio: 3 / 4; margin-left: -120px; left: 50%; top: 0; padding: 10px; box-sizing: border-box`. Below 760px: width 180px, margin-left -90px (D17) | 236 |
| Sketchbook copy margin | `40px 0 22px` | 241 |
| Instagram button padding | `15px 26px` | 242 |
| Contact panel | `padding: 140px 24px 120px; margin-top: -60px; position: relative; z-index: 2` | 245 |
| Contact columns | `gap: 64px`; left `flex: 999 1 460px`; form `flex: 1 1 380px` | 246–253 |
| Contact copy margin | `28px 0` | 249 |
| Email button | `min-height: 52px; padding: 12px 22px` | 250 |
| Signature margin-top | 40px | 251 |
| Form | `gap: 16px; padding: 28px`; label `gap: 6px` | 253–254 |
| Inputs | `min-height: 46px; padding: 0 14px`; textarea `padding: 12px 14px; rows: 4; resize: vertical` | 254–256 |
| Submit | `min-height: 50px` | 257 |
| Footer | `margin: 100px auto 0; padding-top: 24px; gap: 12px` | 260 |
| Touch targets | ≥ 44px (B) | — |

## 4. Radius, border, shadow and surfaces (P)

### 4.1 Global style rules (B)

- Borders: **1.5px solid ink** (`#16161A`). On dark surfaces, the prototype's own values are used (§4.8).
- Hard offset shadow: **`8px 8px 0 #16161A`** on cards (B). Portrait and split cards use `10px 10px 0 #16161A` (P 76, 187).
- Cards tilted **1–2°** (B).
- Tape: semi-transparent coral rectangle `#E8492A99` (B, P).
- **Never:** gradient washes, emoji, left-border cards (B).

### 4.2 Buttons

| Button | Background | Text | Border | Radius |
|---|---|---|---|---|
| Primary "See the work ↓" | ink | paper | 1.5px ink | 999px |
| Secondary "Résumé (PDF)", "@daleonigiri ✎", "Show more" | card | ink | 1.5px ink | 999px |
| "Let's talk", "@daleonigiri on Instagram ↗", "Send it →" | coral | ink | 1.5px ink | 999px |
| Email copy | transparent | paper | 1.5px paper | 14px |
| Menu (mobile) | transparent | inherit | 1.5px currentColor | 12px |

### 4.3 Header

`position: sticky; top: 0; z-index: 40; background: color-mix(in srgb, var(--home-bg) 88%, transparent); backdrop-filter: blur(10px); border-bottom: 1.5px solid currentColor` (P 37).

### 4.4 Project cards (P 113–157)

| # | Project (`featuredProjects` title) | Kicker | Status text | Status color | `rotate` | Drift (`data-drift`, px) | Tape | Note |
|---|---|---|---|---|---|---|---|---|
| 1 | RMK Learning Hub | `01 — Rustan Marketing` | `● in production` | `#1F7A4D` | `-1.5deg` | `-50` | `top: -14px; left: 40px; rotate(-4deg)` | "built from scratch!": `right: -20px; top: 36%; rotate(8deg)`, 28px |
| 2 | Bilyo | `02 — Personal SaaS` | `● live beta` | `#B8361A` | `1.2deg` | `40` | `top: -14px; right: 50px; rotate(5deg)` | "my own product ✎": `left: -24px; bottom: 30px; rotate(-7deg)`, 28px |
| 3 | Relato - AI Resume Builder (displayed as "Relato") | `03 — Android` | `● on Google Play` | `#1F7A4D` | `-1deg` | `-30` | none | none |
| 4 | IT Ticketing System | `04 — Citimax Group` | `● internal` | inherit (muted) | `1.5deg` | `50` | none | "no more manual logs": `right: -16px; top: -22px; rotate(6deg)`, 26px |

- Card surface: `background: #FBFAF7; border: 1.5px solid #16161A; border-radius: 18px; box-shadow: 8px 8px 0 #16161A; position: relative`.
- Screenshot: `border: 1.5px solid #16161A; border-radius: 12px; background: #E9E6DF`, placeholder in Geist Mono 12px muted.
- Tape: `position: absolute; width: 110px; height: 28px; background: #E8492A99` (aria-hidden).
- Note chip: `position: absolute; background: #E6E0D2; padding: 2px 10px; border-radius: 8px` (aria-hidden).
- Descriptions (P, verbatim):
  1. "The company LMS for assigned courses and progress tracking. Built from the ground up, used across the organization."
  2. "Quotation maker for Filipino freelancers: one-tap client acceptance, PDF export, multi-currency, view tracking."
  3. "AI resume builder for Android. Designed, built and published to the Play Store myself."
  4. "Affiliates file and track tickets in one place, wired to the Google Sheets API so task logs update themselves."
- Titles with an `href` get " ↗" and a `TrackedLink` (D15).

### 4.5 More projects and experience (P 164–181)

- List: `border-top: 1.5px solid #16161A`; rows `border-bottom: 1px solid #16161A33`; `display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline`.
- Row meta format: `{stack} · {kind}` (P 170). Values, with title from `moreProjects` order (P 336–343):

| Title | stack | kind |
|---|---|---|
| Employee Onboarding LMS | React · TypeScript · Firebase | Internal |
| Hardrock Aggregates | React · TypeScript · Vite | Live site |
| Citimax Group website | HTML · CSS · JS | Live site |
| Lifecore Bio-Integrative | React · TypeScript · Firebase | Live site |
| Library Seat Monitor | PHP · MySQL · JS | Internship |
| Marci Metzger Homes | React · TypeScript · Firebase | Freelance |
| Sticky White Board | React · Firebase | Side project |
| Reflective Pomodoro | MERN | Side project |

  (The table follows the `moreProjects` order in `src/content/projects.ts`, which puts Library Seat Monitor before Marci Metzger Homes. The prototype swaps them; use the repo order.)
- Initially shown: **3**. Toggle labels: `Show {moreProjects.length - 3} more projects ↓` (= "Show 5 more projects ↓") and `Show fewer ↑` (P 362–363).
- End-panel count: `+ {moreProjects.length} more` (= 8).
- Experience strip: `border: 1.5px solid #16161A; border-radius: 18px; overflow: hidden; background: #FBFAF7`. Cells are divided by `border-right: 1px solid #16161A33`, except the last.
  Data: `jobs[0..2]` plus `education` from `src/content/experience.ts` (`when`, `title`, `org`), as is.

### 4.6 Split scene (P 187–194)

- Left card: `background: #E9E6DF; border: 1.5px solid #16161A; border-radius: 20px; rotate: -5deg; box-shadow: 10px 10px 0 #16161A`.
- Right card: `background: #DCD8CF`, same border/radius/shadow, `rotate: 5deg`.
- Overlay: `background: #16161A; color: #F3F1EC`, centered text.

### 4.7 Hero (P 53–93)

- Band behind the card: `#16161A`.
- Card: `background-color: #F3F1EC` plus graph paper (§4.10), `color: #16161A`, `overflow: hidden`.
- Shadow layer (D19): `position: absolute; inset: 0; border-radius: 36px; box-shadow: 0 50px 90px rgb(0 0 0)`, starting at `opacity: 0`.
- Portrait frame: `border: 1.5px solid #16161A; border-radius: 20px; overflow: hidden; background: #FBFAF7; box-shadow: 10px 10px 0 #16161A; transform: rotate(2deg); cursor: crosshair`.
- Portrait mask: `radial-gradient(circle 120px at var(--mx) var(--my), transparent 98%, #000 100%)`. The defaults are `--mx: -400px; --my: -400px`; the toggled state is `--r: 1000px; --mx: 50%; --my: 50%` (D18).
- Placeholder sketch SVG (P 77–82), `viewBox="0 0 400 500"`, `stroke="#16161A" stroke-width="2"`:
  - `<circle cx="200" cy="210" r="110" stroke-opacity=".35">`
  - `<path d="M200 90 C185 200 185 260 200 380" stroke="#E8492A">`
  - `<path d="M92 205 C150 222 250 222 308 205" stroke="#E8492A">`
  - `<path d="M120 270 C150 300 175 330 200 345 C225 330 250 300 280 270" stroke-width="3">`
  - `<path d="M150 230 q18 -10 34 0 M216 230 q18 -10 34 0 M188 280 q12 8 24 0 M175 312 q25 12 50 0" stroke-width="2.5">`
  - `<path d="M96 170 C110 90 170 70 220 82 C270 92 310 130 306 190 M120 120 C150 100 190 112 214 96 M150 110 C190 130 240 120 280 140" stroke-width="2.5" stroke-opacity=".7">`
  - `<path d="M60 500 C80 430 130 410 200 410 C270 410 320 430 340 500" stroke-opacity=".5">`
- Underline SVG (P 65): `viewBox="0 0 300 30" preserveAspectRatio="none" fill="none" stroke="#E8492A" stroke-width="5" stroke-linecap="round"`, with
  `<path pathLength="1000" d="M4 20 C60 8 120 26 180 14 S270 10 296 18">`.

### 4.8 Night (P 199–228)

- Art frame: `border: 1px solid #F3F1EC26; border-radius: 16px; background: #1F1F25; padding: 12px; margin: 0` (`<figure>`).
- Art image: `border-radius: 10px; background: #2B2B33`. Placeholder in Geist Mono 11px `#C9C5BB`.
- Chess frame: `border: 1.5px solid #F3F1EC33; border-radius: 20px; padding: 32px`.
- Gallery columns and items (P 345–348):

| Column | Speed (`data-speed`) | `margin-top` | Items (aspect-ratio, caption) |
|---|---|---|---|
| 1 | `60` | `0px` | `4 / 5` "portrait study"; `1 / 1` "sketch → final"; `3 / 4` "color study" |
| 2 | `-80` | `120px` | `3 / 4` "character piece"; `4 / 5` "process shot"; `1 / 1` "quick sketch" |
| 3 | `110` | `40px` | `1 / 1` "fan art"; `3 / 4` "this week"; `4 / 5` "portrait" |

  Caption year: "2026" (P 211). Assign `art01`…`art09` in column order.

### 4.9 Contact (P 245–261)

- Panel: `background: #16161A; color: #F3F1EC`. Corners settle to **40px** (top only).
- Form: `background: #F3F1EC; color: #16161A; border-radius: 20px`.
- Inputs: `border: 1.5px solid #16161A; border-radius: 12px; background: #FBFAF7`.
- Footer rule: `border-top: 1px solid #F3F1EC33`.
- Form label text: "Name", "Email", "What are you building, and when?" (P 254–256).
- Copy (P 249, verbatim): "Freelance builds, internal tools, or a full-time role. Tell me what you're working on and I'll reply by email."
- Footer (B): "© {year} Carls Dale Escalo · Makati, PH" and "Coded in Next.js · drawn in Clip Studio". The year comes from `CopyrightYear`, so it renders "2026" this year, as the brief says.

### 4.10 Graph paper (B, P 17)

```text
background-image:
  linear-gradient(rgb(128 128 128 / .1) 1px, transparent 1px),
  linear-gradient(90deg, rgb(128 128 128 / .1) 1px, transparent 1px);
background-size: 32px 32px;
```

Applied to `.root` (it shows through every transparent themed section) and to the hero card (P 35, 59).

### 4.11 Sketchbook fan (P 236, 350)

| i | `--y` (`abs(i) × 28px`) | `z-index` (`10 − abs(i)`) | inner background |
|---|---|---|---|
| -2 | 56px | 8 | `#E9E6DF` |
| -1 | 28px | 9 | `#DCD8CF` |
| 0 | 0px | 10 | `#E8492A33` |
| 1 | 28px | 9 | `#DCD8CF` |
| 2 | 56px | 8 | `#E9E6DF` |

Card: `background: #FBFAF7; border: 1.5px solid #16161A; border-radius: 18px; box-shadow: 0 24px 50px rgb(0 0 0 / .18)`;
inner `height: 100%; border-radius: 10px`. Placeholder "[Instagram post]" in Geist Mono 11px muted, padding 8px.
Copy (P 241): "New pieces every week, with process shots straight from Clip Studio."

### 4.12 Onigiri SVGs (P 39, 93)

- Logo, `viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-width="12" stroke-linejoin="round"`, 30×30:
  - `<path d="M100 22 C112 22 120 30 128 44 L176 128 C188 150 176 174 150 174 L50 174 C24 174 12 150 24 128 L72 44 C80 30 88 22 100 22 Z">`
  - `<path d="M74 174 L74 128 L126 128 L126 174 Z" fill="currentColor">`
- Drawing, `viewBox="0 0 200 200" fill="none" stroke="#FF6A47" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"`, every path `pathLength="1000"`:
  - the same outline path as the logo
  - `<path d="M74 174 L74 128 L126 128 L126 174">`
  - `<path d="M80 92 q6 -8 12 0 M108 92 q6 -8 12 0 M92 106 q8 8 16 0">`
- Menu icon (P 44), `viewBox="0 0 24 24"`, stroke-width 2, round caps, 20×20: `<path d="M4 7h16M4 12h16M4 17h10">`. **D:** the close state uses `<path d="M6 6l12 12M18 6L6 18">`.

---

## 5. Motion numbers

### 5.1 Hero intro on load (CSS, P 18–19, 62–75; D10)

`@keyframes up { from { opacity: 0; transform: translateY(40px) } to { opacity: 1; transform: none } }`, applied as
`animation: up .9s cubic-bezier(.2,.7,.2,1) forwards` with a starting `opacity: 0`, **under `no-preference` only**.

| Element | `animation-delay` |
|---|---|
| Note "hi, I'm Carls ↘" | .05s |
| h1 line 1 "I build tools" | .15s |
| h1 line 2 "teams *actually*" | .27s |
| h1 line 3 "use." | .39s |
| Portrait column | .4s |
| Paragraph | .55s |
| CTA row | .7s |

The h1 lines are `display: block` spans. Underline: `stroke-dasharray: 1000; stroke-dashoffset: 1000;` then
`@keyframes draw { from { stroke-dashoffset: 1000 } to { stroke-dashoffset: 0 } }`, `animation: draw 1.8s ease forwards`, `animation-delay: 1.1s`.

The note's `rotate(-3deg)` conflicts with the `up` keyframes' `transform`. Use the separate `rotate: -3deg` property for the tilt. Same rule (D19) for any `.in` element that's also tilted.

### 5.2 Marquee (CSS, P 18–19)

| Row | Keyframes | Duration | Direction |
|---|---|---|---|
| 1 "CODE BY DAY ✦ INK BY *night* ✦" | `mq: to { transform: translateX(-50%) }` | 28s linear infinite | leftward |
| 2 "NEXT.JS · NODE · MYSQL · DOCKER · CLIP STUDIO · " (outlined) | `mqr: from { transform: translateX(-50%) } to { transform: none }` | 32s linear infinite | rightward |

Rows are `display: flex; width: max-content; white-space: nowrap`, with 6 copies each. Under reduced motion they're static.

### 5.3 Hero shrink (scrub over the 1000px pin, `heroPinned`)

| Property | Start | End | Progress window |
|---|---|---|---|
| Card scale | 1 | **0.6** | 0 → 1 |
| Card rotation | 0deg | **-2deg** | 0 → 1 |
| Card corner radius (clip-path round) | 0px | **36px** | 0 → 1 |
| Shadow layer opacity (`0 50px 90px rgb(0 0 0)`) | 0 | **0.7** | 0 → 1 |
| Onigiri opacity | 0 | 1 | 0.50 → 0.55 |
| Onigiri stroke-dashoffset (pathLength 1000) | 1000 | 0 | 0.55 → 0.95 |

(B: "in the last ~45% of the pin". P 23: `opacity: clamp(0, (p − .5) × 20, 1)` and `dashoffset: (1 − clamp((p − .55)/.4)) × 1000`.)
The onigiri drawing is centered at `translate(-50%, -50%) rotate(-8deg)`.

### 5.4 Statement words (P 21, 312)

Per word: `opacity = 0.2 + 0.8 × p`, `p = clamp((0.78·vh − top) / (0.18·vh))`, i.e. from `"top 78%"` to `"top 60%"`.
The text is split on single spaces (P 334). "Then I go home and draw." is **one** span.

### 5.5 Work track (P 24, 301–305)

- Distance `tx = max(0, track.scrollWidth − window.innerWidth)`, only at ≥ 760px. Section height = `stage + tx`.
- Track `x: 0 → −tx`. Progress bar `scaleX: 0 → 1`, `transform-origin: left`, fill `#E8492A`, rail `#16161A22`, radius 3px.
- Card drift `y: 0 → s`, with s = −50, 40, −30, 50 px (B "±30–50px").
- Hover: `rotate: 0deg` and `box-shadow: 12px 14px 0 #16161A`, `transition: rotate .45s cubic-bezier(.2,.7,.2,1), box-shadow .45s` (P 28).

### 5.6 Split scene (scrub over the 1400px pin, P 25)

| Property | Start | End | Progress window |
|---|---|---|---|
| Left card x | −130% | 0 | 0 → 0.35 |
| Right card x | 130% | 0 | 0 → 0.35 |
| Overlay `clip-path: circle(R at 72% 50%)` | R = 0% | R = 150% | 0.50 → 0.92 |

### 5.7 Gallery parallax (P 21, 310)

`translateY = −p × s`, `p = clamp((center − vh/2) / vh, −1, 1)`, so y goes from −s to +s while the column center
travels from 1.5·vh to −0.5·vh. s = **+60px, −80px, +110px** (B and P agree).

### 5.8 Fan (P 26, 314, 350)

`p = clamp((0.6·vh − top) / (0.45·vh))`, i.e. section `"top 60%"` → `"top 15%"`. Per card, at p = 1:
`x = i × 140px` (70px below 760px, D17), `y = |i| × 28px`, `rotate = i × 9°`, for i = −2…2.

### 5.9 Contact rise (P 27, 311)

`p = clamp((vh − top) / (0.7·vh))`, i.e. `"top bottom"` → `"top 30%"`.
`clip-path: inset((1−p)·9% (1−p)·5% 0 (1−p)·5% round ((1−p)·56 + 40)px ((1−p)·56 + 40)px 0 0)`, so:
start `inset(9% 5% 0% 5% round 96px 96px 0px 0px)`, end `inset(0% 0% 0% 0% round 40px 40px 0px 0px)`.

### 5.10 Global rules

| Rule | Value | Source |
|---|---|---|
| Background/text theme tween | **0.9s**, triggered when a section crosses the viewport middle (`top 50%` / `bottom 50%`) | B; P 16, 321 |
| Heading reveal | inner line `translateY 110% → 0` behind `overflow: clip; display: block; padding-bottom: .08em`, `"top 95%"` → `"top 75%"` | B; P 20, 313 |
| Generic reveal | `opacity 0 → 1`, `translateY 56px → 0`, `"top bottom"` → `"top 70%"` | B; P 20, 315 |
| Button hover | `transform: translate(-3px, -3px); box-shadow: 5px 5px 0 currentColor; transition: transform .2s, box-shadow .2s` | B; P 29 |
| Card hover | straighten (`rotate: 0deg`) plus `12px 14px 0` shadow, .45s | B; P 28 |
| Art frame hover | `transform: scale(1.03); transition: transform .4s` | B; P 29 |
| Focus | `outline: 2px solid #E8492A; outline-offset: 3px` on `input:focus, textarea:focus, button:focus-visible, a:focus-visible` | P 31 |
| Smooth scroll | Lenis `lerp: 0.09` (the prototype's `0.09` per frame); wheel `deltaMode === 1` lines count 40px (Lenis handles this) | P 282, 288 |

---

## 6. Media queries (copy exactly; D8)

| Name | Query | Used by |
|---|---|---|
| `full` | `(min-width: 760px) and (prefers-reduced-motion: no-preference)` | track and split pinned layouts, gallery parallax |
| `mobile` | `(max-width: 759.98px) and (prefers-reduced-motion: no-preference)` | motion without pins |
| `reduce` | `(prefers-reduced-motion: reduce)` | static everything, no Lenis |
| `heroPinned` | `(min-width: 1024px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)` | hero pinned layout and shrink |
| narrow layout | `(max-width: 759.98px)` | header (links → menu button), gallery stagger off, fan 70px/180px, split static one column |
| hover caption | `(hover: none)` | portrait caption "tap me" variant |

The hero's static layout applies whenever `heroPinned` doesn't match (`not all and (…)` in CSS, or
default styles with the pinned layout inside the `heroPinned` query; the latter is simpler).
