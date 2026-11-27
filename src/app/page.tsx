import type { Viewport } from "next";
import ChessSection from "@/components/ChessSection";
import Contact from "@/components/Contact";
import { homeFontVariables } from "@/components/home/fonts";
import Hero from "@/components/home/hero/Hero";
import HomeHeader from "@/components/home/HomeHeader";
import HomeShell from "@/components/home/HomeShell";
import shellStyles from "@/components/home/HomeShell.module.css";
import HomeThemeScope from "@/components/home/HomeThemeScope";
import Statement from "@/components/home/Statement";
import ExperienceStrip from "@/components/home/work/ExperienceStrip";
import LatestPosts from "@/components/home/work/LatestPosts";
import MoreWork from "@/components/home/work/MoreWork";
import moreWorkStyles from "@/components/home/work/MoreWork.module.css";
import WorkTrack from "@/components/home/work/WorkTrack";
import { skills } from "@/content/experience";
import { site } from "@/content/site";

export const viewport: Viewport = { themeColor: "#F3F1EC" };

const personId = `${site.url}/#person`;

// ProfilePage + Person tells Google this page is about one person, which is what name
// searches (recruiters) rely on. WebSite supplies the site name shown in results.
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${site.url}/#website`,
      url: site.url,
      name: site.name,
      inLanguage: "en",
      publisher: { "@id": personId },
    },
    {
      "@type": "ProfilePage",
      "@id": `${site.url}/#profile`,
      url: site.url,
      name: `${site.name} | ${site.headline}`,
      inLanguage: "en",
      isPartOf: { "@id": `${site.url}/#website` },
      mainEntity: { "@id": personId },
    },
    {
      "@type": "Person",
      "@id": personId,
      name: site.name,
      givenName: "Carls Dale",
      familyName: "Escalo",
      url: site.url,
      image: `${site.url}${site.photo}`,
      email: `mailto:${site.email}`,
      description: site.description,
      jobTitle: site.jobTitle,
      worksFor: { "@type": "Organization", name: site.employer },
      alumniOf: { "@type": "CollegeOrUniversity", name: site.school },
      address: {
        "@type": "PostalAddress",
        addressLocality: "Makati",
        addressRegion: "Metro Manila",
        addressCountry: "PH",
      },
      knowsAbout: skills.flatMap((s) => s.items.split(",").map((item) => item.trim())),
      sameAs: Object.values(site.socials),
    },
  ],
};

export default function Home() {
  return (
    <>
      <HomeThemeScope />
      <a className="skip" href="#main">
        Skip to content
      </a>
      <script
        type="application/ld+json"
        // Static, build-time JSON; "<" is escaped so it can't close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <HomeShell fontClassName={homeFontVariables}>
        <HomeHeader />
        <main id="main" className={shellStyles.main}>
          <Hero />
          <Statement />
          <WorkTrack />
          <section data-home-theme="sand" className={moreWorkStyles.sandSection}>
            <div className={moreWorkStyles.sandInner}>
              <MoreWork />
              <ExperienceStrip />
              <LatestPosts />
            </div>
          </section>
        </main>
        <ChessSection />
        <Contact />
      </HomeShell>
    </>
  );
}
