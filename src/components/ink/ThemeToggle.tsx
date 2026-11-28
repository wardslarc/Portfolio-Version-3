"use client";

import { useSyncExternalStore } from "react";
import type { MouseEvent } from "react";
import { MoonIcon, SunIcon } from "@/components/Icons";

type Theme = "light" | "dark";

function currentTheme(): Theme {
  const set = document.documentElement.getAttribute("data-theme");
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onChange);
  };
}

function applyTheme(next: Theme) {
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem("cde-theme", next);
  } catch {
    // Storage can be blocked (private mode); the toggle still works for this visit.
  }
}

type StartViewTransitionWithTypes = (options: {
  update: () => void;
  types: string[];
}) => unknown;

export default function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore<Theme | null>(
    subscribeTheme,
    currentTheme,
    () => null,
  );

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const doc = document as Document & {
      startViewTransition?: StartViewTransitionWithTypes;
    };

    if (reduce || typeof doc.startViewTransition !== "function") {
      applyTheme(next);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    document.documentElement.style.setProperty(
      "--vx",
      `${rect.left + rect.width / 2}px`,
    );
    document.documentElement.style.setProperty(
      "--vy",
      `${rect.top + rect.height / 2}px`,
    );

    try {
      doc.startViewTransition({
        update: () => applyTheme(next),
        types: ["theme"],
      });
    } catch {
      applyTheme(next);
    }
  }

  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      aria-label={
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      }
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
