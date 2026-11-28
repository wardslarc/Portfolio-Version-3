import gsap from "gsap";
import { scalePx } from "./math";
import { readU } from "./refresh";

/** Expands the dark contact panel clip-path as it rises into the viewport. */
export function contactGrowMotion(root: HTMLElement): void {
  const panel = root.querySelector<HTMLElement>('[data-anim="contact-grow"]');
  if (!panel) return;

  const radius = (px: number) => `${scalePx(px, readU(root))}px`;

  gsap.fromTo(
    panel,
    {
      clipPath: () => {
        const r = radius(96);
        return `inset(9% 5% 0% 5% round ${r} ${r} 0px 0px)`;
      },
    },
    {
      clipPath: () => {
        const r = radius(40);
        return `inset(0% 0% 0% 0% round ${r} ${r} 0px 0px)`;
      },
      ease: "none",
      scrollTrigger: {
        trigger: panel,
        start: "top bottom",
        end: "top 30%",
        scrub: true,
        invalidateOnRefresh: true,
      },
    },
  );
}
