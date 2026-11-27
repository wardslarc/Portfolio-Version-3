export interface AssetSlot {
  src: string | null;
  alt: string;
  label: string;
  width?: number;
  height?: number;
}

export const assets = {
  portraitPhoto: {
    src: "/carls-dale-escalo-portrait.jpg",
    alt: "Carls Dale Escalo in graduation attire, University of Makati",
    label: "[Your photo goes here]",
    width: 768,
    height: 960,
  },
  portraitSketch: {
    src: null,
    alt: "Line structure sketch of Carls Dale Escalo",
    label: "[Portrait sketch]",
  },
  signature: {
    src: null,
    alt: "Handwritten signature of Carls",
    label: "[your real signature]",
  },
  deskPhoto: {
    src: null,
    alt: "Carls at his desk with code on screen",
    label: "[Photo: you at your desk / code on screen]",
  },
  favoriteDrawing: {
    src: null,
    alt: "Favorite drawing by Carls",
    label: "[Your favorite drawing]",
  },
  workRmk: {
    src: null,
    alt: "RMK Learning Hub screenshot",
    label: "[Screenshot: RMK Learning Hub]",
  },
  workBilyo: {
    src: null,
    alt: "Bilyo screenshot",
    label: "[Screenshot: Bilyo]",
  },
  workRelato: {
    src: null,
    alt: "Relato on a phone screenshot",
    label: "[Screenshot: Relato on a phone]",
  },
  workTicketing: {
    src: null,
    alt: "IT Ticketing System dashboard screenshot",
    label: "[Screenshot: Ticketing dashboard]",
  },
  art01: {
    src: null,
    alt: "Portrait study drawing from @daleonigiri",
    label: "[Drawing from @daleonigiri]",
  },
  art02: {
    src: null,
    alt: "Sketch to final drawing from @daleonigiri",
    label: "[Drawing from @daleonigiri]",
  },
  art03: {
    src: null,
    alt: "Color study drawing from @daleonigiri",
    label: "[Drawing from @daleonigiri]",
  },
  art04: {
    src: null,
    alt: "Character piece drawing from @daleonigiri",
    label: "[Drawing from @daleonigiri]",
  },
  art05: {
    src: null,
    alt: "Process shot drawing from @daleonigiri",
    label: "[Drawing from @daleonigiri]",
  },
  art06: {
    src: null,
    alt: "Quick sketch drawing from @daleonigiri",
    label: "[Drawing from @daleonigiri]",
  },
  art07: {
    src: null,
    alt: "Fan art drawing from @daleonigiri",
    label: "[Drawing from @daleonigiri]",
  },
  art08: {
    src: null,
    alt: "This week drawing from @daleonigiri",
    label: "[Drawing from @daleonigiri]",
  },
  art09: {
    src: null,
    alt: "Portrait drawing from @daleonigiri",
    label: "[Drawing from @daleonigiri]",
  },
  post1: {
    src: null,
    alt: "Instagram post 1 from @daleonigiri",
    label: "[Instagram post]",
  },
  post2: {
    src: null,
    alt: "Instagram post 2 from @daleonigiri",
    label: "[Instagram post]",
  },
  post3: {
    src: null,
    alt: "Instagram post 3 from @daleonigiri",
    label: "[Instagram post]",
  },
  post4: {
    src: null,
    alt: "Instagram post 4 from @daleonigiri",
    label: "[Instagram post]",
  },
  post5: {
    src: null,
    alt: "Instagram post 5 from @daleonigiri",
    label: "[Instagram post]",
  },
} satisfies Record<string, AssetSlot>;

export const hero = {
  note: "hi, I'm Carls ↘",
  lines: ["I build tools", "teams ", "use."] as const,
  accentWord: "actually",
  paragraph:
    "Full-stack & systems developer in Makati, Philippines. By day I ship internal platforms, SaaS and Android apps. By night I draw.",
  ctaWork: "See the work ↓",
  ctaResume: "Résumé (PDF)",
  ctaInstagram: "@daleonigiri ✎",
  caption: "↑ hover me — there's a sketch underneath",
  captionTouch: "↑ tap me — there's a sketch underneath",
  sketchNotes: ["brow line", "it's all structure."] as const,
  portraitAlt: "Carls Dale Escalo in graduation attire, University of Makati",
} as const;

