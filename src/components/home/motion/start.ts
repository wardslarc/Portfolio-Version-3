import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { contactGrowMotion } from "./contact";
import { fanMotion } from "./fan";
import { galleryMotion } from "./gallery";
import { heroPinnedMotion, heroStaticMotion } from "./hero";
import { createLenis } from "./lenis";
import { MOTION_QUERIES } from "./queries";
import { watchRefresh } from "./refresh";
import { headingLineMotion, revealMotion, wordsMotion } from "./reveals";
import { splitMotion } from "./split";
import { sectionThemes } from "./themes";
import { trackMotion } from "./track";

/** Starts all homepage motion inside a single gsap.matchMedia() context. */
export function start(root: HTMLElement): () => void {
  gsap.registerPlugin(ScrollTrigger);

  const mm = gsap.matchMedia();

  mm.add(MOTION_QUERIES, (context) => {
    const { full, reduce, heroPinned } = context.conditions ?? {};
    const cleanups: Array<() => void> = [];

    if (reduce) {
      root.dataset.motion = "on";
      const syncTheme = sectionThemes(root, context);
      heroStaticMotion(root);
      wordsMotion(root);
      revealMotion(root, { moveY: false });
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
    if (heroPinned) {
      heroPinnedMotion(root);
    } else {
      heroStaticMotion(root);
    }
    wordsMotion(root);
    revealMotion(root);
    headingLineMotion(root);
    if (full) cleanups.push(trackMotion(root));
    if (full) splitMotion(root);
    if (full) galleryMotion(root);
    fanMotion(root, full ? 140 : 70);
    contactGrowMotion(root);
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
