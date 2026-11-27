import { ScrollTrigger } from "gsap/ScrollTrigger";
import type Lenis from "lenis";

/**
 * Refreshes ScrollTrigger when fonts finish loading or `[data-refresh-on-resize]`
 * containers change size, and scrolls to `location.hash` after the first refresh.
 */
export function watchRefresh(root: HTMLElement, lenis: Lenis | null): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  document.fonts.ready.then(() => {
    if (!stopped) ScrollTrigger.refresh();
  });

  let observer: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    const seen = new WeakSet<Element>();
    observer = new ResizeObserver((entries) => {
      if (stopped) return;
      let resized = false;
      for (const entry of entries) {
        if (!seen.has(entry.target)) {
          seen.add(entry.target);
        } else {
          resized = true;
        }
      }
      if (!resized) return;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!stopped) ScrollTrigger.refresh();
      }, 150);
    });

    for (const el of root.querySelectorAll("[data-refresh-on-resize]")) {
      observer.observe(el);
    }
  }

  const onFirstRefresh = () => {
    ScrollTrigger.removeEventListener("refresh", onFirstRefresh);
    if (stopped || !location.hash) return;

    let id = "";
    try {
      id = decodeURIComponent(location.hash.slice(1));
    } catch {
      return;
    }
    if (!id) return;

    const target = document.getElementById(id);
    if (!target || !root.contains(target)) return;

    if (lenis) {
      lenis.scrollTo(target, { immediate: true });
    } else {
      target.scrollIntoView();
    }
  };

  ScrollTrigger.addEventListener("refresh", onFirstRefresh);

  return () => {
    stopped = true;
    observer?.disconnect();
    if (timer !== null) clearTimeout(timer);
    ScrollTrigger.removeEventListener("refresh", onFirstRefresh);
  };
}
