import gsap from "gsap";

/** Expands the dark contact panel clip-path as it rises into the viewport. */
export function contactGrowMotion(root: HTMLElement): void {
  const panel = root.querySelector<HTMLElement>('[data-anim="contact-grow"]');
  if (!panel) return;

  gsap.fromTo(
    panel,
    { clipPath: "inset(9% 5% 0% 5% round 96px 96px 0px 0px)" },
    {
      clipPath: "inset(0% 0% 0% 0% round 40px 40px 0px 0px)",
      ease: "none",
      scrollTrigger: {
        trigger: panel,
        start: "top bottom",
        end: "top 30%",
        scrub: true,
      },
    },
  );
}
