import { describe, expect, it } from "vitest";
import { canTransitionPaymentStatus, isValidSslCommerzAmount, isVerifiedSslCommerzPayment } from "../../src/lib/payments/payment-state";

describe("payment status transitions", () => {
  it("allows only safe forward payment transitions", () => {
    expect(canTransitionPaymentStatus("pending", "initiated")).toBe(true);
    expect(canTransitionPaymentStatus("initiated", "paid")).toBe(true);
    expect(canTransitionPaymentStatus("initiated", "failed")).toBe(true);
    expect(canTransitionPaymentStatus("initiated", "review")).toBe(true);
    expect(canTransitionPaymentStatus("review", "paid")).toBe(true);
    expect(canTransitionPaymentStatus("paid", "failed")).toBe(false);
    expect(canTransitionPaymentStatus("refunded", "paid")).toBe(false);
    expect(canTransitionPaymentStatus("unknown", "paid")).toBe(false);
  });
});

describe("SSLCommerz validation matching", () => {
  const expected = { expectedTranId: "LVS-ABC123", expectedAmount: 1250.5, expectedCurrency: "BDT" };

  it("accepts only a valid matching transaction, amount and currency", () => {
    expect(isVerifiedSslCommerzPayment({ ...expected, status: "VALID", tranId: "LVS-ABC123", amount: "1250.50", currency: "BDT" })).toBe(true);
    expect(isVerifiedSslCommerzPayment({ ...expected, status: "VALIDATED", tranId: "LVS-ABC123", amount: 1250.5, currency: "bdt" })).toBe(true);
  });

  it("rejects invalid status, transaction, amount and currency", () => {
    expect(isVerifiedSslCommerzPayment({ ...expected, status: "FAILED", tranId: "LVS-ABC123", amount: "1250.50", currency: "BDT" })).toBe(false);
    expect(isVerifiedSslCommerzPayment({ ...expected, status: "VALID", tranId: "OTHER", amount: "1250.50", currency: "BDT" })).toBe(false);
    expect(isVerifiedSslCommerzPayment({ ...expected, status: "VALID", tranId: "LVS-ABC123", amount: "1.00", currency: "BDT" })).toBe(false);
    expect(isVerifiedSslCommerzPayment({ ...expected, status: "VALID", tranId: "LVS-ABC123", amount: "1250.50", currency: "USD" })).toBe(false);
    expect(isVerifiedSslCommerzPayment({ ...expected, status: "VALID", tranId: "LVS-ABC123", amount: "not-a-number", currency: "BDT" })).toBe(false);
  });
});

describe("SSLCommerz amount limits", () => {
  it("accepts the documented BDT range only", () => {
    expect(isValidSslCommerzAmount(10)).toBe(true);
    expect(isValidSslCommerzAmount(500000)).toBe(true);
    expect(isValidSslCommerzAmount(9.99)).toBe(false);
    expect(isValidSslCommerzAmount(500000.01)).toBe(false);
    expect(isValidSslCommerzAmount(Number.NaN)).toBe(false);
  });
});
