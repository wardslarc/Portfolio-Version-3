import { experienceAccent, experienceHeading } from "@/content/home";
import { education, jobs } from "@/content/experience";
import shellStyles from "../HomeShell.module.css";
import styles from "./MoreWork.module.css";

export default function ExperienceStrip() {
  const entries = [...jobs.slice(0, 3), education];

  return (
    <div id="experience" className={styles.expWrap}>
      <h3 className={`${shellStyles.ln} ${styles.subHeading}`}>
        <span data-anim="heading-line">
          {experienceHeading}
          <span className={`${shellStyles.serif} ${styles.headingAccent}`}>
            {experienceAccent}
          </span>
        </span>
      </h3>

      <div className={styles.expStrip} data-anim="reveal">
        {entries.map((item) => (
          <div key={`${item.when}-${item.org}`} className={styles.expCell}>
            <p className={`${shellStyles.mono} ${styles.expWhen}`}>{item.when}</p>
            <p className={styles.expRole}>{item.title}</p>
            <p className={styles.expOrg}>{item.org}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
