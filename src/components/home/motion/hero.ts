import gsap from "gsap";
import { scalePx } from "./math";
import { readU } from "./refresh";

/** Scrubbed hero shrink + onigiri stroke draw over the pinned hero stage. */
export function heroPinnedMotion(root: HTMLElement): void {
  const section = root.querySelector<HTMLElement>('[data-anim="hero-section"]');
  const stage = root.querySelector<HTMLElement>('[data-anim="hero-stage"]');
  const cardWrap = root.querySelector<HTMLElement>('[data-anim="hero-card-wrap"]');
  const card = root.querySelector<HTMLElement>('[data-anim="hero-card"]');
  const shadow = root.querySelector<HTMLElement>('[data-anim="hero-shadow"]');
  const onigiri = root.querySelector<HTMLElement | SVGElement>('[data-anim="hero-onigiri"]');
  const onigiriPaths = root.querySelectorAll<SVGGeometryElement>(
    '[data-anim="hero-onigiri-path"]',
  );

  if (!section || !stage) return;

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: "top top",
      end: () => "+=" + (section.offsetHeight - stage.offsetHeight),
      scrub: true,
      invalidateOnRefresh: true,
    },
  });

  if (cardWrap) {
    tl.fromTo(
      cardWrap,
      { scale: 1, rotation: 0 },
      { scale: 0.6, rotation: -2, duration: 1, ease: "none" },
      0,
    );
  }

  if (card) {
    tl.fromTo(
      card,
      { clipPath: "inset(0% round 0px)" },
      {
        clipPath: () => `inset(0% round ${scalePx(36, readU(root))}px)`,
        duration: 1,
        ease: "none",
      },
      0,
    );
  }

  if (shadow) {
    tl.fromTo(
      shadow,
      { opacity: 0 },
      { opacity: 0.7, duration: 1, ease: "none" },
      0,
    );
  }

  if (onigiri) {
    tl.fromTo(
      onigiri,
      { opacity: 0 },
      { opacity: 1, duration: 0.05, ease: "none" },
      0.5,
    );
  }

  if (onigiriPaths.length > 0) {
    tl.fromTo(
      onigiriPaths,
      { strokeDashoffset: 1000 },
      { strokeDashoffset: 0, duration: 0.4, ease: "none" },
      0.55,
    );
  }

  tl.set({}, {}, 1);
}

/** Strokes the onigiri drawing over the static marquee band (mobile & reduce). */
export function heroStaticMotion(root: HTMLElement): void {
  const band = root.querySelector<HTMLElement>('[data-anim="hero-band"]');
  const onigiri = root.querySelector<HTMLElement | SVGElement>('[data-anim="hero-onigiri"]');
  const onigiriPaths = root.querySelectorAll<SVGGeometryElement>(
    '[data-anim="hero-onigiri-path"]',
  );

  if (onigiri) {
    gsap.set(onigiri, { opacity: 1 });
  }

  if (band && onigiriPaths.length > 0) {
    gsap.fromTo(
      onigiriPaths,
      { strokeDashoffset: 1000 },
      {
        strokeDashoffset: 0,
        ease: "none",
        scrollTrigger: {
          trigger: band,
          start: "top 80%",
          end: "bottom 40%",
          scrub: true,
        },
      },
    );
  }
}
