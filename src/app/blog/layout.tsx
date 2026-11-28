import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import HomeHeader from "@/components/home/HomeHeader";
import InkFooter from "@/components/ink/InkFooter";
import InkScope from "@/components/ink/InkScope";

export const metadata: Metadata = {
  alternates: {
    types: {
      "application/rss+xml": "/blog/rss.xml",
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3F1EC" },
    { media: "(prefers-color-scheme: dark)", color: "#16161A" },
  ],
};

export default function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <InkScope>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <HomeHeader variant="site" />
      <main id="main">{children}</main>
      <InkFooter />
    </InkScope>
  );
}