export const marquee = {
  repeats: 6,
  row2: "NEXT.JS · NODE · MYSQL · DOCKER · CLIP STUDIO · ",
} as const;

export const statement = {
  body: "I like owning a project end to end — from the first conversation with the people who'll use it, to the database, the interface, and the server it runs on.",
  closing: "Then I go home and draw.",
} as const;

export interface WorkCardConfig {
  title: string;
  displayTitle: string;
  kicker: string;
  status: string;
  statusTone: "green" | "coral" | "muted";
  description: string;
  rotate: string;
  drift: number;
  tape: {
    top: string;
    left?: string;
    right?: string;
    rotate: string;
  } | null;
  note: {
    text: string;
    top: string;
    left?: string;
    right?: string;
    rotate: string;
    fontSize: string;
  } | null;
  asset: AssetSlot;
}

export const work = {
  label: "01 / SELECTED WORK",
  heading: "On the ",
  headingAccent: "clock.",
  intro:
    "Things running in production right now, built end to end, from the database to the server.",
  note: "keep scrolling →",
  cards: [
    {
      title: "RMK Learning Hub",
      displayTitle: "RMK Learning Hub",
      kicker: "01 — Rustan Marketing",
      status: "● in production",
      statusTone: "green",
      description:
        "The company LMS for assigned courses and progress tracking. Built from the ground up, used across the organization.",
      rotate: "-1.5deg",
      drift: -50,
      tape: { top: "-14px", left: "40px", rotate: "-4deg" },
      note: {
        text: "built from scratch!",
        top: "36%",
        right: "-20px",
        rotate: "8deg",
        fontSize: "28px",
      },
      asset: assets.workRmk,
    },
    {
      title: "Bilyo",
      displayTitle: "Bilyo",
      kicker: "02 — Personal SaaS",
      status: "● live beta",
      statusTone: "coral",
      description:
        "Quotation maker for Filipino freelancers: one-tap client acceptance, PDF export, multi-currency, view tracking.",
      rotate: "1.2deg",
      drift: 40,
      tape: { top: "-14px", right: "50px", rotate: "5deg" },
      note: {
        text: "my own product ✎",
        top: "45%",
        left: "-24px",
        rotate: "-7deg",
        fontSize: "28px",
      },
      asset: assets.workBilyo,
    },
    {
      title: "Relato - AI Resume Builder",
      displayTitle: "Relato",
      kicker: "03 — Android",
      status: "● on Google Play",
      statusTone: "green",
      description:
        "AI resume builder for Android. Designed, built and published to the Play Store myself.",
      rotate: "-1deg",
      drift: -30,
      tape: null,
      note: null,
      asset: assets.workRelato,
    },
    {
      title: "IT Ticketing System",
      displayTitle: "IT Ticketing System",
      kicker: "04 — Citimax Group",
      status: "● internal",
      statusTone: "muted",
      description:
        "Affiliates file and track tickets in one place, wired to the Google Sheets API so task logs update themselves.",
      rotate: "1.5deg",
      drift: 50,
      tape: null,
      note: {
        text: "no more manual logs",
        top: "-22px",
        right: "-16px",
        rotate: "6deg",
        fontSize: "26px",
      },
      asset: assets.workTicketing,
    },
  ] satisfies WorkCardConfig[],
} as const;

export const moreRows: Record<string, { stack: string; kind: string }> = {
  "Employee Onboarding LMS": { stack: "React · TypeScript · Firebase", kind: "Internal" },
  "Hardrock Aggregates": { stack: "React · TypeScript · Vite", kind: "Live site" },
  "Citimax Group website": { stack: "HTML · CSS · JS", kind: "Live site" },
  "Lifecore Bio-Integrative": { stack: "React · TypeScript · Firebase", kind: "Live site" },
  "Library Seat Monitor": { stack: "PHP · MySQL · JS", kind: "Internship" },
  "Marci Metzger Homes": { stack: "React · TypeScript · Firebase", kind: "Freelance" },
  "Sticky White Board": { stack: "React · Firebase", kind: "Side project" },
  "Reflective Pomodoro": { stack: "MERN", kind: "Side project" },
};

