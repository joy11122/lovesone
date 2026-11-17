/**
 * LOVESONE awards one loyalty point for every completed ৳100 of eligible
 * order value. The amount passed here is the final post-discount order total.
 */
export function calculateLoyaltyPoints(orderTotal: number): number {
  if (!Number.isFinite(orderTotal) || orderTotal <= 0) return 0;
  return Math.floor((orderTotal + Number.EPSILON) / 100);
}
