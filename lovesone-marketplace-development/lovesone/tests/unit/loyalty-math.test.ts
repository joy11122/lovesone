import { describe, expect, it } from "vitest";
import { calculateLoyaltyPoints } from "../../src/lib/loyalty-math";

describe("loyalty point calculation", () => {
  it("awards one point for each completed ৳100", () => {
    expect(calculateLoyaltyPoints(100)).toBe(1);
    expect(calculateLoyaltyPoints(999)).toBe(9);
    expect(calculateLoyaltyPoints(1000)).toBe(10);
  });

  it("does not award a point for an order below ৳100", () => {
    expect(calculateLoyaltyPoints(99.99)).toBe(0);
  });

  it("rejects zero, negative and non-finite totals", () => {
    expect(calculateLoyaltyPoints(0)).toBe(0);
    expect(calculateLoyaltyPoints(-100)).toBe(0);
    expect(calculateLoyaltyPoints(Number.NaN)).toBe(0);
    expect(calculateLoyaltyPoints(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
