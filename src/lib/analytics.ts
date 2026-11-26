/**
 * Filters out telemetry events whose URL pathname is `/admin` or under `/admin/`.
 * Used as the `beforeSend` callback for both Vercel Web Analytics and Speed Insights.
 */
export function excludeAdminBeforeSend<T extends { url: string }>(event: T): T | null {
  try {
    const pathname = new URL(event.url, "https://example.com").pathname;
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      return null;
    }
  } catch {
    if (event.url === "/admin" || event.url.startsWith("/admin/")) {
      return null;
    }
  }
  return event;
}

export function slugifyProject(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
