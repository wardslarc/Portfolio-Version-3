import type { CSSProperties } from "react";
import { sketchbook } from "@/content/home";
import { site } from "@/content/site";
import AssetImage from "./AssetImage";
import shellStyles from "./HomeShell.module.css";
import styles from "./Sketchbook.module.css";

export default function Sketchbook() {
  return (
    <section
      id="sketchbook"
      data-home-theme="paper"
      data-anim="fan-section"
      className={styles.section}
    >
      <h2 className={`${shellStyles.ln} ${styles.heading}`}>
        <span data-anim="heading-line">
          {sketchbook.heading}
          <span className={`${shellStyles.serif} ${styles.headingAccent}`}>
            {sketchbook.headingAccent}
          </span>
        </span>
      </h2>

      <div className={styles.stage}>
        {sketchbook.cards.map((card) => (
          <div
            key={card.i}
            data-anim="fan-card"
            data-i={card.i}
            className={styles.card}
            style={
              {
                "--i": card.i,
                "--y": card.y,
                "--z": card.z,
              } as CSSProperties
            }
          >
            <div className={`${styles.inner} ${styles[`tone_${card.tone}`]}`}>
              <AssetImage
                slot={card.asset}
                sizes="(max-width: 759px) 180px, 240px"
                className={styles.cardAsset}
              />
            </div>
          </div>
        ))}
      </div>

      <p className={styles.copy}>{sketchbook.copy}</p>

      <a
        href={site.socials.instagram}
        target="_blank"
        rel="noopener noreferrer"
        className={`${shellStyles.btn} ${styles.igBtn}`}
      >
        {sketchbook.button}
      </a>
    </section>
  );
}
