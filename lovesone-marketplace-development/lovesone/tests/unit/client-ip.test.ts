import { describe, expect, it } from "vitest";
import { getTrustedClientIp } from "../../src/lib/client-ip";

describe("getTrustedClientIp", () => {
  it("prefers Vercel's trusted client IP header", () => {
    const headers = new Headers({
      "x-vercel-forwarded-for": "203.0.113.10",
      "x-forwarded-for": "198.51.100.20"
    });
    expect(getTrustedClientIp(headers)).toBe("203.0.113.10");
  });

  it("uses the first forwarded IP when running behind a trusted proxy", () => {
    const headers = new Headers({ "x-forwarded-for": "2001:db8::1, 198.51.100.20" });
    expect(getTrustedClientIp(headers)).toBe("2001:db8::1");
  });

  it("ignores invalid or missing IP headers", () => {
    expect(getTrustedClientIp(new Headers({ "x-vercel-forwarded-for": "not-an-ip" }))).toBeNull();
    expect(getTrustedClientIp(new Headers())).toBeNull();
  });
});
