"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { nav } from "@/content/home";
import styles from "./HomeHeader.module.css";
import shellStyles from "./HomeShell.module.css";
import Onigiri from "./Onigiri";

export default function HomeHeader() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    return () => {
      setOpen(false);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const closeMenu = () => setOpen(false);

  return (
    <header className={styles.header}>
      <nav aria-label="Primary" className={styles.nav}>
        <a href="#top" className={styles.logo}>
          <Onigiri variant="logo" className={styles.logoIcon} />
          <span>carls.dale.escalo</span>
        </a>

        <div className={styles.desktopLinks}>
          {nav.links.map((item) =>
            item.href.startsWith("/") ? (
              <Link key={item.href} href={item.href} className={styles.navLink}>
                {item.label}
              </Link>
            ) : (
              <a key={item.href} href={item.href} className={styles.navLink}>
                {item.label}
              </a>
            )
          )}
          <a href={nav.cta.href} className={`${shellStyles.btn} ${styles.cta}`}>
            {nav.cta.label}
          </a>
        </div>

        <button
          ref={btnRef}
          type="button"
          className={styles.menuBtn}
          aria-expanded={open}
          aria-controls="home-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <svg
            viewBox="0 0 24 24"
            width={20}
            height={20}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            aria-hidden="true"
          >
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h10" />
            )}
          </svg>
        </button>
      </nav>

      <div id="home-menu" className={styles.menu} hidden={!open}>
        {nav.links.map((item) =>
          item.href.startsWith("/") ? (
            <Link
              key={item.href}
              href={item.href}
              className={styles.menuLink}
              onClick={closeMenu}
            >
              {item.label}
            </Link>
          ) : (
            <a
              key={item.href}
              href={item.href}
              className={styles.menuLink}
              onClick={closeMenu}
            >
              {item.label}
            </a>
          )
        )}
        <a
          href={nav.cta.href}
          className={`${styles.menuLink} ${styles.menuCta}`}
          onClick={closeMenu}
        >
          {nav.cta.label} →
        </a>
      </div>
    </header>
  );
}
