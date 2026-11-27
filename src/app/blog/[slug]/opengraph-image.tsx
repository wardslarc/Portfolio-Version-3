import { ImageResponse } from "next/og";
import { site } from "@/content/site";
import { getLivePostBySlug } from "@/lib/blog/public";

export const alt = `${site.name} Blog`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = slug === "__placeholder__" ? null : await getLivePostBySlug(slug);
  const host = new URL(site.url).host.replace(/^www\./, "");

  const title = post?.title ?? "Notes from building things";
  const subtitle = post
    ? `${new Date(post.publishedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })} · ${post.readingMinutes} min read`
    : `${site.name} · Blog`;
  const tags = post?.tags.slice(0, 3).join(" · ") || "Blog";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 80px",
          background: "#fafaf9",
          color: "#18181b",
          borderTop: "12px solid #2f5bd3",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 24,
            color: "#2f5bd3",
            fontWeight: 600,
          }}
        >
          <span>{tags}</span>
          <span style={{ color: "#63636b", fontWeight: 400 }}>{subtitle}</span>
        </div>

        <div
          style={{
            fontSize: title.length > 72 ? 52 : 64,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            color: "#18181b",
          }}
        >
          {title}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid #e4e4e1",
            paddingTop: 28,
            fontSize: 26,
          }}
        >
          <span style={{ fontWeight: 600, color: "#18181b" }}>{site.name}</span>
          <span style={{ color: "#2f5bd3", fontWeight: 600 }}>{`${host}/blog`}</span>
        </div>
      </div>
    ),
    size,
  );
}
