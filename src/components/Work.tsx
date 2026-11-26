import { featuredProjects, moreProjects, type FeaturedProject } from "@/content/projects";
import { slugifyProject } from "@/lib/analytics";
import { ChevronIcon } from "./Icons";
import TrackedLink from "./TrackedLink";

function CardBody({ project }: { project: FeaturedProject }) {
  return (
    <>
      <div className="card-top">
        <h3>
          {project.title}
          {project.href ? (
            <span className="arrow" aria-hidden="true">
              ↗
            </span>
          ) : null}
        </h3>
        <span className={`badge${project.status === "live" ? " live" : ""}`}>{project.badge}</span>
      </div>
      <p>
        {project.summary} <span className="impact">{project.impact}</span>
      </p>
      <div className="tags">
        {project.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
    </>
  );
}

export default function Work() {
  return (
    <section id="work" aria-labelledby="work-h">
      <h2 className="section-label" id="work-h">
        Selected work
      </h2>
      <div className="featured">
        {featuredProjects.map((project) =>
          project.href ? (
            <TrackedLink
              key={project.title}
              className="card"
              href={project.href}
              target="_blank"
              rel="noopener noreferrer"
              event="project_link"
              eventData={{ project: slugifyProject(project.title) }}
            >
              <CardBody project={project} />
            </TrackedLink>
          ) : (
            <article key={project.title} className="card">
              <CardBody project={project} />
            </article>
          ),
        )}
      </div>

      <details className="more">
        <summary>
          <span className="when-closed">Show {moreProjects.length} more projects</span>
          <span className="when-open">Show fewer projects</span>
          <ChevronIcon />
        </summary>
        <ul className="rows">
          {moreProjects.map((project) => (
            <li key={project.title}>
              <span className="t">
                {project.href ? (
                  <TrackedLink
                    href={project.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    event="project_link"
                    eventData={{ project: slugifyProject(project.title) }}
                  >
                    {project.title} ↗
                  </TrackedLink>
                ) : (
                  project.title
                )}
              </span>
              <span className={`badge${project.live ? " live" : ""}`}>{project.badge}</span>
              <span className="d">{project.description}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
