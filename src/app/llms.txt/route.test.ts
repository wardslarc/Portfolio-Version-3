import { describe, expect, it, vi } from "vitest";
import { site } from "@/content/site";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/blog/public", () => ({
  getAllLivePostSummaries: vi.fn(async () => [
    {
      id: "1",
      title: "Sample Post",
      slug: "sample-post",
      excerpt: "How we built something.",
      cover: null,
      tags: ["Next.js"],
      publishedAt: "2026-11-26T00:00:00.000Z",
      updatedAt: "2026-11-26T00:00:00.000Z",
      readingMinutes: 4,
      authorName: site.name,
    },
  ]),
}));

const { GET } = await import("./route");

describe("GET /llms.txt", () => {
  it("returns plain-text llms.txt with all required sections", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");

    const text = await res.text();
    expect(text).toContain(`# ${site.name}`);
    expect(text).toContain(`> ${site.description}`);
    expect(text).toContain(site.email);
    expect(text).toContain(site.availability);
    expect(text).toContain("## Pages");
    expect(text).toContain(`[Home](${site.url})`);
    expect(text).toContain(`[Blog](${site.url}/blog)`);
    expect(text).toContain(`[Resume](${site.url}${site.resume})`);
    expect(text).toContain("## Projects");
    expect(text).toContain("- [Bilyo](https://bilyoapp.com/):");
    expect(text).toContain("## Blog posts");
    expect(text).toContain(`- [Sample Post](${site.url}/blog/sample-post): How we built something.`);
    expect(text).toContain("## Elsewhere");
    expect(text).toContain(site.socials.github);
    expect(text).toContain(site.socials.linkedin);
    expect(text).toContain(site.socials.x);
  });
});
