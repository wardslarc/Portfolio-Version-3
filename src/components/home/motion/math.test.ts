import { describe, expect, it } from "vitest";
import { fanTarget, parallaxRange, trackDistance } from "./math";

describe("motion math helpers", () => {
  it("computes positive horizontal track distance and clamps at zero", () => {
    expect(trackDistance(3253, 1440)).toBe(1813);
    expect(trackDistance(1200, 1440)).toBe(0);
    expect(trackDistance(1440, 1440)).toBe(0);
  });

  it("computes fan card targets for desktop and mobile steps", () => {
    expect(fanTarget(0, 140)).toEqual({ x: 0, y: 0, rotation: 0 });
    expect(fanTarget(-2, 140)).toEqual({ x: -280, y: 56, rotation: -18 });
    expect(fanTarget(1, 140)).toEqual({ x: 140, y: 28, rotation: 9 });
    expect(fanTarget(-2, 70)).toEqual({ x: -140, y: 56, rotation: -18 });
    expect(fanTarget(2, 70)).toEqual({ x: 140, y: 56, rotation: 18 });
  });

  it("computes symmetric gallery parallax ranges", () => {
    expect(parallaxRange(60)).toEqual({ fromY: -60, toY: 60 });
    expect(parallaxRange(-80)).toEqual({ fromY: 80, toY: -80 });
    expect(parallaxRange(110)).toEqual({ fromY: -110, toY: 110 });
    expect(parallaxRange(0)).toEqual({ fromY: 0, toY: 0 });
  });
});
