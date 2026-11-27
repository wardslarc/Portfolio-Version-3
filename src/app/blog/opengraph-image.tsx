import { ImageResponse } from "next/og";
import { site } from "@/content/site";

export const alt = `${site.name} Blog: notes from building things`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Share card for /blog. Matches the per-post card in ./[slug]/opengraph-image.tsx.
export default function Image() {
  const host = new URL(site.url).host.replace(/^www\./, "");

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
        <div style={{ display: "flex", fontSize: 24, color: "#2f5bd3", fontWeight: 600 }}>
          <span>Blog</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            Notes from building things
          </div>
          <div style={{ fontSize: 30, color: "#63636b", lineHeight: 1.4 }}>
            The systems behind this site and the tools I build at work.
          </div>
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
          <span style={{ fontWeight: 600 }}>{site.name}</span>
          <span style={{ color: "#2f5bd3", fontWeight: 600 }}>{`${host}/blog`}</span>
        </div>
      </div>
    ),
    size,
  );
}
