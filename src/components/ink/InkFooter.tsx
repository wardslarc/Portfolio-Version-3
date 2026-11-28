import Link from "next/link";
import CopyrightYear from "@/components/home/CopyrightYear";
import styles from "./InkFooter.module.css";

export default function InkFooter() {
  return (
    <footer className={styles.foot}>
      <div className="k-wrap">
        <h2 className={styles.heading}>
          Let&rsquo;s build{" "}
          <span className={styles.serif}>something.</span>
        </h2>
        <div className={styles.ctaRow}>
          <p className={styles.lead}>
            Freelance builds, internal tools, or a full-time role. Tell me what
            you&rsquo;re working on.
          </p>
          <Link className="k-pill k-pill-coral" href="/#contact">
            Say hi <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className={styles.footRow}>
          <span>
            © <CopyrightYear /> Carls Dale Escalo · Makati, PH
          </span>
          <span>
            <Link href="/blog/rss.xml">RSS</Link> · Coded in Next.js · drawn in
            Clip Studio
          </span>
        </div>
      </div>
    </footer>
  );
}
