import { education, jobs, skills } from "@/content/experience";

export function Experience() {
  return (
    <section id="experience" aria-labelledby="exp-h">
      <h2 className="section-label" id="exp-h">
        Experience
      </h2>
      <ol className="jobs" reversed>
        {jobs.map((job) => (
          <li className="job" key={`${job.org}-${job.title}`}>
            <span className="when mono">{job.when}</span>
            <div>
              <h3>{job.title}</h3>
              <p className="org">{job.org}</p>
              <ul>
                {job.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <div className="tags">
                {job.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ol>
      <div className="job edu">
        <span className="when mono">{education.when}</span>
        <div>
          <h3>{education.title}</h3>
          <p className="org">{education.org}</p>
        </div>
      </div>
    </section>
  );
}

export function Skills() {
  return (
    <section id="skills" aria-labelledby="skills-h">
      <h2 className="section-label" id="skills-h">
        Skills
      </h2>
      <dl className="skills">
        {skills.map((s) => (
          <div key={s.group}>
            <dt className="mono">{s.group}</dt>
            <dd>{s.items}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
