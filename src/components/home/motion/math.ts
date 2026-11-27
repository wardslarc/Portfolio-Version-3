/** Horizontal scroll distance for the work track (never negative). */
export function trackDistance(trackWidth: number, viewportWidth: number): number {
  return Math.max(0, trackWidth - viewportWidth);
}
