import ChessSection from "@/components/ChessSection";
import Contact from "@/components/Contact";
import { Experience, Skills } from "@/components/Experience";
import Header from "@/components/Header";
import Intro from "@/components/Intro";
import Work from "@/components/Work";
import { site } from "@/content/site";

const personSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: site.name,
  url: site.url,
  jobTitle: "Systems Developer",
  worksFor: { "@type": "Organization", name: site.employer },
  address: { "@type": "PostalAddress", addressLocality: "Makati", addressCountry: "PH" },
  sameAs: Object.values(site.socials),
};

// Cached so the page can stay prerendered; it's recomputed when the cache revalidates.
async function CopyrightYear() {
  "use cache";
  return <>{new Date().getFullYear()}</>;
}

export default function Home() {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <script
        type="application/ld+json"
        // Static, build-time JSON; "<" is escaped so it can't close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema).replace(/</g, "\\u003c") }}
      />
      <Header />
      <main id="main" className="wrap">
        <Intro />
        <Work />
        <Experience />
        <Skills />
        <ChessSection />
        <Contact />
      </main>
      <footer className="site-footer">
        <div className="wrap">
          <span>© <CopyrightYear /> {site.name}</span>
          <span>Built with Next.js and MongoDB · Hosted on Vercel</span>
        </div>
      </footer>
    </>
  );
}
