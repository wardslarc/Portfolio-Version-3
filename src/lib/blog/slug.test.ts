import { describe, expect, it } from "vitest";
import { tagToSlug } from "./slug";

describe("tagToSlug", () => {
  it("normalizes punctuation and spaces to lowercase hyphenated slugs", () => {
    expect(tagToSlug("Next.js")).toBe("next-js");
    expect(tagToSlug("Web Security")).toBe("web-security");
  });

  it("trims whitespace, collapses repeated separators, and strips outer hyphens", () => {
    expect(tagToSlug("  --React / TypeScript!!  ")).toBe("react-typescript");
    expect(tagToSlug("C++ & Rust")).toBe("c-rust");
    expect(tagToSlug("Café Tech")).toBe("cafe-tech");
    expect(tagToSlug("---")).toBe("");
  });
});
