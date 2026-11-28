import type { ReactNode } from "react";
import { homeFontVariables } from "@/components/home/fonts";
import "@/styles/ink.css";
import "@/styles/ink-blog.css";

interface InkScopeProps {
  children: ReactNode;
  forceDark?: boolean;
  contained?: boolean;
}

export default function InkScope({
  children,
  forceDark = false,
  contained = false,
}: InkScopeProps) {
  return (
    <div
      className={`ink${forceDark ? " ink-dark" : ""}${contained ? " ink-contained" : ""} ${homeFontVariables}`}
    >
      {children}
    </div>
  );
}
