export function calculateCouponDiscount(coupon: { discountType: "percentage" | "fixed"; discountValue: number; maxDiscount?: number | null }, subtotal: number) {
  const raw = coupon.discountType === "percentage"
    ? subtotal * coupon.discountValue / 100
    : coupon.discountValue;
  const capped = coupon.maxDiscount !== undefined && coupon.maxDiscount !== null ? Math.min(raw, coupon.maxDiscount) : raw;
  return Math.min(subtotal, Math.max(0, Math.round((capped + Number.EPSILON) * 100) / 100));
}
