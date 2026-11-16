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

export type OrderFinancialLine = {
  lineTotal?: number;
  unitPrice?: number;
  quantity: number;
};

export type OrderFinancialSubOrder = {
  status: string;
  items?: OrderFinancialLine[];
};

/** Computes immutable order value, cancelled value, and remaining COD payable. */
export function calculateSubOrderFinancials(subOrders: OrderFinancialSubOrder[]) {
  const lineValue = (line: OrderFinancialLine): number => {
    const value = typeof line.lineTotal === "number"
      ? line.lineTotal
      : Number(line.unitPrice ?? 0) * Number(line.quantity ?? 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  };
  const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const originalTotal = roundMoney(subOrders.reduce(
    (sum, subOrder) => sum + (subOrder.items ?? []).reduce((lineSum, line) => lineSum + lineValue(line), 0),
    0
  ));
  const cancelledTotal = roundMoney(subOrders
    .filter((subOrder) => subOrder.status === "cancelled")
    .reduce((sum, subOrder) => sum + (subOrder.items ?? []).reduce((lineSum, line) => lineSum + lineValue(line), 0), 0));
  return {
    originalTotal,
    cancelledTotal,
    payableTotal: roundMoney(Math.max(0, originalTotal - cancelledTotal))
  };
}

/** Paid/authorized orders require a verified refund path before cancellation. */
export function canVendorCancelOrder(paymentStatus: string): boolean {
  return paymentStatus === "pending";
}
