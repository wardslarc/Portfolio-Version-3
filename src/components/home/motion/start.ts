import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { createLenis } from "./lenis";
import { MOTION_QUERIES } from "./queries";
import { watchRefresh } from "./refresh";
import { sectionThemes } from "./themes";

/** Starts all homepage motion inside a single gsap.matchMedia() context. */
export function start(root: HTMLElement): () => void {
  gsap.registerPlugin(ScrollTrigger);

  const mm = gsap.matchMedia();

  mm.add(MOTION_QUERIES, (context) => {
    const { reduce } = context.conditions ?? {};
    const cleanups: Array<() => void> = [];

    if (reduce) {
      root.dataset.motion = "on";
      const syncTheme = sectionThemes(root, context);
      const unwatch = watchRefresh(root, null);
      ScrollTrigger.refresh();
      syncTheme();

      return () => {
        unwatch();
        for (const fn of cleanups) fn();
        delete root.dataset.motion;
        root.style.removeProperty("--home-bg");
        root.style.removeProperty("--home-fg");
      };
    }

    root.dataset.motion = "on";
    const { lenis, destroy: destroyLenis } = createLenis();
    const syncTheme = sectionThemes(root, context);
    const unwatch = watchRefresh(root, lenis);
    ScrollTrigger.refresh();
    syncTheme();

    return () => {
      unwatch();
      for (const fn of cleanups) fn();
      destroyLenis();
      delete root.dataset.motion;
      root.style.removeProperty("--home-bg");
      root.style.removeProperty("--home-fg");
    };
  });

  return () => mm.revert();
}
