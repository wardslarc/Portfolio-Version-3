import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { trackDistance } from "./math";

/**
 * Scrubbed horizontal translation, progress bar fill, and card drift for the
 * pinned work track (`full` condition only). Returns a cleanup for `--hz-extra`
 * and the `refreshInit` listener.
 */
export function trackMotion(root: HTMLElement): () => void {
  const section = root.querySelector<HTMLElement>('[data-anim="track-section"]');
  const stage = root.querySelector<HTMLElement>('[data-anim="track-stage"]');
  const track = root.querySelector<HTMLElement>('[data-anim="track"]');
  const bar = root.querySelector<HTMLElement>('[data-anim="track-bar"]');
  const cards = root.querySelectorAll<HTMLElement>('[data-anim="track-drift"]');

  if (!section || !stage || !track) {
    return () => {};
  }

  const distance = () => trackDistance(track.scrollWidth, window.innerWidth);
  const setExtra = () => {
    section.style.setProperty("--hz-extra", `${distance()}px`);
  };

  setExtra();
  ScrollTrigger.addEventListener("refreshInit", setExtra);

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: "top top",
      end: () => "+=" + (section.offsetHeight - stage.offsetHeight),
      scrub: true,
      invalidateOnRefresh: true,
    },
  });

  tl.fromTo(
    track,
    { x: 0 },
    { x: () => -distance(), duration: 1, ease: "none" },
    0,
  );

  if (bar) {
    tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 1, ease: "none" }, 0);
  }

  for (const card of cards) {
    const drift = Number(card.dataset.drift ?? 0);
    tl.fromTo(
      card,
      { "--drift-y": "0px" },
      { "--drift-y": `${drift}px`, duration: 1, ease: "none" },
      0,
    );
  }

  tl.set({}, {}, 1);

  return () => {
    ScrollTrigger.removeEventListener("refreshInit", setExtra);
    section.style.removeProperty("--hz-extra");
  };
}
