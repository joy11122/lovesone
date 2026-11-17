import { describe, expect, it } from "vitest";
import { calculateRefundAmount, canTransitionRefundStatus, getPaymentStatusAfterRefund } from "../../src/lib/payments/refund-state";

describe("refund amount validation", () => {
  it("allows a valid partial or full refund within the remaining paid amount", () => {
    expect(calculateRefundAmount({ paidAmount: 1000, previouslyRefunded: 200, requestedAmount: 300 })).toBe(300);
    expect(calculateRefundAmount({ paidAmount: 1000, previouslyRefunded: 200, requestedAmount: 800 })).toBe(800);
  });

  it("rejects over-refunds, zero, negative, non-finite and already exhausted balances", () => {
    expect(calculateRefundAmount({ paidAmount: 1000, previouslyRefunded: 200, requestedAmount: 800.01 })).toBeNull();
    expect(calculateRefundAmount({ paidAmount: 1000, previouslyRefunded: 1000, requestedAmount: 1 })).toBeNull();
    expect(calculateRefundAmount({ paidAmount: 1000, previouslyRefunded: 0, requestedAmount: 0 })).toBeNull();
    expect(calculateRefundAmount({ paidAmount: 1000, previouslyRefunded: 0, requestedAmount: -1 })).toBeNull();
    expect(calculateRefundAmount({ paidAmount: Number.NaN, previouslyRefunded: 0, requestedAmount: 1 })).toBeNull();
  });
});

describe("payment state after refund", () => {
  it("distinguishes partial and full refunds", () => {
    expect(getPaymentStatusAfterRefund({ paidAmount: 1000, previouslyRefunded: 0, newlyRefunded: 250 })).toBe("partially_refunded");
    expect(getPaymentStatusAfterRefund({ paidAmount: 1000, previouslyRefunded: 250, newlyRefunded: 750 })).toBe("refunded");
  });

  it("rejects totals above the captured payment", () => {
    expect(getPaymentStatusAfterRefund({ paidAmount: 1000, previouslyRefunded: 900, newlyRefunded: 200 })).toBeNull();
  });
});

describe("refund workflow transitions", () => {
  it("allows review, processing and payout but prevents terminal-state replay", () => {
    expect(canTransitionRefundStatus("requested", "approved")).toBe(true);
    expect(canTransitionRefundStatus("approved", "processing")).toBe(true);
    expect(canTransitionRefundStatus("processing", "paid")).toBe(true);
    expect(canTransitionRefundStatus("paid", "paid")).toBe(false);
    expect(canTransitionRefundStatus("processing", "rejected")).toBe(true);
    expect(canTransitionRefundStatus("rejected", "approved")).toBe(false);
  });
});
