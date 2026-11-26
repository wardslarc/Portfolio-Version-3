"use client";

import { useEffect } from "react";

export default function ViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const payload = JSON.stringify({ slug });
    const url = "/api/blog/view";

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) {
        return;
      }
    }

    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }, [slug]);

  return null;
}
