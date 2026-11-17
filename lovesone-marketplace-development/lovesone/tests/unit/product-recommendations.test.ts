import { describe, expect, it } from "vitest";
import { parseRecentProductIds } from "../../src/lib/product-recommendations";

describe("parseRecentProductIds", () => {
  it("keeps valid unique ids in their most-recent-first order", () => {
    expect(parseRecentProductIds("aaaaaaaaaaaaaaaaaaaaaaaa,BBBBBBBBBBBBBBBBBBBBBBBB,aaaaaaaaaaaaaaaaaaaaaaaa"))
      .toEqual(["aaaaaaaaaaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbbbbbbbbbb"]);
  });

  it("ignores malformed ids and caps the result at eight", () => {
    const ids = Array.from({ length: 10 }, (_, index) => index.toString(16).padStart(24, "a")).join(",");
    expect(parseRecentProductIds("bad," + ids)).toHaveLength(8);
  });

  it("returns an empty list for missing or empty input", () => {
    expect(parseRecentProductIds(null)).toEqual([]);
    expect(parseRecentProductIds("")).toEqual([]);
  });
});
