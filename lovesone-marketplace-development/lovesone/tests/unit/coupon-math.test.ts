import { describe, expect, it } from "vitest";
import { calculateCouponDiscount } from "../../src/lib/coupon-math";

describe("coupon discount calculation", () => {
  it("calculates percentage discounts and rounds to cents", () => {
    expect(calculateCouponDiscount({ discountType: "percentage", discountValue: 15 }, 999)).toBe(149.85);
  });

  it("caps percentage discounts at the configured maximum", () => {
    expect(calculateCouponDiscount({ discountType: "percentage", discountValue: 25, maxDiscount: 100 }, 1000)).toBe(100);
  });

  it("caps fixed discounts at the order subtotal", () => {
    expect(calculateCouponDiscount({ discountType: "fixed", discountValue: 500 }, 125)).toBe(125);
  });

  it("supports fixed discounts and preserves two-decimal precision", () => {
    expect(calculateCouponDiscount({ discountType: "fixed", discountValue: 25.555 }, 100)).toBe(25.56);
  });
});
