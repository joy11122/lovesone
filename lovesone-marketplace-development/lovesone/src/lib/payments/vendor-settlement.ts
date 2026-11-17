export type VendorSettlementAmounts = {
  grossAmount: number;
  refundShare: number;
  commissionBps: number;
  commissionAmount: number;
  netAmount: number;
};

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateVendorSettlementAmounts(
  grossAmount: number,
  refundShare: number,
  commissionBps: number
): VendorSettlementAmounts | null {
  if (
    !Number.isFinite(grossAmount) || !Number.isFinite(refundShare) ||
    !Number.isInteger(commissionBps) || grossAmount <= 0 ||
    refundShare < 0 || refundShare > grossAmount ||
    commissionBps < 0 || commissionBps > 10000
  ) return null;

  const distributable = money(grossAmount - refundShare);
  const commissionAmount = money(distributable * commissionBps / 10000);
  return {
    grossAmount: money(grossAmount),
    refundShare: money(refundShare),
    commissionBps,
    commissionAmount,
    netAmount: money(distributable - commissionAmount)
  };
}

/** Allocates a paid order-level refund proportionally; the last vendor absorbs rounding remainder. */
export function allocateVendorRefundShares(grossAmounts: number[], totalRefunded: number): number[] | null {
  if (
    !grossAmounts.length || grossAmounts.some((amount) => !Number.isFinite(amount) || amount < 0) ||
    !Number.isFinite(totalRefunded) || totalRefunded < 0
  ) return null;
  const totalGross = money(grossAmounts.reduce((sum, amount) => sum + amount, 0));
  if (totalRefunded > totalGross) return null;
  if (totalGross === 0) return totalRefunded === 0 ? grossAmounts.map(() => 0) : null;

  let remaining = money(totalRefunded);
  return grossAmounts.map((gross, index) => {
    const share = index === grossAmounts.length - 1
      ? remaining
      : Math.min(gross, money(totalRefunded * gross / totalGross));
    remaining = money(remaining - share);
    return money(share);
  });
}
