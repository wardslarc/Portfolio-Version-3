import gsap from "gsap";

/** Scrubbed card entry and circular dark overlay wipe for the pinned split scene. */
export function splitMotion(root: HTMLElement): void {
  const section = root.querySelector<HTMLElement>('[data-anim="split-section"]');
  const stage = root.querySelector<HTMLElement>('[data-anim="split-stage"]');
  const left = root.querySelector<HTMLElement>('[data-anim="split-left"]');
  const right = root.querySelector<HTMLElement>('[data-anim="split-right"]');
  const overlay = root.querySelector<HTMLElement>('[data-anim="split-overlay"]');

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

  if (left) {
    tl.fromTo(
      left,
      { "--split-x": "-130%" },
      { "--split-x": "0%", duration: 0.35, ease: "none" },
      0,
    );
  }

  if (right) {
    tl.fromTo(
      right,
      { "--split-x": "130%" },
      { "--split-x": "0%", duration: 0.35, ease: "none" },
      0,
    );
  }

  if (overlay) {
    tl.fromTo(
      overlay,
      { clipPath: "circle(0% at 72% 50%)" },
      { clipPath: "circle(150% at 72% 50%)", duration: 0.42, ease: "none" },
      0.5,
    );
  }

  tl.set({}, {}, 1);
}
