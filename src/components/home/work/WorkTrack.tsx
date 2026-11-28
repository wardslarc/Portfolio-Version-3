import type { CSSProperties } from "react";
import TrackedLink from "@/components/TrackedLink";
import { work } from "@/content/home";
import { featuredProjects, moreProjects } from "@/content/projects";
import { slugifyProject } from "@/lib/analytics";
import AssetImage from "../AssetImage";
import shellStyles from "../HomeShell.module.css";
import styles from "./WorkTrack.module.css";

export default function WorkTrack() {
  const byTitle = new Map(featuredProjects.map((p) => [p.title, p]));

  return (
    <section
      id="work"
      data-home-theme="sand"
      data-anim="track-section"
      className={styles.section}
    >
      <div data-anim="track-stage" className={styles.stage}>
        <div data-anim="track" className={styles.track}>
          <div className={styles.intro}>
            <p className={`${shellStyles.mono} ${styles.label}`}>{work.label}</p>
            <h2 className={styles.heading}>
              {work.heading}
              <span className={`${shellStyles.serif} ${styles.headingAccent}`}>
                {work.headingAccent}
              </span>
            </h2>
            <p className={styles.introCopy}>{work.intro}</p>
            <p className={`${shellStyles.note} ${styles.keepScrolling}`}>
              {work.note}
            </p>
          </div>

          {work.cards.map((card) => {
            const project = byTitle.get(card.title);
            const stack = project ? project.tags.join(" · ") : "";

            return (
              <article
                key={card.title}
                data-anim="track-drift"
                data-drift={card.drift}
                className={styles.card}
                style={{ "--rotate": card.rotate } as CSSProperties}
              >
                {card.tape ? (
                  <div
                    className={styles.tape}
                    style={{
                      top: card.tape.top,
                      left: card.tape.left,
                      right: card.tape.right,
                      rotate: card.tape.rotate,
                    }}
                    aria-hidden="true"
                  />
                ) : null}

                {card.note ? (
                  <div
                    className={`${shellStyles.note} ${styles.cardNote}`}
                    style={
                      {
                        "--note-top": card.note.top,
                        ...(card.note.narrowTop
                          ? { "--note-top-narrow": card.note.narrowTop }
                          : {}),
                        left: card.note.left,
                        right: card.note.right,
                        rotate: card.note.rotate,
                        fontSize: card.note.fontSize,
                      } as CSSProperties
                    }
                    aria-hidden="true"
                  >
                    {card.note.text}
                  </div>
                ) : null}

                <div className={styles.shot}>
                  <AssetImage
                    slot={card.asset}
                    sizes="(max-width: 759px) 90vw, 468px"
                  />
                </div>

                <div className={styles.cardBody}>
                  <div className={`${shellStyles.mono} ${styles.cardMeta}`}>
                    <span>{card.kicker}</span>
                    <span className={styles[`status_${card.statusTone}`]}>
                      {card.status}
                    </span>
                  </div>

                  <h3 className={styles.cardTitle}>
                    {project?.href ? (
                      <TrackedLink
                        href={project.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        event="project_link"
                        eventData={{ project: slugifyProject(project.title) }}
                        className={styles.cardLink}
                      >
                        {card.displayTitle} ↗
                      </TrackedLink>
                    ) : (
                      card.displayTitle
                    )}
                  </h3>

                  <p className={styles.cardDesc}>{card.description}</p>
                  <p className={`${shellStyles.mono} ${styles.cardStack}`}>
                    {stack}
                  </p>
                </div>
              </article>
            );
          })}

          <div className={styles.endPanel}>
            <p className={styles.endText}>
              + {moreProjects.length} more projects{" "}
              <span className={`${shellStyles.serif} ${styles.endAccent}`}>
                below ↓
              </span>
            </p>
          </div>
        </div>

        <div className={styles.rail} aria-hidden="true">
          <div data-anim="track-bar" className={styles.bar} />
        </div>
      </div>
    </section>
  );
}
