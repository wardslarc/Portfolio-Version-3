import gsap from "gsap";
import { parallaxRange } from "./math";

/** Scrubbed vertical parallax for the three night-gallery columns. */
export function galleryMotion(root: HTMLElement): void {
  const cols = root.querySelectorAll<HTMLElement>('[data-anim="parallax-col"]');
  for (const col of cols) {
    const speed = Number(col.dataset.speed ?? 0);
    const { fromY, toY } = parallaxRange(speed);
    gsap.fromTo(
      col,
      { y: fromY },
      {
        y: toY,
        ease: "none",
        scrollTrigger: {
          trigger: col,
          start: "center bottom+=50%",
          end: "center top-=50%",
          scrub: true,
        },
      },
    );
  }
}
