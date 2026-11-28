import { describe, expect, it } from "vitest";
import { fanTarget, parallaxRange, scalePx, trackDistance } from "./math";

describe("motion math helpers", () => {
  it("scales 1440px design values by the current fluid unit u", () => {
    expect(scalePx(56, 16)).toBe(56);
    expect(scalePx(-50, 16)).toBe(-50);
    expect(scalePx(0, 21.33)).toBe(0);
    expect(scalePx(16, 21.33)).toBeCloseTo(21.33, 4);
    expect(scalePx(16, 11.38)).toBeCloseTo(11.38, 4);
    expect(scalePx(56, 21.3333)).toBeCloseTo(74.66655, 3);
    expect(scalePx(56, 11.3778)).toBeCloseTo(39.8223, 3);
  });

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
    expect(fanTarget(0, 140, 24)).toEqual({ x: 0, y: 0, rotation: 0 });
    expect(fanTarget(-2, 140, 24)).toEqual({ x: -420, y: 84, rotation: -18 });
    expect(fanTarget(1, 140, 12)).toEqual({ x: 105, y: 21, rotation: 9 });
  });

  it("computes symmetric gallery parallax ranges", () => {
    expect(parallaxRange(60)).toEqual({ fromY: -60, toY: 60 });
    expect(parallaxRange(-80)).toEqual({ fromY: 80, toY: -80 });
    expect(parallaxRange(110)).toEqual({ fromY: -110, toY: 110 });
    expect(parallaxRange(0)).toEqual({ fromY: 0, toY: 0 });
  });
});
