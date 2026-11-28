import Link from "next/link";
import type { ReactNode } from "react";
import InkScope from "@/components/ink/InkScope";
import Onigiri from "@/components/home/Onigiri";
import styles from "./AuthShell.module.css";

interface AuthShellProps {
  kicker: string;
  title: [string, string];
  lede?: string;
  note: string;
  notePlacement?: "top" | "bottom";
  twoTapes?: boolean;
  back?: boolean;
  shakeClass?: string;
  children: ReactNode;
}

export default function AuthShell({
  kicker,
  title,
  lede,
  note,
  notePlacement = "top",
  twoTapes = false,
  back = true,
  shakeClass = "",
  children,
}: AuthShellProps) {
  const noteCls =
    notePlacement === "bottom" ? styles.noteBottom : styles.noteTop;
  const noteDelay = twoTapes ? "2s" : "1.3s";

  return (
    <InkScope forceDark>
      <div className={styles.shell}>
        <header className={styles.top}>
          <Link href="/" className={styles.logo}>
            <Onigiri variant="logo" />
            <span>carls.dale.escalo</span>
          </Link>
          {back ? (
            <Link href="/" className={styles.back}>
              ← back to the site
            </Link>
          ) : null}
        </header>

        <main className={styles.stage}>
          <div className={styles.say}>
            <div
              className={`k-kicker k-in-fade ${styles.kicker}`}
              style={{ animationDelay: "0.05s" }}
            >
              {kicker}
            </div>
            <h1 className={styles.big}>
              <span className="k-ln">
                <span
                  className="k-in-line"
                  style={{ animationDelay: "0.15s" }}
                >
                  {title[0]}
                </span>
              </span>
              <span className="k-ln">
                <span
                  className={`k-in-line k-serif ${styles.bigSerif}`}
                  style={{ animationDelay: "0.27s" }}
                >
                  {title[1]}
                </span>
              </span>
            </h1>
            {lede ? (
              <p
                className={`k-in-up ${styles.lede}`}
                style={{ animationDelay: "0.5s" }}
              >
                {lede}
              </p>
            ) : null}
          </div>

          <div className={styles.cardWrap}>
            <div className={`${styles.card}${shakeClass ? ` ${shakeClass}` : ""}`}>
              <span
                aria-hidden="true"
                className={`k-tape k-in-slap ${styles.tapeLeft}`}
                style={{ animationDelay: "1.05s" }}
              />
              {twoTapes ? (
                <span
                  aria-hidden="true"
                  className={`k-tape k-in-slap ${styles.tapeRight}`}
                  style={{ animationDelay: "1.15s" }}
                />
              ) : null}
              <span
                aria-hidden="true"
                className={`k-note k-in-write ${noteCls}`}
                style={{ animationDelay: noteDelay }}
              >
                {note}
              </span>
              {children}
            </div>
          </div>
        </main>
      </div>
    </InkScope>
  );
}
