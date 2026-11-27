import type { Metadata } from "next";
import type { ReactNode } from "react";
import Header from "@/components/Header";
import BlogFooter from "@/components/blog/BlogFooter";

export const metadata: Metadata = {
  alternates: {
    types: {
      "application/rss+xml": "/blog/rss.xml",
    },
  },
};

export default function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Header variant="blog" />
      <main id="main" className="wrap blog-main">
        {children}
      </main>
      <BlogFooter />
    </>
  );
}
