/** Horizontal scroll distance for the work track (never negative). */
export function trackDistance(trackWidth: number, viewportWidth: number): number {
  return Math.max(0, trackWidth - viewportWidth);
}

/** Target transform values for a sketchbook fan card at index `i` (-2..2). */
export function fanTarget(
  i: number,
  step: number,
): { x: number; y: number; rotation: number } {
  return {
    x: i === 0 ? 0 : i * step,
    y: Math.abs(i) * 28,
    rotation: i === 0 ? 0 : i * 9,
  };
}

/** Start and end `y` offsets for a gallery parallax column with `data-speed`. */
export function parallaxRange(speed: number): { fromY: number; toY: number } {
  return {
    fromY: speed === 0 ? 0 : -speed,
    toY: speed,
  };
}
