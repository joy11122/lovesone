import { describe, expect, it } from "vitest";
import { aggregateParentOrderStatus, calculateSubOrderFinancials, canCustomerCancelOrder, canTransitionVendorOrder, shouldReReviewProduct } from "../../src/lib/order-workflow";

describe("vendor order transitions", () => {
  it("allows only forward fulfillment transitions and pre-shipment cancellation", () => {
    expect(canTransitionVendorOrder("pending", "processing")).toBe(true);
    expect(canTransitionVendorOrder("processing", "shipped")).toBe(true);
    expect(canTransitionVendorOrder("shipped", "delivered")).toBe(true);
    expect(canTransitionVendorOrder("pending", "shipped")).toBe(false);
    expect(canTransitionVendorOrder("shipped", "cancelled")).toBe(false);
    expect(canTransitionVendorOrder("delivered", "processing")).toBe(false);
  });

  it("aggregates multi-vendor status without marking partial fulfillment complete", () => {
    expect(aggregateParentOrderStatus(["delivered", "delivered"])).toBe("delivered");
    expect(aggregateParentOrderStatus(["cancelled", "cancelled"])).toBe("cancelled");
    expect(aggregateParentOrderStatus(["shipped", "pending"])).toBe("partially_shipped");
    expect(aggregateParentOrderStatus(["delivered", "pending"])).toBe("partially_delivered");
    expect(aggregateParentOrderStatus(["delivered", "cancelled"])).toBe("partially_cancelled");
  });
});

describe("customer cancellation and product re-review", () => {
  it("allows COD cancellation only before any seller has shipped", () => {
    expect(canCustomerCancelOrder(["pending", "processing"], "pending")).toBe(true);
    expect(canCustomerCancelOrder(["cancelled", "pending"], "pending")).toBe(true);
    expect(canCustomerCancelOrder(["shipped", "pending"], "pending")).toBe(false);
    expect(canCustomerCancelOrder(["delivered"], "pending")).toBe(false);
    expect(canCustomerCancelOrder(["pending"], "paid")).toBe(false);
  });

  it("sends changed active or rejected listings back to moderation", () => {
    expect(shouldReReviewProduct("active", true)).toBe(true);
    expect(shouldReReviewProduct("rejected", true)).toBe(true);
    expect(shouldReReviewProduct("pending-review", true)).toBe(false);
    expect(shouldReReviewProduct("active", false)).toBe(false);
  });
});


describe("order financial totals", () => {
  it("preserves the original order value and calculates the remaining payable total", () => {
    const totals = calculateSubOrderFinancials([
      { status: "delivered", items: [{ quantity: 2, unitPrice: 125 }] },
      { status: "cancelled", items: [{ quantity: 1, lineTotal: 75 }] }
    ]);

    expect(totals).toEqual({
      originalTotal: 325,
      cancelledTotal: 75,
      payableTotal: 250
    });
  });

  it("does not create negative payable totals from malformed historical line values", () => {
    const totals = calculateSubOrderFinancials([
      { status: "cancelled", items: [{ quantity: 1, lineTotal: 100 }] },
      { status: "pending", items: [{ quantity: 1, lineTotal: Number.NaN }] }
    ]);

    expect(totals).toEqual({
      originalTotal: 100,
      cancelledTotal: 100,
      payableTotal: 0
    });
  });
});
