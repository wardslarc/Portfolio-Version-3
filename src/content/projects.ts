export type ProjectStatus = "live" | "internal" | "personal";

export interface FeaturedProject {
  title: string;
  badge: string;
  status: ProjectStatus;
  summary: string;
  impact: string;
  tags: string[];
  href?: string;
}

export interface MoreProject {
  title: string;
  badge: string;
  live?: boolean;
  description: string;
  href?: string;
}

export const featuredProjects: FeaturedProject[] = [
  {
    title: "RMK Learning Hub",
    badge: "In production · Rustan Marketing",
    status: "live",
    summary:
      "The company's learning management system, where employees take assigned courses and track their progress.",
    impact:
      "I built it from the ground up, and it's now deployed in production and used across the organization.",
    tags: ["Next.js", "Node.js", "TypeScript", "MySQL", "Docker", "Nginx"],
  },
  {
    title: "Bilyo",
    badge: "Live beta · Personal",
    status: "live",
    summary:
      "An online quotation maker for freelancers and service businesses in the Philippines.",
    impact:
      "Clients open a private link and accept or decline in one tap, with PDF export, multi-currency quotes and a dashboard that tracks views and decisions.",
    tags: ["Next.js", "Node.js", "MongoDB", "Vercel", "Resend"],
    href: "https://bilyoapp.com/",
  },
  {
    title: "Relato - AI Resume Builder",
    badge: "Google Play · Personal",
    status: "live",
    // TODO: replace with the real feature description and stack from the Play listing.
    summary: "An Android app that helps job seekers write and format a resume with AI.",
    impact: "I built and published it to the Google Play Store myself.",
    tags: ["Android", "AI", "Google Play"],
    href: "https://play.google.com/store/apps/details?id=com.escalo.resumo",
  },
];

export const moreProjects: MoreProject[] = [
  {
    title: "Employee Onboarding LMS",
    badge: "Internal",
    description:
      "Citimax HR assigns onboarding modules and checklists to new hires. React, TypeScript, Firebase.",
  },
  {
    title: "Hardrock Aggregates",
    badge: "Live",
    live: true,
    description: "Company profile site for an aggregates supplier. React, TypeScript, Vite.",
    href: "https://hardrock-frontend.vercel.app/",
  },
  {
    title: "Citimax Group website",
    badge: "Live",
    live: true,
    description: "Corporate website. HTML, CSS, JavaScript.",
    href: "https://citimax.ph/",
  },
  {
    title: "Lifecore Bio-Integrative",
    badge: "Live",
    live: true,
    description: "Services and products site, deployed on Vercel. React, TypeScript, Firebase.",
  },
  {
    title: "Library Seat Monitor",
    badge: "Internship",
    description: "Shows library seat availability in real time. PHP, MySQL, JavaScript.",
  },
  {
    title: "Marci Metzger Homes",
    badge: "Freelance",
    description: "Website for an independent real estate agent. React, TypeScript, Firebase.",
  },
  {
    title: "Sticky White Board",
    badge: "Side project",
    description: "Real-time collaborative whiteboard with sticky notes. React, Firebase.",
    href: "https://sticky-white-board.vercel.app/",
  },
  {
    title: "Reflective Pomodoro",
    badge: "Side project",
    description:
      "Focus timer that prompts a short reflection after each session. MongoDB, Express, React, Node.js.",
  },
];
