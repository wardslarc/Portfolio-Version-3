import { featuredProjects, moreProjects } from "@/content/projects";
import { site } from "@/content/site";
import { getAllLivePostSummaries } from "@/lib/blog/public";

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export async function GET(): Promise<Response> {
  const posts = await getAllLivePostSummaries();

  const projectLines = [
    ...featuredProjects.map((project) =>
      project.href
        ? `- [${project.title}](${project.href}): ${oneLine(project.summary)}`
        : `- ${project.title}: ${oneLine(project.summary)}`,
    ),
    ...moreProjects.map((project) =>
      project.href
        ? `- [${project.title}](${project.href}): ${oneLine(project.description)}`
        : `- ${project.title}: ${oneLine(project.description)}`,
    ),
  ];

  const postLines =
    posts.length > 0
      ? posts.map((post) => {
          const url = `${site.url}/blog/${post.slug}`;
          const summary = oneLine(post.excerpt);
          return summary ? `- [${post.title}](${url}): ${summary}` : `- [${post.title}](${url})`;
        })
      : ["- No published posts yet."];

  const body = [
    `# ${site.name}`,
    "",
    `> ${site.description}`,
    "",
    `${site.role} at ${site.employer}. ${site.availability}. Contact: ${site.email}.`,
    "",
    "## Pages",
    "",
    `- [Home](${site.url}): Portfolio, featured projects, work experience, and contact details.`,
    `- [Blog](${site.url}/blog): Technical write-ups on the systems behind this site and tools built at work.`,
    `- [Resume](${site.url}${site.resume}): Downloadable PDF résumé.`,
    "",
    "## Projects",
    "",
    ...projectLines,
    "",
    "## Blog posts",
    "",
    ...postLines,
    "",
    "## Elsewhere",
    "",
    `- [GitHub](${site.socials.github})`,
    `- [LinkedIn](${site.socials.linkedin})`,
    `- [X](${site.socials.x})`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
