import { describe, expect, it } from "vitest";
import { allocateVendorRefundShares, calculateVendorSettlementAmounts } from "../../src/lib/payments/vendor-settlement";

describe("vendor settlement calculations", () => {
  it("calculates commission from the vendor balance after allocated refunds", () => {
    expect(calculateVendorSettlementAmounts(1000, 100, 1000)).toEqual({
      grossAmount: 1000, refundShare: 100, commissionBps: 1000, commissionAmount: 90, netAmount: 810
    });
  });

  it("rejects invalid amounts and commission rates", () => {
    expect(calculateVendorSettlementAmounts(100, 101, 1000)).toBeNull();
    expect(calculateVendorSettlementAmounts(100, 0, 10001)).toBeNull();
    expect(calculateVendorSettlementAmounts(Number.NaN, 0, 0)).toBeNull();
  });

  it("allocates order refunds proportionally and conserves the exact refund total", () => {
    const shares = allocateVendorRefundShares([100, 200, 300], 10);
    expect(shares).toEqual([1.67, 3.33, 5]);
    expect(shares?.reduce((sum, amount) => sum + amount, 0)).toBe(10);
  });

  it("rejects refunds above gross vendor balances", () => {
    expect(allocateVendorRefundShares([100, 200], 301)).toBeNull();
  });
});
