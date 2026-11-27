"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { site } from "@/content/site";
import { MoonIcon, SunIcon } from "./Icons";

const sections = [
  { id: "about", label: "About" },
  { id: "work", label: "Work" },
  { id: "experience", label: "Experience" },
  { id: "chess", label: "Chess" },
  { id: "contact", label: "Contact" },
];

type Theme = "light" | "dark";

function currentTheme(): Theme {
  const set = document.documentElement.getAttribute("data-theme");
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// The theme lives on <html> (set before first paint), so read it as an external store:
// it changes when the toggle sets data-theme or when the OS switches light/dark.
function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onChange);
  };
}

export default function Header({ variant = "home" }: { variant?: "home" | "blog" }) {
  const pathname = usePathname();
  const isBlog = variant === "blog" || pathname.startsWith("/blog");
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const theme = useSyncExternalStore<Theme | null>(subscribeTheme, currentTheme, () => null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    if (isBlog) {
      return () => window.removeEventListener("scroll", onScroll);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const { id } of [...sections, { id: "blog", label: "Blog" }]) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [isBlog]);

  function toggleTheme() {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("cde-theme", next);
    } catch {
      // Storage can be blocked (private mode); the toggle still works for this visit.
    }
  }

  const sectionPrefix = isBlog ? "/" : "";

  return (
    <header className={`site-header${scrolled ? " scrolled" : ""}`}>
      <div className="wrap bar">
        {isBlog ? (
          <Link className="brand" href="/">
            {site.name}
          </Link>
        ) : (
          <a className="brand" href="#top">
            {site.name}
          </a>
        )}
        <div className="header-right">
          <nav className="nav" aria-label="Sections">
            <ul>
              {sections.map((s) => (
                <li key={s.id} className="nav-section">
                  <a
                    href={`${sectionPrefix}#${s.id}`}
                    aria-current={!isBlog && active === s.id ? "true" : undefined}
                  >
                    {s.label}
                  </a>
                </li>
              ))}
              <li>
                <Link href="/blog" aria-current={isBlog ? "page" : undefined}>
                  Blog
                </Link>
              </li>
            </ul>
          </nav>
          <button
            className="icon-btn"
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </div>
    </header>
  );
}
