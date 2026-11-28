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
  deskPhoto: {
    src: "/images/desk.jpg",
    alt: "Carls's desk at night: a laptop and a monitor full of code",
    label: "[Photo: you at your desk / code on screen]",
    width: 1205,
    height: 1600,
  },
  favoriteDrawing: {
    src: "/images/favorite-drawing.jpg",
    alt: "Painted stack of pancakes with butter and syrup on a gold-rimmed plate",
    label: "[Your favorite drawing]",
    width: 1440,
    height: 1440,
  },
  workRmk: {
    src: "/images/work/rmk-learning-hub.jpg",
    alt: "RMK Learning Hub: the My learning paths page with stages and courses",
    label: "[Screenshot: RMK Learning Hub]",
    width: 1600,
    height: 794,
  },
  workBilyo: {
    src: "/images/work/bilyo.jpg",
    alt: "Bilyo landing page: \"Send a quotation. Get a clear yes or no.\" beside a sample quote",
    label: "[Screenshot: Bilyo]",
    width: 1600,
    height: 800,
  },
  workRelato: {
    src: "/images/work/relato.jpg",
    alt: "Relato - AI Resume Builder on the Google Play Store",
    label: "[Screenshot: Relato on a phone]",
    width: 1600,
    height: 792,
  },
  art01: {
    src: "/images/art/art-01.jpg",
    alt: "Painted portrait study of a blonde woman in a floral top, with the reference photo",
    label: "[Drawing from @daleonigiri]",
    width: 900,
    height: 895,
  },
  art02: {
    src: "/images/art/art-02.jpg",
    alt: "Painting of an old wood-panelled television set",
    label: "[Drawing from @daleonigiri]",
    width: 895,
    height: 889,
  },
  art03: {
    src: "/images/art/art-03.jpg",
    alt: "Colour study of a purple-haired girl in a white sweater",
    label: "[Drawing from @daleonigiri]",
    width: 868,
    height: 901,
  },
  art04: {
    src: "/images/art/art-04.jpg",
    alt: "Pink-haired girl with an electric guitar, full figure",
    label: "[Drawing from @daleonigiri]",
    width: 895,
    height: 891,
  },
  art05: {
    src: "/images/art/art-05.jpg",
    alt: "Two characters mid-painting in Clip Studio Paint, with the app's panels visible",
    label: "[Drawing from @daleonigiri]",
    width: 895,
    height: 887,
  },
  art06: {
    src: "/images/art/art-06.jpg",
    alt: "Pencil sketch of a kneeling girl, with the reference image",
    label: "[Drawing from @daleonigiri]",
    width: 893,
    height: 896,
  },
  art07: {
    src: "/images/art/art-07.jpg",
    alt: "Fan art crowd of anime girls surrounded by cartoon cats",
    label: "[Drawing from @daleonigiri]",
    width: 902,
    height: 894,
  },
  art08: {
    src: "/images/art/art-08.jpg",
    alt: "Girl with black and red hair smoking against a blue background",
    label: "[Drawing from @daleonigiri]",
    width: 882,
    height: 891,
  },
  art09: {
    src: "/images/art/art-09.jpg",
    alt: "Portrait of a woman with wavy brown hair",
    label: "[Drawing from @daleonigiri]",
    width: 892,
    height: 891,
  },
  post1: {
    src: "/images/sketchbook/post-1.jpg",
    alt: "Painted selfie-style portrait of a smiling woman in glasses holding a penguin plush",
    label: "[Instagram post]",
    width: 899,
    height: 897,
  },
  post2: {
    src: "/images/sketchbook/post-2.jpg",
    alt: "Collage of doodles: a portrait in glasses, a scooter, a dog and a crocodile",
    label: "[Instagram post]",
    width: 900,
    height: 899,
  },
  post3: {
    src: "/images/sketchbook/post-3.jpg",
    alt: "Two anime girls, one in a maid outfit, beside a pencil sketch",
    label: "[Instagram post]",
    width: 896,
    height: 894,
  },
  post4: {
    src: "/images/sketchbook/post-4.jpg",
    alt: "Pencil sketch of a horned girl, with the reference image",
    label: "[Instagram post]",
    width: 898,
    height: 896,
  },
  post5: {
    src: "/images/sketchbook/post-5.jpg",
    alt: "Fan art crowd of anime girls surrounded by cartoon cats",
    label: "[Instagram post]",
    width: 902,
    height: 894,
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
    narrowTop?: string;
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
      tape: { top: "calc(-0.875 * var(--u))", left: "calc(2.5 * var(--u))", rotate: "-4deg" },
      note: {
        text: "built from scratch!",
        top: "36%",
        narrowTop: "calc(3.5 * var(--u))",
        right: "calc(-1.25 * var(--u))",
        rotate: "8deg",
        fontSize: "calc(1.75 * var(--u))",
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
      tape: { top: "calc(-0.875 * var(--u))", right: "calc(3.125 * var(--u))", rotate: "5deg" },
      note: {
        text: "my own product ✎",
        top: "45%",
        narrowTop: "calc(3.5 * var(--u))",
        left: "calc(-1.5 * var(--u))",
        rotate: "-7deg",
        fontSize: "calc(1.75 * var(--u))",
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
        { aspect: "4 / 5", caption: "portrait study", year: "2023", asset: assets.art01 },
        { aspect: "1 / 1", caption: "still life", year: "2023", asset: assets.art02 },
        { aspect: "3 / 4", caption: "color study", year: "2026", asset: assets.art03 },
      ],
    },
    {
      speed: -80,
      marginTop: "calc(7.5 * var(--u))",
      items: [
        { aspect: "3 / 4", caption: "character piece", year: "2023", asset: assets.art04 },
        { aspect: "4 / 5", caption: "process shot", year: "2026", asset: assets.art05 },
        { aspect: "1 / 1", caption: "quick sketch", year: "2026", asset: assets.art06 },
      ],
    },
    {
      speed: 110,
      marginTop: "calc(2.5 * var(--u))",
      items: [
        { aspect: "1 / 1", caption: "fan art", year: "2026", asset: assets.art07 },
        { aspect: "3 / 4", caption: "after hours", year: "2023", asset: assets.art08 },
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
    { i: -2, y: "calc(3.5 * var(--u))", z: 8, tone: "placeholder", asset: assets.post1 },
    { i: -1, y: "calc(1.75 * var(--u))", z: 9, tone: "placeholder2", asset: assets.post2 },
    { i: 0, y: "0px", z: 10, tone: "mid", asset: assets.post3 },
    { i: 1, y: "calc(1.75 * var(--u))", z: 9, tone: "placeholder2", asset: assets.post4 },
    { i: 2, y: "calc(3.5 * var(--u))", z: 8, tone: "placeholder", asset: assets.post5 },
  ] satisfies FanCardConfig[],
} as const;

export const contact = {
  heading: ["Let's build", "something."] as const,
  copy: "Freelance builds, internal tools, or a full-time role. Tell me what you're working on and I'll reply by email.",
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
