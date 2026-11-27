import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  extractMarkdownImageUrls,
  extractToc,
  findMarkdownImagesMissingAlt,
  readingMinutes,
  renderMarkdown,
} = await import("./markdown");

describe("blog markdown pipeline", () => {
  it("strips script, iframe, inline style, event handlers, and javascript: links", async () => {
    const md = [
      "<script>alert('xss')</script>",
      "",
      "<iframe src=\"https://evil.example/embed\"></iframe>",
      "",
      "<div style=\"color:red\" onclick=\"alert(1)\">hello</div>",
      "",
      "<img src=\"https://example.com/a.png\" onerror=\"alert(1)\" alt=\"pic\" />",
      "",
      "[bad link](javascript:alert(1)) and [ok link](https://example.com) and [mail](mailto:hi@example.com)",
      "",
      "![insecure img](http://example.com/insecure.png)",
    ].join("\n");

    const html = await renderMarkdown(md);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("style=");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("http://example.com/insecure.png");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('href="mailto:hi@example.com"');
  });

  it("highlights code blocks with hljs and language-* classes", async () => {
    const md = "```ts\nconst answer: number = 42;\n```";
    const html = await renderMarkdown(md);
    expect(html).toContain('class="hljs language-ts"');
    expect(html).toContain("hljs-keyword");
  });

  it("generates heading ids matching extractToc including duplicates", async () => {
    const md = [
      "## Overview",
      "",
      "### Details",
      "",
      "## Overview",
      "",
      "## Using `use cache`",
    ].join("\n");

    const toc = extractToc(md);
    expect(toc).toEqual([
      { id: "overview", text: "Overview" },
      { id: "overview-1", text: "Overview" },
      { id: "using-use-cache", text: "Using use cache" },
    ]);

    const html = await renderMarkdown(md);
    for (const item of toc) {
      expect(html).toContain(`<h2 id="${item.id}">`);
    }
    expect(html).toContain('<h3 id="details">');
  });

  it("wraps a standalone image paragraph in figure + figcaption with lazy loading", async () => {
    const md = "![Two requests racing for the same ply](https://abc.public.blob.vercel-storage.com/blog/race.webp)";
    const html = await renderMarkdown(md);
    expect(html).toContain("<figure>");
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
    expect(html).toContain("<figcaption>Two requests racing for the same ply</figcaption>");
    expect(html).not.toContain("<p><figure>");
  });

  it("computes readingMinutes at 220 words per minute with min 1", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes("hello world")).toBe(1);
    expect(readingMinutes("word ".repeat(221))).toBe(2);
  });

  it("detects missing image alt text and extracts image URLs outside code blocks", () => {
    const md = [
      "![Good alt](https://example.com/1.webp)",
      "![](https://example.com/2.webp)",
      "![Describe this image](https://example.com/3.webp)",
      "```md",
      "![](https://example.com/in-code.webp)",
      "```",
    ].join("\n");

    expect(findMarkdownImagesMissingAlt(md)).toEqual([
      "https://example.com/2.webp",
      "https://example.com/3.webp",
    ]);
    expect(extractMarkdownImageUrls(md)).toEqual([
      "https://example.com/1.webp",
      "https://example.com/2.webp",
      "https://example.com/3.webp",
    ]);
  });

  it("applies width and height for known image URLs and leaves external images unchanged", async () => {
    const uploaded = "https://abc.public.blob.vercel-storage.com/blog/diagram.webp";
    const external = "https://example.com/external.webp";
    const md = [
      `![Uploaded diagram](${uploaded})`,
      "",
      `Inline ![badge](${uploaded}) and ![other](${external})`,
    ].join("\n");

    const imageSizes = new Map([[uploaded, { width: 1200, height: 630 }]]);
    const html = await renderMarkdown(md, imageSizes);

    expect(html).toContain(
      `<img src="${uploaded}" alt="Uploaded diagram" loading="lazy" decoding="async" width="1200" height="630">`,
    );
    expect(html).toContain(
      `<img src="${uploaded}" alt="badge" loading="lazy" decoding="async" width="1200" height="630">`,
    );
    expect(html).toContain(
      `<img src="${external}" alt="other" loading="lazy" decoding="async">`,
    );
  });
});
