import gsap from "gsap";
import { fanTarget } from "./math";
import { readU } from "./refresh";

/** Spreads the 5 sketchbook cards from a stacked pile into a fan. */
export function fanMotion(root: HTMLElement, step: number): void {
  const section = root.querySelector<HTMLElement>('[data-anim="fan-section"]');
  const cards = root.querySelectorAll<HTMLElement>('[data-anim="fan-card"]');
  if (!section || cards.length === 0) return;

  for (const card of cards) {
    const i = Number(card.dataset.i ?? 0);
    const { rotation } = fanTarget(i, step);
    gsap.fromTo(
      card,
      { x: 0, y: 0, rotation: 0 },
      {
        x: () => fanTarget(i, step, readU(root)).x,
        y: () => fanTarget(i, step, readU(root)).y,
        rotation,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top 60%",
          end: "top 15%",
          scrub: true,
          invalidateOnRefresh: true,
        },
      },
    );
  }
}
