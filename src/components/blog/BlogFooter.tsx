import Link from "next/link";
import { site } from "@/content/site";

async function CopyrightYear() {
  "use cache";
  return <>{new Date().getFullYear()}</>;
}

export default function BlogFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <span>
          © <CopyrightYear /> {site.name}
        </span>
        <span>
          <Link href="/blog/rss.xml">RSS</Link> · Built with Next.js and MongoDB · Hosted on Vercel
        </span>
      </div>
    </footer>
  );
}
