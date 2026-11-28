"use client";

import { useEffect, useState } from "react";
import type { TocItem } from "@/lib/blog/markdown";

export default function Toc({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? "");

  useEffect(() => {
    if (items.length < 3) return;
    const elements = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [items]);

  if (items.length < 3) return null;

  return (
    <nav className="blog-toc" aria-label="On this page">
      <div className="blog-toc-inner">
        <div className="k-note blog-toc-title" aria-hidden="true">
          on this page ↓
        </div>
        <ol>
          {items.map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`} className={activeId === item.id ? "on" : undefined}>
                {item.text}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
