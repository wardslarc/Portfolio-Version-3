const compactFormatter = new Intl.NumberFormat("en", { notation: "compact" });

export function formatCompactCount(count: number): string {
  return compactFormatter.format(count);
}
