import { describe, expect, it } from "vitest";
import { aggregateParentOrderStatus, canTransitionVendorOrder } from "../../src/lib/order-workflow";

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
