import { site } from "@/content/site";
import Greeting from "./Greeting";
import { FileIcon, GitHubIcon, LinkedInIcon, XIcon } from "./Icons";
import TrackedLink from "./TrackedLink";

// Text-only hero that fills the first screen; the photo and bio live in About, just below the fold.
export default function Intro() {
  return (
    <section className="intro" id="top" aria-label="Introduction">
      <Greeting />
      <h1>{site.name}</h1>
      <p className="role">{site.role}. I build internal tools that teams use every day.</p>
      <div className="avail">
        <i aria-hidden="true" />
        {site.availability}
      </div>
      <div className="actions">
        <a className="btn solid" href="#contact">
          Get in touch
        </a>
        <TrackedLink className="btn" href={site.resume} target="_blank" rel="noopener noreferrer" event="resume_opened">
          <FileIcon />
          Résumé (PDF)
        </TrackedLink>
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
      <a className="scroll-cue" href="#about" aria-label="Scroll to About me">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 5v14M6 13l6 6 6-6" />
        </svg>
      </a>
    </section>
  );
}
