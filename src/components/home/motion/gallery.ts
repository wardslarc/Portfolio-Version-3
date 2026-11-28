import gsap from "gsap";
import { parallaxRange, scalePx } from "./math";
import { readU } from "./refresh";

/** Scrubbed vertical parallax for the three night-gallery columns. */
export function galleryMotion(root: HTMLElement): void {
  const cols = root.querySelectorAll<HTMLElement>('[data-anim="parallax-col"]');
  for (const col of cols) {
    const speed = Number(col.dataset.speed ?? 0);
    gsap.fromTo(
      col,
      { y: () => parallaxRange(scalePx(speed, readU(root))).fromY },
      {
        y: () => parallaxRange(scalePx(speed, readU(root))).toY,
        ease: "none",
        scrollTrigger: {
          trigger: col,
          start: "center bottom+=50%",
          end: "center top-=50%",
          scrub: true,
          invalidateOnRefresh: true,
        },
      },
    );
  }
}
