import { describe, expect, it } from "vitest";
import { assets, moreRows, night, sketchbook, work } from "./home";
import { featuredProjects, moreProjects } from "./projects";

describe("home content", () => {
  it("matches every work.cards entry to featuredProjects", () => {
    expect(work.cards).toHaveLength(3);
    const featuredTitles = new Set(featuredProjects.map((p) => p.title));
    for (const card of work.cards) {
      expect(featuredTitles.has(card.title)).toBe(true);
    }
    expect(work.cards.map((c) => c.title)).toEqual(
      featuredProjects.map((p) => p.title)
    );
  });

  it("matches every moreRows key to moreProjects in both directions", () => {
    const moreTitles = new Set(moreProjects.map((p) => p.title));
    const rowKeys = Object.keys(moreRows);
    expect(rowKeys).toHaveLength(moreProjects.length);
    for (const key of rowKeys) {
      expect(moreTitles.has(key)).toBe(true);
    }
    for (const project of moreProjects) {
      expect(moreRows[project.title]).toBeDefined();
    }
  });

  it("has 3 night columns with 3 items each", () => {
    expect(night.columns).toHaveLength(3);
    for (const col of night.columns) {
      expect(col.items).toHaveLength(3);
    }
  });

  it("has 5 fan cards with i from -2 to 2", () => {
    expect(sketchbook.cards).toHaveLength(5);
    expect(sketchbook.cards.map((c) => c.i)).toEqual([-2, -1, 0, 1, 2]);
  });

  it("gives every asset slot a non-empty label and alt", () => {
    for (const [key, slot] of Object.entries(assets)) {
      expect(slot.label.trim().length, `${key}.label`).toBeGreaterThan(0);
      expect(slot.alt.trim().length, `${key}.alt`).toBeGreaterThan(0);
    }
  });
});
