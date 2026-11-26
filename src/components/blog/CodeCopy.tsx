"use client";

import { useEffect } from "react";

/** Enhances server-rendered <pre> code blocks inside containerId with a Copy button. */
export default function CodeCopy({ containerId }: { containerId: string }) {
  useEffect(() => {
    const root = document.getElementById(containerId);
    if (!root) return;

    const pres = Array.from(root.querySelectorAll("pre"));
    const cleanups: (() => void)[] = [];

    for (const pre of pres) {
      if (pre.querySelector(".blog-code-copy")) continue;
      const code = pre.querySelector("code");
      if (!code) continue;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "blog-code-copy";
      btn.textContent = "Copy";
      btn.setAttribute("aria-label", "Copy code");

      let timer: ReturnType<typeof setTimeout> | null = null;
      const onClick = () => {
        const text = code.textContent ?? "";
        navigator.clipboard?.writeText(text).catch(() => {});
        btn.textContent = "Copied";
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          btn.textContent = "Copy";
        }, 1200);
      };

      btn.addEventListener("click", onClick);
      pre.appendChild(btn);

      cleanups.push(() => {
        if (timer) clearTimeout(timer);
        btn.removeEventListener("click", onClick);
        btn.remove();
      });
    }

    return () => {
      for (const fn of cleanups) fn();
    };
  }, [containerId]);

  return null;
}
