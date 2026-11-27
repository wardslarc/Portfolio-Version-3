import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  NO_TRACK_COOKIE_NAME,
  VISITOR_COOKIE_MAX_AGE,
  VISITOR_COOKIE_NAME,
  formatVisitorSetCookie,
  hasNoTrackCookie,
  hashBlogVisitor,
  isLikelyBot,
  noTrackCookieOptions,
  parseVisitorCookie,
} = await import("./visitor");

describe("visitor helpers", () => {
  beforeEach(() => {
    delete process.env.IP_HASH_SALT;
  });

  it("detects likely bots and empty user agents", () => {
    expect(isLikelyBot("")).toBe(true);
    expect(isLikelyBot("   ")).toBe(true);
    expect(isLikelyBot(null)).toBe(true);
    expect(isLikelyBot(undefined)).toBe(true);
    expect(isLikelyBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(isLikelyBot("Twitterbot/1.0")).toBe(true);
    expect(isLikelyBot("facebookexternalhit/1.1")).toBe(true);
    expect(isLikelyBot("Slackbot-LinkExpanding 1.0")).toBe(true);
    expect(isLikelyBot("Mozilla/5.0 Chrome/120.0.0.0 HeadlessChrome/120.0.0.0")).toBe(true);
    expect(isLikelyBot("Chrome-Lighthouse")).toBe(true);
    expect(isLikelyBot("WhatsApp/2.23.20.0")).toBe(true);
    expect(isLikelyBot("TelegramBot (like TwitterBot)")).toBe(true);
    expect(isLikelyBot("Discordbot/2.0")).toBe(true);
    expect(isLikelyBot("crawler-agent/1.0")).toBe(true);
    expect(isLikelyBot("MySpider/0.1")).toBe(true);
    expect(isLikelyBot("Yahoo! Slurp")).toBe(true);
    expect(isLikelyBot("Applebot/0.1 Link Preview")).toBe(true);
    expect(isLikelyBot("Embedly/0.2")).toBe(true);
    expect(isLikelyBot("Quora Link Preview/1.0")).toBe(true);

    expect(
      isLikelyBot(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      ),
    ).toBe(false);
    expect(
      isLikelyBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"),
    ).toBe(false);
  });

  it("hashes blog visitors deterministically to 32 hex chars with IP_HASH_SALT", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const expectedDefault = createHash("sha256")
      .update(`portfolio:blog:v:${id}`)
      .digest("hex")
      .slice(0, 32);
    expect(hashBlogVisitor(id)).toBe(expectedDefault);
    expect(hashBlogVisitor(id)).toHaveLength(32);

    process.env.IP_HASH_SALT = "custom-salt";
    const expectedCustom = createHash("sha256")
      .update(`custom-salt:blog:v:${id}`)
      .digest("hex")
      .slice(0, 32);
    expect(hashBlogVisitor(id)).toBe(expectedCustom);
    expect(hashBlogVisitor(id)).not.toBe(expectedDefault);
    expect(hashBlogVisitor("22222222-2222-4222-8222-222222222222")).not.toBe(expectedCustom);
  });

  it("parses and formats visitor_id cookie", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const parsedExisting = parseVisitorCookie(new Headers({ cookie: `${VISITOR_COOKIE_NAME}=${id}` }));
    expect(parsedExisting).toEqual({ visitorId: id, isNew: false });

    const parsedMissing = parseVisitorCookie(new Headers());
    expect(parsedMissing.isNew).toBe(true);
    expect(parsedMissing.visitorId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    const setCookie = formatVisitorSetCookie(id);
    expect(setCookie).toContain(`${VISITOR_COOKIE_NAME}=${id}`);
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain(`Max-Age=${VISITOR_COOKIE_MAX_AGE}`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
  });

  it("detects blog_notrack cookie and exposes Path=/ options", () => {
    expect(hasNoTrackCookie(new Headers())).toBe(false);
    expect(hasNoTrackCookie(new Headers({ cookie: `${VISITOR_COOKIE_NAME}=abc` }))).toBe(false);
    expect(hasNoTrackCookie(new Headers({ cookie: `${NO_TRACK_COOKIE_NAME}=1` }))).toBe(true);
    expect(hasNoTrackCookie(new Headers({ cookie: `foo=bar; ${NO_TRACK_COOKIE_NAME}=1` }))).toBe(true);

    expect(noTrackCookieOptions()).toEqual({
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: VISITOR_COOKIE_MAX_AGE,
    });
  });
});
