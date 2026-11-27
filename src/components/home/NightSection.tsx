import type { CSSProperties } from "react";
import { night } from "@/content/home";
import { site } from "@/content/site";
import AssetImage from "./AssetImage";
import shellStyles from "./HomeShell.module.css";
import styles from "./NightSection.module.css";

export default function NightSection() {
  return (
    <section id="night" data-home-theme="dark" className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.headRow}>
          <h2 className={`${shellStyles.ln} ${styles.heading}`}>
            <span data-anim="heading-line">
              {night.heading}
              <span className={`${shellStyles.serif} ${styles.headingAccent}`}>
                {night.headingAccent}
              </span>
            </span>
          </h2>

          <p className={styles.blurb} data-anim="reveal">
            {night.blurb.before}
            <a
              href={site.socials.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.blurbLink}
            >
              {night.blurb.linkText}
            </a>
            {night.blurb.after}
          </p>
        </div>

        <div className={styles.gallery}>
          {night.columns.map((col, colIndex) => (
            <div
              key={colIndex}
              data-anim="parallax-col"
              data-speed={col.speed}
              className={styles.col}
              style={{ "--col-offset": col.marginTop } as CSSProperties}
            >
              {col.items.map((item) => (
                <figure key={item.asset.alt} className={styles.frame}>
                  <div
                    className={styles.artImage}
                    style={{ aspectRatio: item.aspect }}
                  >
                    <AssetImage
                      slot={item.asset}
                      sizes="(max-width: 759px) 90vw, 400px"
                      className={styles.artAsset}
                    />
                  </div>
                  <figcaption className={`${shellStyles.mono} ${styles.caption}`}>
                    <span>{item.caption}</span>
                    <span className={styles.year}>{item.year}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          ))}
        </div>

        {/* chess: T13 */}
      </div>
    </section>
  );
}
