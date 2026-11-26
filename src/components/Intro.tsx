import Image from "next/image";
import { site } from "@/content/site";
import photo from "../../public/carls-dale-escalo.jpg";
import { FileIcon, GitHubIcon, LinkedInIcon, XIcon } from "./Icons";

export default function Intro() {
  return (
    <section className="intro" id="top" aria-label="Introduction">
      <div className="intro-head">
        <Image
          className="avatar"
          src={photo}
          alt={`Portrait of ${site.name}`}
          width={72}
          height={72}
          sizes="72px"
          placeholder="blur"
          loading="eager"
          fetchPriority="high"
        />
        <div>
          <h1>{site.name}</h1>
          <p className="role">{site.role}</p>
        </div>
      </div>
      <p className="lede">
        I build internal tools that teams use every day: learning platforms, ticketing systems and
        company websites. I&apos;m currently a Systems Developer at <strong>{site.employer}</strong>,
        where I built and launched RMK Learning Hub, the company&apos;s learning platform.
      </p>
      <div className="avail">
        <i aria-hidden="true" />
        {site.availability}
      </div>
      <div className="actions">
        <a className="btn solid" href="#contact">
          Get in touch
        </a>
        <a className="btn" href={site.resume} target="_blank" rel="noopener noreferrer">
          <FileIcon />
          Résumé (PDF)
        </a>
        <div className="socials">
          <a href={site.socials.github} target="_blank" rel="noopener noreferrer" aria-label="GitHub">
            <GitHubIcon />
          </a>
          <a href={site.socials.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
            <LinkedInIcon />
          </a>
          <a href={site.socials.x} target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)">
            <XIcon />
          </a>
        </div>
      </div>
    </section>
  );
}
