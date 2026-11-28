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
            <p className="k-kicker k-in-fade" style={{ margin: 0, animationDelay: "0.05s" }}>
              404
            </p>
            <h1 className={styles.h1}>
              <span className="k-ln">
                <span className="k-in-line" style={{ animationDelay: "0.15s" }}>
                  This page
                </span>
              </span>{" "}
              <span className="k-ln">
                <span className="k-in-line" style={{ animationDelay: "0.27s" }}>
                  doesn&apos;t exist
                </span>
              </span>
            </h1>
            <p className={`${styles.lede} k-in-up`} style={{ animationDelay: "0.5s" }}>
              The link may be old or mistyped. Try the homepage or the blog.
            </p>
            <div className={`${styles.actions} k-in-up`} style={{ animationDelay: "0.6s" }}>
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
