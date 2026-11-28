export const MOTION_QUERIES = {
  full: "(min-width: 760px) and (prefers-reduced-motion: no-preference)",
  mobile: "(max-width: 759.98px) and (prefers-reduced-motion: no-preference)",
  reduce: "(prefers-reduced-motion: reduce)",
  heroPinned:
    "(min-width: 1024px) and (min-height: 560px) and (prefers-reduced-motion: no-preference)",
} as const;
