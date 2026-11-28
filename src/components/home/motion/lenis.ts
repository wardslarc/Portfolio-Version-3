import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

export interface LenisController {
  lenis: Lenis;
  destroy: () => void;
}

/** Creates the homepage Lenis instance driven by GSAP's ticker. */
export function createLenis(): LenisController {
  const lenis = new Lenis({
    autoRaf: false,
    lerp: 0.09,
    smoothWheel: true,
    anchors: true,
  });

  lenis.on("scroll", ScrollTrigger.update);

  const raf = (time: number) => {
    lenis.raf(time * 1000);
  };

  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);

  return {
    lenis,
    destroy() {
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    },
  };
}
