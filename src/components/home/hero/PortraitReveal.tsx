"use client";

import { useRef, useState } from "react";
import { assets, hero } from "@/content/home";
import AssetImage from "../AssetImage";
import shellStyles from "../HomeShell.module.css";
import styles from "./PortraitReveal.module.css";
import PortraitSketch from "./PortraitSketch";

export default function PortraitReveal() {
  const [revealed, setRevealed] = useState(false);
  const photoRef = useRef<HTMLDivElement>(null);

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (revealed) return;
    if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
    const rect = e.currentTarget.getBoundingClientRect();
    photoRef.current?.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    photoRef.current?.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  function onPointerLeave() {
    if (revealed) return;
    photoRef.current?.style.setProperty("--mx", "-400px");
    photoRef.current?.style.setProperty("--my", "-400px");
  }

  function onToggle() {
    setRevealed((prev) => {
      const next = !prev;
      if (next) {
        photoRef.current?.style.removeProperty("--mx");
        photoRef.current?.style.removeProperty("--my");
      } else {
        photoRef.current?.style.setProperty("--mx", "-400px");
        photoRef.current?.style.setProperty("--my", "-400px");
      }
      return next;
    });
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.frame}
        aria-pressed={revealed}
        aria-label="Show the sketch under the photo"
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onClick={onToggle}
      >
        <div className={styles.sketchLayer} aria-hidden="true">
          <PortraitSketch className={styles.sketchSvg} />
          <span className={`${shellStyles.note} ${styles.sketchNote1}`}>
            {hero.sketchNotes[0]}
          </span>
          <span className={`${shellStyles.note} ${styles.sketchNote2}`}>
            {hero.sketchNotes[1]}
          </span>
        </div>

        <div ref={photoRef} className={styles.photoLayer}>
          <AssetImage
            slot={assets.portraitPhoto}
            priority
            sizes="(max-width: 759px) 90vw, 390px"
            className={styles.photoImg}
          />
        </div>
      </button>

      <p className={`${shellStyles.note} ${styles.caption} ${styles.captionHover}`}>
        {hero.caption}
      </p>
      <p className={`${shellStyles.note} ${styles.caption} ${styles.captionTouch}`}>
        {hero.captionTouch}
      </p>
    </div>
  );
}
