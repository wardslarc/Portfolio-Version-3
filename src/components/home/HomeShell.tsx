"use client";

import "lenis/dist/lenis.css";
import { useLayoutEffect, useRef } from "react";
import styles from "./HomeShell.module.css";

interface HomeShellProps {
  fontClassName: string;
  children: React.ReactNode;
}

export default function HomeShell({ fontClassName, children }: HomeShellProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let cancelled = false;
    let stop: (() => void) | null = null;

    import("./motion/start").then(({ start }) => {
      if (cancelled) return;
      stop = start(root);
    });

    return () => {
      cancelled = true;
      stop?.();
      stop = null;
    };
  }, []);

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
