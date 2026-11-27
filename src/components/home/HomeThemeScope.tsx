"use client";

import { useLayoutEffect } from "react";
import { applyStoredTheme } from "@/lib/theme";

export default function HomeThemeScope() {
  useLayoutEffect(() => {
    const html = document.documentElement;
    html.setAttribute("data-home", "");
    html.removeAttribute("data-theme");
    return () => {
      html.removeAttribute("data-home");
      applyStoredTheme();
    };
  }, []);

  return null;
}
