import { describe, expect, it } from "vitest";
import { excludeAdminBeforeSend, slugifyProject } from "./analytics";

describe("excludeAdminBeforeSend", () => {
  it("drops /admin and /admin/* URLs (full and relative)", () => {
    expect(excludeAdminBeforeSend({ url: "/admin" })).toBeNull();
    expect(excludeAdminBeforeSend({ url: "/admin/" })).toBeNull();
    expect(excludeAdminBeforeSend({ url: "/admin/login" })).toBeNull();
    expect(excludeAdminBeforeSend({ url: "/admin/messages?id=123&filter=unread" })).toBeNull();
    expect(excludeAdminBeforeSend({ url: "https://www.carlsdaleescalo.com/admin" })).toBeNull();
    expect(excludeAdminBeforeSend({ url: "https://www.carlsdaleescalo.com/admin/chess?game=2" })).toBeNull();
  });

  it("keeps public URLs and non-admin prefixes", () => {
    const home = { type: "pageview" as const, url: "https://www.carlsdaleescalo.com/" };
    expect(excludeAdminBeforeSend(home)).toBe(home);

    const anchor = { url: "/#chess" };
    expect(excludeAdminBeforeSend(anchor)).toBe(anchor);

    const similar = { url: "/administrator" };
    expect(excludeAdminBeforeSend(similar)).toBe(similar);
  });
});

describe("slugifyProject", () => {
  it("converts project titles to clean URL-safe slugs", () => {
    expect(slugifyProject("Bilyo")).toBe("bilyo");
    expect(slugifyProject("Relato - AI Resume Builder")).toBe("relato-ai-resume-builder");
    expect(slugifyProject("Citimax Group website")).toBe("citimax-group-website");
  });
});
