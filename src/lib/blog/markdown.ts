import "server-only";
import GithubSlugger from "github-slugger";
import type { Element, ElementContent, Root, Text } from "hast";
import { headingRank } from "hast-util-heading-rank";
import { defaultSchema, type Schema } from "hast-util-sanitize";
import { toString as hastToString } from "hast-util-to-string";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";

export interface TocItem {
  id: string;
  text: string;
}

export interface ImageSize {
  width: number;
  height: number;
}

const sanitizeSchema: Schema = {
  ...defaultSchema,
  // Keep heading IDs matching extractToc() without a "user-content-" prefix.
  clobber: ["ariaDescribedBy", "ariaLabelledBy", "name"],
  clobberPrefix: "",
  attributes: {
    ...defaultSchema.attributes,
    h2: [...(defaultSchema.attributes?.h2 ?? []), "id"],
    h3: [...(defaultSchema.attributes?.h3 ?? []), "id"],
    img: [...(defaultSchema.attributes?.img ?? []), "width", "height", "loading", "decoding"],
    code: [["className", "hljs", /^language-./]],
    span: [["className", /^hljs-./]],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
    src: ["https"],
  },
};

function isExternalHref(href: unknown): boolean {
  if (typeof href !== "string") return false;
  if (!/^https?:\/\//i.test(href)) return false;
  try {
    const url = new URL(href);
    return url.hostname !== "www.carlsdaleescalo.com" && url.hostname !== "carlsdaleescalo.com";
  } catch {
    return false;
  }
}

function isStandaloneImageParagraph(node: Element): Element | null {
  if (node.tagName !== "p") return null;
  const meaningful = node.children.filter(
    (child) => !(child.type === "text" && child.value.trim() === ""),
  );
  if (meaningful.length !== 1) return null;
  const only = meaningful[0];
  if (only && only.type === "element" && only.tagName === "img") {
    return only;
  }
  return null;
}

function applyImageAttributes(
  img: Element,
  imageSizes?: ReadonlyMap<string, ImageSize>,
): void {
  img.properties ??= {};
  img.properties.loading = "lazy";
  img.properties.decoding = "async";

  const src = typeof img.properties.src === "string" ? img.properties.src : "";
  const dims = src ? imageSizes?.get(src) : undefined;
  if (dims && dims.width > 0 && dims.height > 0) {
    img.properties.width = dims.width;
    img.properties.height = dims.height;
  }
}

function rehypeBlogPostProcess() {
  return (tree: Root, file: { data?: Record<string, unknown> }) => {
    const rawSizes = file.data?.imageSizes;
    const imageSizes =
      rawSizes instanceof Map ? (rawSizes as ReadonlyMap<string, ImageSize>) : undefined;

    visit(tree, "element", (node) => {
      if (node.tagName === "img") {
        applyImageAttributes(node, imageSizes);
        return;
      }

      if (node.tagName === "a") {
        node.properties ??= {};
        if (isExternalHref(node.properties.href)) {
          node.properties.rel = ["noopener", "noreferrer"];
        }
        return;
      }

      const img = isStandaloneImageParagraph(node);
      if (img) {
        applyImageAttributes(img, imageSizes);

        const alt = typeof img.properties?.alt === "string" ? img.properties.alt.trim() : "";
        const children: ElementContent[] = [img];
        if (alt) {
          const captionText: Text = { type: "text", value: alt };
          const figcaption: Element = {
            type: "element",
            tagName: "figcaption",
            properties: {},
            children: [captionText],
          };
          children.push(figcaption);
        }

        node.tagName = "figure";
        node.properties = {};
        node.children = children;
      }
    });
  };
}

const htmlProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSlug)
  .use(rehypeHighlight, { detect: false })
  .use(rehypeSanitize, sanitizeSchema)
  .use(rehypeBlogPostProcess)
  .use(rehypeStringify);

const tocProcessor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype);

/** Render GFM Markdown to sanitized HTML for articles and live editor preview. */
export async function renderMarkdown(
  markdown: string,
  imageSizes?: ReadonlyMap<string, ImageSize>,
): Promise<string> {
  const file = await htmlProcessor.process(
    imageSizes ? { value: markdown, data: { imageSizes } } : markdown,
  );
  return String(file);
}

/** Extract h2 headings with IDs matching rehype-slug's output. */
export function extractToc(markdown: string): TocItem[] {
  const mdast = tocProcessor.parse(markdown);
  const hast = tocProcessor.runSync(mdast) as Root;
  const slugger = new GithubSlugger();
  const items: TocItem[] = [];

  visit(hast, "element", (node) => {
    if (headingRank(node)) {
      const text = hastToString(node);
      const id = slugger.slug(text);
      if (node.tagName === "h2" && text.trim()) {
        items.push({ id, text });
      }
    }
  });

  return items;
}

/** Compute reading time at 220 WPM, rounded up, minimum 1 minute. */
export function readingMinutes(markdown: string): number {
  const trimmed = markdown.trim();
  if (!trimmed) return 1;
  const words = trimmed.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 220));
}

/** Collect image URLs referenced via Markdown image syntax (ignoring fenced code blocks). */
export function extractMarkdownImageUrls(markdown: string): string[] {
  const mdast = tocProcessor.parse(markdown);
  const urls = new Set<string>();
  visit(mdast, "image", (node: { url?: string }) => {
    if (typeof node.url === "string" && node.url.trim()) {
      urls.add(node.url.trim());
    }
  });
  return [...urls];
}

/** Return image alt issues in Markdown body (empty alt or placeholder "Describe this image"). */
export function findMarkdownImagesMissingAlt(markdown: string): string[] {
  const mdast = tocProcessor.parse(markdown);
  const missing: string[] = [];
  visit(mdast, "image", (node: { url?: string; alt?: string | null }) => {
    const alt = (node.alt ?? "").trim();
    if (!alt || alt.toLowerCase() === "describe this image") {
      missing.push(node.url ?? "");
    }
  });
  return missing;
}
