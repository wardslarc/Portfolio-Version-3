import { assets, split } from "@/content/home";
import AssetImage from "./AssetImage";
import shellStyles from "./HomeShell.module.css";
import styles from "./SplitScene.module.css";

export default function SplitScene() {
  return (
    <section
      data-home-theme="paper"
      data-anim="split-section"
      className={styles.section}
    >
      <div data-anim="split-stage" className={styles.stage}>
        <div
          data-anim="split-left"
          className={styles.splitLeft}
          aria-hidden={!assets.deskPhoto.src}
        >
          <AssetImage
            slot={assets.deskPhoto}
            sizes="(max-width: 759px) 80vw, 380px"
            className={styles.cardAsset}
          />
        </div>

        <h2 className={styles.heading}>
          <span className={styles.col}>
            <span className={`${shellStyles.serif} ${styles.italicLine}`}>
              {split.left}
            </span>
            <span>{split.word}</span>
            <span
              className={`${shellStyles.note} ${styles.splitNote}`}
              aria-hidden="true"
            >
              {split.noteLeft}
            </span>
          </span>
          <span className={styles.col}>
            <span className={`${shellStyles.serif} ${styles.italicLine}`}>
              {split.right}
            </span>
            <span>{split.word}</span>
            <span
              className={`${shellStyles.note} ${styles.splitNote}`}
              aria-hidden="true"
            >
              {split.noteRight}
            </span>
          </span>
        </h2>

        <div
          data-anim="split-right"
          className={styles.splitRight}
          aria-hidden={!assets.favoriteDrawing.src}
        >
          <AssetImage
            slot={assets.favoriteDrawing}
            sizes="(max-width: 759px) 80vw, 380px"
            className={styles.cardAsset}
          />
        </div>

        <div data-anim="split-overlay" className={styles.overlay}>
          <p className={styles.overlayText}>
            {split.overlay[0]}
            <br />
            <span className={`${shellStyles.serif} ${styles.overlayAccent}`}>
              {split.overlay[1]}
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
