export type PaymentStatus = "pending" | "initiated" | "paid" | "failed" | "cancelled" | "refunded";

const transitions: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ["initiated", "failed", "cancelled"],
  initiated: ["paid", "failed", "cancelled"],
  paid: ["refunded"],
  failed: ["initiated", "cancelled"],
  cancelled: [],
  refunded: []
};

export function canTransitionPaymentStatus(current: string, next: PaymentStatus): boolean {
  return (transitions[current as PaymentStatus] ?? []).includes(next);
}

export function isVerifiedSslCommerzPayment(input: {
  status?: string;
  tranId?: string;
  expectedTranId: string;
  amount?: string | number;
  expectedAmount: number;
  currency?: string;
  expectedCurrency?: string;
}): boolean {
  const amount = typeof input.amount === "number" ? input.amount : Number(input.amount);
  const expectedCurrency = (input.expectedCurrency ?? "BDT").toUpperCase();
  return ["VALID", "VALIDATED"].includes((input.status ?? "").toUpperCase()) &&
    Boolean(input.tranId) &&
    input.tranId === input.expectedTranId &&
    Number.isFinite(amount) &&
    Math.round(amount * 100) === Math.round(input.expectedAmount * 100) &&
    (input.currency ?? "").toUpperCase() === expectedCurrency;
}

export function createPaymentTransactionId(): string {
  return `LVS-${crypto.randomUUID().replace(/-/g, "").slice(0, 24).toUpperCase()}`;
}
