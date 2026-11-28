import { statement } from "@/content/home";
import shellStyles from "./HomeShell.module.css";
import styles from "./Statement.module.css";

export default function Statement() {
  const words = statement.body.split(" ");

  return (
    <section id="about" data-home-theme="paper" className={styles.section}>
      <p className={styles.paragraph}>
        {words.map((word, index) => (
          <span key={index} data-anim="word">
            {word}{" "}
          </span>
        ))}
        <span data-anim="word" className={`${shellStyles.serif} ${styles.closing}`}>
          {statement.closing}
        </span>
      </p>
    </section>
  );
}
