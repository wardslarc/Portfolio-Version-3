import type { ReactNode } from "react";
import { homeFontVariables } from "@/components/home/fonts";
import "@/styles/ink.css";
import "@/styles/ink-blog.css";

interface InkScopeProps {
  children: ReactNode;
  forceDark?: boolean;
}

export default function InkScope({ children, forceDark = false }: InkScopeProps) {
  return (
    <div className={`ink${forceDark ? " ink-dark" : ""} ${homeFontVariables}`}>
      {children}
    </div>
  );
}
