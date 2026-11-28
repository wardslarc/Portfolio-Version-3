import gsap from "gsap";
import { scalePx } from "./math";
import { readU } from "./refresh";

/** Fades statement word spans from 20% to 100% opacity as they cross the viewport. */
export function wordsMotion(root: HTMLElement): void {
  const words = root.querySelectorAll<HTMLElement>('[data-anim="word"]');
  for (const el of words) {
    gsap.fromTo(
      el,
      { opacity: 0.2 },
      {
        opacity: 1,
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top 78%",
          end: "top 60%",
          scrub: true,
        },
      },
    );
  }
}

/**
 * Reveals `[data-anim="reveal"]` and `[data-anim="reveal-fade"]` blocks.
 * When `moveY` is false (reduced-motion calm tier), both run as opacity-only.
 */
export function revealMotion(
  root: HTMLElement,
  options: { moveY?: boolean } = {},
): void {
  const moveY = options.moveY ?? true;

  const reveals = root.querySelectorAll<HTMLElement>('[data-anim="reveal"]');
  for (const el of reveals) {
    gsap.fromTo(
      el,
      moveY ? { opacity: 0, y: () => scalePx(56, readU(root)) } : { opacity: 0 },
      {
        ...(moveY ? { opacity: 1, y: 0 } : { opacity: 1 }),
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top bottom",
          end: "top 70%",
          scrub: true,
          ...(moveY ? { invalidateOnRefresh: true } : {}),
        },
      },
    );
  }

  const fadeOnly = root.querySelectorAll<HTMLElement>('[data-anim="reveal-fade"]');
  for (const el of fadeOnly) {
    gsap.fromTo(
      el,
      { opacity: 0 },
      {
        opacity: 1,
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top bottom",
          end: "top 70%",
          scrub: true,
        },
      },
    );
  }
}

/** Slides heading lines up from behind their `.ln` parent mask. */
export function headingLineMotion(root: HTMLElement): void {
  const lines = root.querySelectorAll<HTMLElement>('[data-anim="heading-line"]');
  for (const el of lines) {
    const mask = el.parentElement;
    if (!mask) continue;
    gsap.fromTo(
      el,
      { yPercent: 110 },
      {
        yPercent: 0,
        ease: "none",
        scrollTrigger: {
          trigger: mask,
          start: "top 95%",
          end: "top 75%",
          scrub: true,
        },
      },
    );
  }
}
