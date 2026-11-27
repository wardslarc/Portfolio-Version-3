import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: `Page not found | ${site.name}`,
};

export default function NotFound() {
  return (
    <>
      <Header variant="blog" />
      <main id="main" className="wrap blog-main">
        <section className="blog-hero">
          <p className="section-label" style={{ marginBottom: "16px" }}>
            404
          </p>
          <h1>This page doesn&apos;t exist</h1>
          <p>The link may be old or mistyped. Try the homepage or the blog.</p>
          <p style={{ display: "flex", gap: "8px", marginTop: "20px" }}>
            <Link className="blog-btn" href="/">
              Home
            </Link>
            <Link className="blog-btn" href="/blog">
              Blog
            </Link>
          </p>
        </section>
      </main>
    </>
  );
}
