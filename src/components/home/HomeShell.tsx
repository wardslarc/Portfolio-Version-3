"use client";

import "lenis/dist/lenis.css";
import { useRef } from "react";
import styles from "./HomeShell.module.css";

interface HomeShellProps {
  fontClassName: string;
  children: React.ReactNode;
}

export default function HomeShell({ fontClassName, children }: HomeShellProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${fontClassName}`}
      data-motion="off"
    >
      {children}
    </div>
  );
}
