import { ScrollTrigger } from "gsap/ScrollTrigger";
import type Lenis from "lenis";

/** Reads the resolved `--u` fluid unit in pixels from the homepage root element. */
export function readU(root: HTMLElement): number {
  return parseFloat(getComputedStyle(root).getPropertyValue("--u")) || 16;
}

/**
 * Refreshes ScrollTrigger when fonts finish loading, `[data-refresh-on-resize]`
 * containers change size, or the viewport dimensions change, and scrolls to
 * `location.hash` after the first refresh.
 */
export function watchRefresh(root: HTMLElement, lenis: Lenis | null): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  let lastW = window.innerWidth;
  let lastH = window.innerHeight;

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

  const updateViewportSize = () => {
    lastW = window.innerWidth;
    lastH = window.innerHeight;
  };

  const onResize = () => {
    if (stopped) return;
    if (resizeTimer !== null) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeTimer = null;
      if (stopped) return;
      if (window.innerWidth === lastW && window.innerHeight === lastH) return;
      ScrollTrigger.refresh();
    }, 200);
  };

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

  ScrollTrigger.addEventListener("refresh", updateViewportSize);
  ScrollTrigger.addEventListener("refresh", onFirstRefresh);
  window.addEventListener("resize", onResize);

  return () => {
    stopped = true;
    observer?.disconnect();
    if (timer !== null) clearTimeout(timer);
    if (resizeTimer !== null) clearTimeout(resizeTimer);
    window.removeEventListener("resize", onResize);
    ScrollTrigger.removeEventListener("refresh", updateViewportSize);
    ScrollTrigger.removeEventListener("refresh", onFirstRefresh);
  };
}
