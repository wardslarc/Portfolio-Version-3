"use client";

import { useState } from "react";
import TrackedLink from "@/components/TrackedLink";
import { moreRows } from "@/content/home";
import { moreProjects } from "@/content/projects";
import { slugifyProject } from "@/lib/analytics";
import shellStyles from "../HomeShell.module.css";
import styles from "./MoreWork.module.css";

const INITIAL_COUNT = 3;

export default function MoreWork() {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? moreProjects : moreProjects.slice(0, INITIAL_COUNT);
  const hiddenCount = moreProjects.length - INITIAL_COUNT;

  return (
    <div data-anim="reveal">
      <ul id="more-projects-list" className={styles.list} data-refresh-on-resize>
        {visible.map((project) => {
          const meta = moreRows[project.title];
          return (
            <li key={project.title} className={styles.row}>
              <span className={styles.rowTitle}>
                {project.href ? (
                  <TrackedLink
                    href={project.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    event="project_link"
                    eventData={{ project: slugifyProject(project.title) }}
                    className={styles.rowLink}
                  >
                    {project.title} ↗
                  </TrackedLink>
                ) : (
                  project.title
                )}
              </span>
              <span className={`${shellStyles.mono} ${styles.rowMeta}`}>
                {meta.stack} · {meta.kind}
              </span>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className={`${shellStyles.btn} ${styles.secondaryBtn}`}
        aria-expanded={expanded}
        aria-controls="more-projects-list"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? "Show fewer ↑" : `Show ${hiddenCount} more projects ↓`}
      </button>
    </div>
  );
}
