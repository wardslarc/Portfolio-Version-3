import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export type HomeTheme = "paper" | "sand" | "dark";

const THEME_COLORS: Record<HomeTheme, { bg: string; fg: string }> = {
  paper: { bg: "#F3F1EC", fg: "#16161A" },
  sand: { bg: "#E6E0D2", fg: "#16161A" },
  dark: { bg: "#16161A", fg: "#F3F1EC" },
};

function isHomeTheme(value: string | undefined): value is HomeTheme {
  return value === "paper" || value === "sand" || value === "dark";
}

/**
 * Tweens `--home-bg` and `--home-fg` on the homepage root as themed sections
 * cross the viewport midpoint. Returns a sync helper to apply the active
 * section's theme immediately after ScrollTrigger refreshes.
 */
export function sectionThemes(root: HTMLElement, context: gsap.Context): () => void {
  const setTheme = context.add(
    null as unknown as string,
    (name: HomeTheme, immediate = false) => {
      const { bg, fg } = THEME_COLORS[name];
      gsap.to(root, {
        "--home-bg": bg,
        "--home-fg": fg,
        duration: immediate ? 0 : 0.9,
        ease: "power1.inOut",
        overwrite: "auto",
      });
    },
  ) as (name: HomeTheme, immediate?: boolean) => void;

  const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-home-theme]"));

  const triggers = sections.map((el, index) => {
    const theme = el.dataset.homeTheme;
    return {
      theme: isHomeTheme(theme) ? theme : ("paper" as const),
      trigger: ScrollTrigger.create({
        trigger: el,
        start: "top 50%",
        end: "bottom 50%",
        onToggle: (self) => {
          if (self.isActive && isHomeTheme(theme)) {
            setTheme(theme);
          }
        },
        ...(index === 0 ? { onLeaveBack: () => setTheme("paper") } : {}),
      }),
    };
  });

  return () => {
    const active = triggers.find((entry) => entry.trigger.isActive);
    setTheme(active ? active.theme : "paper", true);
  };
}
