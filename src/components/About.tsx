import Image from "next/image";
import { site } from "@/content/site";
import portrait from "../../public/carls-dale-escalo-portrait.jpg";

const facts = [
  { label: "Based in", value: "Makati, Philippines" },
  { label: "Currently", value: "Systems Developer, Rustan Marketing" },
  { label: "Studied", value: `BS Computer Science, ${site.school}` },
  { label: "Available for", value: "Freelance web and internal tools" },
];

export default function About() {
  return (
    <section id="about" aria-labelledby="about-h">
      <h2 id="about-h" className="section-label">
        About me
      </h2>
      <div className="about-grid">
        {/* 768×960 source shown at 200×250; quality 90 keeps the face sharp on retina screens. */}
        <Image
          className="portrait"
          src={portrait}
          alt={`${site.name} in graduation attire, ${site.school}`}
          sizes="(max-width: 640px) 220px, 200px"
          quality={90}
          placeholder="blur"
        />
        <div className="about-text">
          <p>
            I build internal tools that teams use every day: learning platforms, ticketing systems and
            company websites.
          </p>
          <p>
            I&apos;m currently a Systems Developer at <strong>{site.employer}</strong>, where I built
            and launched RMK Learning Hub, the company&apos;s learning platform. Before that I spent two
            years at Citimax Group building their ticketing system, onboarding LMS and company sites,
            and looking after their domains and deployments.
          </p>
          <p>
            I like owning a project end to end, from the first conversation with the people who&apos;ll
            use it to the server it runs on.
          </p>
          <dl className="facts">
            {facts.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
