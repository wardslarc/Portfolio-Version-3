import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  formatEtag,
  geoFromHeaders,
  hashChessIp,
  hashVisitorId,
  matchesIfNoneMatch,
  normalizeIpPrefix,
} = await import("./chess");

describe("chess helpers", () => {
  it("normalizes IPv4 and IPv6 /64 prefixes consistently", () => {
    expect(normalizeIpPrefix("203.0.113.10")).toBe("203.0.113.10");
    expect(normalizeIpPrefix("203.0.113.10:54321")).toBe("203.0.113.10");
    expect(normalizeIpPrefix("::ffff:203.0.113.10")).toBe("203.0.113.10");
    expect(normalizeIpPrefix("[2001:db8:1:2::1]")).toBe("2001:0db8:0001:0002");
    expect(normalizeIpPrefix("2001:0db8:0001:0002:abcd:ef01:2345:6789")).toBe(
      "2001:0db8:0001:0002",
    );
    expect(normalizeIpPrefix("2001:db8::1%eth0")).toBe("2001:0db8:0000:0000");
    expect(normalizeIpPrefix("2001:db8:0:0:ffff::99")).toBe("2001:0db8:0000:0000");
  });

  it("hashes visitor IDs and IPs with separate namespaces", () => {
    process.env.CHESS_HASH_SALT = "unit-test-salt";
    const v1 = hashVisitorId("11111111-1111-4111-8111-111111111111");
    const v2 = hashVisitorId("22222222-2222-4222-8222-222222222222");
    expect(v1).not.toBe(v2);
    expect(v1).toHaveLength(64);

    const ipA = hashChessIp("2001:db8:abcd:1::1");
    const ipB = hashChessIp("2001:db8:abcd:1:9999::2");
    const ipC = hashChessIp("2001:db8:abcd:2::1");
    expect(ipA).toBe(ipB);
    expect(ipA).not.toBe(ipC);
  });

  it("URL-decodes Vercel geo headers and handles missing values", () => {
    const h1 = new Headers({
      "x-vercel-ip-city": "Quezon%20City",
      "x-vercel-ip-country": "PH",
    });
    expect(geoFromHeaders(h1)).toEqual({ city: "Quezon City", country: "PH" });

    const h2 = new Headers();
    expect(geoFromHeaders(h2)).toEqual({ city: null, country: null });
  });

  it("matches ETags properly", () => {
    const etag = formatEtag(3, 15);
    expect(etag).toBe('"g3-v15"');
    expect(matchesIfNoneMatch('"g3-v15"', etag)).toBe(true);
    expect(matchesIfNoneMatch('W/"g3-v15"', etag)).toBe(true);
    expect(matchesIfNoneMatch('"g3-v14", "g3-v15"', etag)).toBe(true);
    expect(matchesIfNoneMatch('"g3-v14"', etag)).toBe(false);
    expect(matchesIfNoneMatch(null, etag)).toBe(false);
  });
});
