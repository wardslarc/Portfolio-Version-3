"use client";

import { useEffect, useRef } from "react";

// [word, BCP 47 tag] so each script gets the right font fallback and screen readers aren't misled.
const HELLOS: ReadonlyArray<readonly [string, string]> = [
  ["Hello,", "en"],
  ["こんにちは、", "ja"],
  ["Kumusta,", "fil"],
  ["Hola,", "es"],
  ["안녕하세요,", "ko"],
  ["Bonjour,", "fr"],
  ["你好，", "zh"],
  ["Ciao,", "it"],
  ["नमस्ते,", "hi"],
  ["Hallo,", "de"],
  ["Olá,", "pt"],
  ["Привет,", "ru"],
];

const INTERVAL_MS = 2200;

// Slides each greeting up and out, swaps the word, then slides the next one in.
// The word is swapped directly on the node (no React state) so the hero never re-renders.
// With reduced motion it stays on "Hello,".
export default function Greeting() {
  const wordRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = wordRef.current;
    if (!el || typeof el.animate !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let index = 0;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const out = el.animate(
        [
          { transform: "translateY(0)", opacity: 1 },
          { transform: "translateY(-70%)", opacity: 0 },
        ],
        { duration: 260, easing: "ease-in", fill: "forwards" },
      );
      out.onfinish = () => {
        index = (index + 1) % HELLOS.length;
        const [word, lang] = HELLOS[index];
        el.textContent = word;
        el.lang = lang;
        el.animate(
          [
            { transform: "translateY(70%)", opacity: 0 },
            { transform: "translateY(0)", opacity: 1 },
          ],
          { duration: 380, easing: "cubic-bezier(.2,.7,.2,1)", fill: "forwards" },
        );
      };
    }, INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <p className="hello" aria-label="Hello">
      <span ref={wordRef} className="hello-word" lang="en" aria-hidden="true">
        Hello,
      </span>
    </p>
  );
}
