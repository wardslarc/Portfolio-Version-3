import TrackedLink from "@/components/TrackedLink";
import { hero } from "@/content/home";
import { site } from "@/content/site";
import shellStyles from "../HomeShell.module.css";
import Onigiri from "../Onigiri";
import styles from "./Hero.module.css";
import Marquee from "./Marquee";
import PortraitReveal from "./PortraitReveal";

export default function Hero() {
  return (
    <div id="top" data-anim="hero-section" className={styles.section}>
      <div data-anim="hero-stage" className={styles.stage}>
        <div data-anim="hero-band" className={styles.band} aria-hidden="true">
          <Marquee />
        </div>

        <div data-anim="hero-card-wrap" className={styles.cardWrap}>
          <div data-anim="hero-shadow" className={styles.shadow} aria-hidden="true" />
          <section
            aria-label="Introduction"
            data-anim="hero-card"
            className={styles.card}
          >
            <div className={styles.inner}>
              <div className={styles.textCol}>
                <p
                  className={`${shellStyles.note} ${styles.heroNote} ${styles.introItem} ${styles.d1}`}
                >
                  {hero.note}
                </p>

                <h1 className={styles.h1}>
                  <span className={`${styles.h1Line} ${styles.introItem} ${styles.d2}`}>
                    {hero.lines[0]}
                  </span>
                  <span className={`${styles.h1Line} ${styles.introItem} ${styles.d3}`}>
                    {hero.lines[1]}
                    <span className={`${shellStyles.serif} ${styles.actually}`}>
                      {hero.accentWord}
                      <svg
                        viewBox="0 0 300 30"
                        preserveAspectRatio="none"
                        fill="none"
                        stroke="#E8492A"
                        strokeWidth={5}
                        strokeLinecap="round"
                        aria-hidden="true"
                        className={styles.underline}
                      >
                        <path
                          pathLength={1000}
                          d="M4 20 C60 8 120 26 180 14 S270 10 296 18"
                        />
                      </svg>
                    </span>
                  </span>
                  <span className={`${styles.h1Line} ${styles.introItem} ${styles.d4}`}>
                    {hero.lines[2]}
                  </span>
                </h1>

                <p
                  className={`${styles.paragraph} ${styles.introItem} ${styles.d6}`}
                >
                  {hero.paragraph}
                </p>

                <div className={`${styles.ctas} ${styles.introItem} ${styles.d7}`}>
                  <a href="#work" className={`${shellStyles.btn} ${styles.btnPrimary}`}>
                    {hero.ctaWork}
                  </a>
                  <TrackedLink
                    href={site.resume}
                    target="_blank"
                    rel="noopener noreferrer"
                    event="resume_opened"
                    className={`${shellStyles.btn} ${styles.btnSecondary}`}
                  >
                    {hero.ctaResume}
                  </TrackedLink>
                  <a
                    href={site.socials.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${shellStyles.btn} ${styles.btnSecondary}`}
                  >
                    {hero.ctaInstagram}
                  </a>
                </div>
              </div>

              <div className={`${styles.portraitCol} ${styles.introItem} ${styles.d5}`}>
                <PortraitReveal />
              </div>
            </div>
          </section>
        </div>

        <Onigiri
          variant="drawing"
          data-anim="hero-onigiri"
          className={styles.onigiri}
        />
      </div>
    </div>
  );
}
