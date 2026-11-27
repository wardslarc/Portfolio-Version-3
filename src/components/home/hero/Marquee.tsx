import { marquee } from "@/content/home";
import shellStyles from "../HomeShell.module.css";
import styles from "./Hero.module.css";

export default function Marquee() {
  const items = Array.from({ length: marquee.repeats }, (_, i) => i);

  return (
    <div className={styles.marquee} aria-hidden="true">
      <div className={`${styles.mqRow} ${styles.mqLeft}`}>
        {items.map((i) => (
          <span key={i} className={styles.mqItem}>
            CODE BY DAY <span className={styles.mqStar}>✦</span> INK BY{" "}
            <span className={shellStyles.serif}>night</span>{" "}
            <span className={styles.mqStar}>✦</span>
          </span>
        ))}
      </div>
      <div className={`${styles.mqRow} ${styles.mqRight} ${styles.mqOutline}`}>
        {items.map((i) => (
          <span key={i} className={styles.mqItem}>
            {marquee.row2}
          </span>
        ))}
      </div>
    </div>
  );
}
