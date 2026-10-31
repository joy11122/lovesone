export type VendorOrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

const transitions: Record<VendorOrderStatus, VendorOrderStatus[]> = {
  pending: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: []
};

export function canTransitionVendorOrder(current: string, next: VendorOrderStatus): boolean {
  return (transitions[current as VendorOrderStatus] ?? []).includes(next);
}

export function aggregateParentOrderStatus(statuses: string[]): string {
  if (!statuses.length || statuses.every((status) => status === "pending")) return "pending";
  if (statuses.every((status) => status === "delivered")) return "delivered";
  if (statuses.every((status) => status === "cancelled")) return "cancelled";
  if (statuses.every((status) => status === "delivered" || status === "cancelled")) return "partially_cancelled";
  if (statuses.some((status) => status === "delivered")) return "partially_delivered";
  if (statuses.some((status) => status === "shipped")) return "partially_shipped";
  if (statuses.some((status) => status === "processing")) return "processing";
  if (statuses.some((status) => status === "cancelled")) return "partially_cancelled";
  return "pending";
}

export function canCustomerCancelOrder(statuses: string[], paymentStatus: string): boolean {
  return paymentStatus === "pending" &&
    statuses.some((status) => status !== "cancelled") &&
    statuses.every((status) => ["pending", "processing", "cancelled"].includes(status));
}

export function shouldReReviewProduct(currentStatus: string, contentChanged: boolean): boolean {
  return contentChanged && (currentStatus === "active" || currentStatus === "rejected");
}
