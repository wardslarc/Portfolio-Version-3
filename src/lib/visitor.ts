import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";

export const VISITOR_COOKIE_NAME = "visitor_id";
export const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year in seconds
export const NO_TRACK_COOKIE_NAME = "blog_notrack";

const uuidSchema = z.string().uuid();

const BOT_UA_REGEX =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|quora link|whatsapp|telegrambot|discordbot|headless|lighthouse/i;

function readCookieValue(headers: Headers, cookieName: string): string | null {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name !== cookieName) continue;
    const rawVal = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(rawVal);
    } catch {
      return rawVal;
    }
  }
  return null;
}

export function parseVisitorCookie(headers: Headers): { visitorId: string; isNew: boolean } {
  const cookieHeader = headers.get("cookie");
  if (cookieHeader) {
    for (const part of cookieHeader.split(";")) {
      const eq = part.indexOf("=");
      if (eq === -1) continue;
      const name = part.slice(0, eq).trim();
      if (name !== VISITOR_COOKIE_NAME) continue;
      const rawVal = part.slice(eq + 1).trim();
      let decoded = rawVal;
      try {
        decoded = decodeURIComponent(rawVal);
      } catch {
        // Use raw value if not URL-encoded
      }
      if (uuidSchema.safeParse(decoded).success) {
        return { visitorId: decoded, isNew: false };
      }
    }
  }
  return { visitorId: crypto.randomUUID(), isNew: true };
}

export function formatVisitorSetCookie(visitorId: string): string {
  const parts = [
    `${VISITOR_COOKIE_NAME}=${visitorId}`,
    "Path=/",
    `Max-Age=${VISITOR_COOKIE_MAX_AGE}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function hasNoTrackCookie(headers: Headers): boolean {
  const val = readCookieValue(headers, NO_TRACK_COOKIE_NAME);
  return val !== null && val.length > 0;
}

export function noTrackCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: VISITOR_COOKIE_MAX_AGE,
  };
}

export function hashBlogVisitor(visitorId: string): string {
  const salt = process.env.IP_HASH_SALT || "portfolio";
  return createHash("sha256").update(`${salt}:blog:v:${visitorId}`).digest("hex").slice(0, 32);
}

export function isLikelyBot(userAgent: string | null | undefined): boolean {
  if (!userAgent || !userAgent.trim()) return true;
  return BOT_UA_REGEX.test(userAgent);
}
