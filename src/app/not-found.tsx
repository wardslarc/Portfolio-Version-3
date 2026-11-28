import type { Metadata, Viewport } from "next";
import Link from "next/link";
import HomeHeader from "@/components/home/HomeHeader";
import InkFooter from "@/components/ink/InkFooter";
import InkScope from "@/components/ink/InkScope";
import { site } from "@/content/site";
import styles from "./not-found.module.css";

export const metadata: Metadata = {
  title: `Page not found | ${site.name}`,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3F1EC" },
    { media: "(prefers-color-scheme: dark)", color: "#16161A" },
  ],
};

export default function NotFound() {
  return (
    <InkScope>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <HomeHeader variant="site" />
      <main id="main">
        <section className={`k-grid ${styles.hero}`}>
          <div className="k-wrap">
            <p className="k-kicker" style={{ margin: 0 }}>
              404
            </p>
            <h1 className={styles.h1}>
              <span className="k-ln">
                <span>This page</span>
              </span>{" "}
              <span className="k-ln">
                <span>doesn&apos;t exist</span>
              </span>
            </h1>
            <p className={styles.lede}>
              The link may be old or mistyped. Try the homepage or the blog.
            </p>
            <div className={styles.actions}>
              <Link className="k-pill k-pill-coral" href="/">
                Home
              </Link>
              <Link className="k-pill" href="/blog">
                Blog
              </Link>
            </div>
          </div>
        </section>
      </main>
      <InkFooter />
    </InkScope>
  );
}
