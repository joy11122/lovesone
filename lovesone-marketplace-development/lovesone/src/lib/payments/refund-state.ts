export type RefundStatus = "requested" | "approved" | "rejected" | "processing" | "paid";

export function calculateRefundAmount(input: {
  paidAmount: number;
  previouslyRefunded: number;
  requestedAmount: number;
}): number | null {
  const { paidAmount, previouslyRefunded, requestedAmount } = input;
  if (![paidAmount, previouslyRefunded, requestedAmount].every(Number.isFinite)) return null;
  const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const paid = round(paidAmount);
  const refunded = round(previouslyRefunded);
  const requested = round(requestedAmount);
  const remaining = round(paid - refunded);
  if (paid <= 0 || refunded < 0 || requested <= 0 || remaining <= 0 || requested > remaining) return null;
  return requested;
}

export function getPaymentStatusAfterRefund(input: {
  paidAmount: number;
  previouslyRefunded: number;
  newlyRefunded: number;
}): "paid" | "partially_refunded" | "refunded" | null {
  const { paidAmount, previouslyRefunded, newlyRefunded } = input;
  if (![paidAmount, previouslyRefunded, newlyRefunded].every(Number.isFinite)) return null;
  const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const totalPaid = round(paidAmount);
  const totalRefunded = round(previouslyRefunded + newlyRefunded);
  if (totalPaid <= 0 || previouslyRefunded < 0 || newlyRefunded <= 0 || totalRefunded > totalPaid) return null;
  if (totalRefunded === totalPaid) return "refunded";
  return totalRefunded > 0 ? "partially_refunded" : "paid";
}

export function canTransitionRefundStatus(current: RefundStatus, next: RefundStatus): boolean {
  const transitions: Record<RefundStatus, RefundStatus[]> = {
    requested: ["approved", "rejected"],
    approved: ["processing", "paid"],
    rejected: [],
    processing: ["paid", "rejected"],
    paid: []
  };
  return transitions[current].includes(next);
}
