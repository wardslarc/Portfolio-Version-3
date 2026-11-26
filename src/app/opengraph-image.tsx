import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { site } from "@/content/site";

export const alt = `${site.name}, ${site.headline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Read at module load (build time), as the Next.js docs do for fonts, so the image stays static.
const photo = await readFile(join(process.cwd(), "public/carls-dale-escalo.jpg"));
const photoSrc = `data:image/jpeg;base64,${photo.toString("base64")}`;

// The preview card shown when the site is shared on LinkedIn, X, Slack or Messenger.
export default async function Image() {
  const host = new URL(site.url).host.replace(/^www\./, "");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 64,
          padding: "0 88px",
          background: "#fafaf9",
          color: "#18181b",
          borderTop: "12px solid #2f5bd3",
        }}
      >
        <img
          src={photoSrc}
          width={300}
          height={300}
          alt=""
          style={{ borderRadius: 9999, border: "1px solid #e4e4e1", objectFit: "cover" }}
        />
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.05 }}>
            {site.name}
          </div>
          <div style={{ fontSize: 36, color: "#63636b", marginTop: 20, lineHeight: 1.3 }}>
            {site.headline}
          </div>
          <div style={{ fontSize: 26, color: "#63636b", marginTop: 28 }}>
            {`${site.jobTitle} at ${site.employer}`}
          </div>
          <div style={{ fontSize: 28, color: "#2f5bd3", marginTop: 44, fontWeight: 600 }}>{host}</div>
        </div>
      </div>
    ),
    size,
  );
}
