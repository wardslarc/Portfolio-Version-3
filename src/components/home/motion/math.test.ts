import { describe, expect, it } from "vitest";
import { trackDistance } from "./math";

describe("motion math helpers", () => {
  it("computes positive horizontal track distance and clamps at zero", () => {
    expect(trackDistance(3253, 1440)).toBe(1813);
    expect(trackDistance(1200, 1440)).toBe(0);
    expect(trackDistance(1440, 1440)).toBe(0);
  });
});
