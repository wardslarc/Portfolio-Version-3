export interface Job {
  when: string;
  title: string;
  org: string;
  points: string[];
  tags: string[];
}

export const jobs: Job[] = [
  {
    when: "2026 — Now",
    title: "Systems Developer",
    org: "Rustan Marketing Corporation",
    points: [
      "Lead development of internal tools and company websites.",
      "Built and launched RMK Learning Hub, the company LMS now in production and used across the organization.",
    ],
    tags: ["Next.js", "Node.js", "TypeScript", "MySQL", "Docker", "GCP"],
  },
  {
    when: "2023 — 2025",
    title: "IT Staff / Web Developer",
    org: "Citimax Group Inc.",
    points: [
      "Built the group's ticketing system, onboarding LMS and several other internal apps.",
      "Handled domains, Cloudflare DNS and Vercel deployments for company sites.",
    ],
    tags: ["React", "TypeScript", "Firebase", "Vercel", "Cloudflare"],
  },
  {
    when: "2023",
    title: "Web Developer Intern",
    org: "Business Machine Corporation",
    points: [
      "Built a real-time library seat monitoring system.",
      "Improved responsiveness on an e-commerce prototype.",
    ],
    tags: ["PHP", "MySQL", "JavaScript"],
  },
];

export const education = {
  when: "2019 — 2023",
  title: "BS Computer Science, Social Computing",
  org: "University of Makati",
};

export const skills: { group: string; items: string }[] = [
  { group: "Frontend", items: "Next.js, React, TypeScript, Tailwind CSS, Electron" },
  { group: "Backend", items: "Node.js, Express, Python, REST APIs" },
  { group: "Data", items: "MongoDB, MySQL, Firebase" },
  { group: "Infrastructure", items: "Vercel, Cloudflare, Docker, Nginx, Google Cloud" },
];
