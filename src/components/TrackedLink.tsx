"use client";

import { track } from "@vercel/analytics";
import type { AnchorHTMLAttributes } from "react";

interface TrackedLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  event: string;
  eventData?: Record<string, string | number | boolean>;
}

export default function TrackedLink({ event, eventData, onClick, ...props }: TrackedLinkProps) {
  return (
    <a
      {...props}
      onClick={(e) => {
        track(event, eventData);
        onClick?.(e);
      }}
    />
  );
}
