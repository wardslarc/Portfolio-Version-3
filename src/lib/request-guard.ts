import "server-only";

/**
 * True when the browser says the request came from this site. Browsers send Origin on
 * every POST (fetch and sendBeacon alike), so a missing header means it wasn't our page.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }
  const reqUrl = new URL(request.url);
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    reqUrl.host;
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    reqUrl.protocol.replace(/:$/, "");
  return originUrl.host === host && originUrl.protocol.replace(/:$/, "") === proto;
}

export function isJsonContentType(request: Request): boolean {
  const contentType = (request.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase();
  return contentType === "application/json";
}

/**
 * Rejects cross-site and non-JSON posts. A cross-site form can only send text/plain,
 * form-encoded or multipart bodies without a preflight, so requiring JSON plus a
 * matching Origin stops other pages from posting on a visitor's behalf.
 * Returns null when the request may continue.
 */
export function rejectCrossSiteJsonPost(request: Request): Response | null {
  const headers = { "Cache-Control": "no-store" };
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403, headers });
  }
  if (!isJsonContentType(request)) {
    return Response.json({ error: "Content-Type must be application/json." }, { status: 415, headers });
  }
  return null;
}