export const experienceHeading = "Where I've ";
export const experienceAccent = "built.";

export const split = {
  left: "On the",
  right: "Off the",
  word: "CLOCK",
  noteLeft: "↑ that was the day job",
  noteRight: "↓ here's the night shift",
  overlay: ["Ink by", "night."] as const,
} as const;

export interface GalleryItem {
  aspect: string;
  caption: string;
  year: string;
  asset: AssetSlot;
}

export interface GalleryColumn {
  speed: number;
  marginTop: string;
  items: GalleryItem[];
}

export const night = {
  heading: "Hall of ",
  headingAccent: "sketches.",
  blurb: {
    before: "Portraits and characters, painted in Clip Studio Paint and posted as ",
    linkText: "@daleonigiri",
    after: ". Same habit as coding: one finished piece at a time.",
  },
  columns: [
    {
      speed: 60,
      marginTop: "0px",
      items: [
        { aspect: "4 / 5", caption: "portrait study", year: "2026", asset: assets.art01 },
        { aspect: "1 / 1", caption: "sketch → final", year: "2026", asset: assets.art02 },
        { aspect: "3 / 4", caption: "color study", year: "2026", asset: assets.art03 },
      ],
    },
    {
      speed: -80,
      marginTop: "120px",
      items: [
        { aspect: "3 / 4", caption: "character piece", year: "2026", asset: assets.art04 },
        { aspect: "4 / 5", caption: "process shot", year: "2026", asset: assets.art05 },
        { aspect: "1 / 1", caption: "quick sketch", year: "2026", asset: assets.art06 },
      ],
    },
    {
      speed: 110,
      marginTop: "40px",
      items: [
        { aspect: "1 / 1", caption: "fan art", year: "2026", asset: assets.art07 },
        { aspect: "3 / 4", caption: "this week", year: "2026", asset: assets.art08 },
        { aspect: "4 / 5", caption: "portrait", year: "2026", asset: assets.art09 },
      ],
    },
  ] satisfies GalleryColumn[],
  chessNote: "one move per day, one shared game",
} as const;

export interface FanCardConfig {
  i: number;
  y: string;
  z: number;
  tone: "placeholder" | "placeholder2" | "mid";
  asset: AssetSlot;
}

export const sketchbook = {
  heading: "Follow the ",
  headingAccent: "sketchbook.",
  copy: "New pieces every week, with process shots straight from Clip Studio.",
  button: "@daleonigiri on Instagram ↗",
  cards: [
    { i: -2, y: "56px", z: 8, tone: "placeholder", asset: assets.post1 },
    { i: -1, y: "28px", z: 9, tone: "placeholder2", asset: assets.post2 },
    { i: 0, y: "0px", z: 10, tone: "mid", asset: assets.post3 },
    { i: 1, y: "28px", z: 9, tone: "placeholder2", asset: assets.post4 },
    { i: 2, y: "56px", z: 8, tone: "placeholder", asset: assets.post5 },
  ] satisfies FanCardConfig[],
} as const;

export const contact = {
  heading: ["Let's build", "something."] as const,
  copy: "Freelance builds, internal tools, or a full-time role. Tell me what you're working on and I'll reply by email.",
  signature: "— Carls",
  signatureNote: "[your real signature]",
  labels: {
    name: "Name",
    email: "Email",
    message: "What are you building, and when?",
  },
  submit: "Send it →",
  footerRight: "Coded in Next.js · drawn in Clip Studio",
  footerPlace: "Makati, PH",
} as const;

export const nav = {
  links: [
    { href: "#work", label: "On the clock" },
    { href: "#night", label: "Off the clock" },
    { href: "/blog", label: "Blog" },
  ],
  cta: { href: "#contact", label: "Let's talk" },
} as const;
