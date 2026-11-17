import { randomUUID } from "node:crypto";

export type PaymentStatus = "pending" | "initiated" | "paid" | "failed" | "cancelled" | "review" | "refunded";

const transitions: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ["initiated", "failed", "cancelled"],
  initiated: ["paid", "failed", "cancelled", "review"],
  paid: ["refunded"],
  failed: ["initiated", "cancelled"],
  cancelled: [],
  review: ["paid", "failed"],
  refunded: []
};

export function isValidSslCommerzAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount >= 10 && amount <= 500000;
}

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
  riskLevel?: string | number;
}): boolean {
  const amount = typeof input.amount === "number" ? input.amount : Number(input.amount);
  const expectedCurrency = (input.expectedCurrency ?? "BDT").toUpperCase();
  return ["VALID", "VALIDATED"].includes((input.status ?? "").toUpperCase()) &&
    Boolean(input.tranId) &&
    input.tranId === input.expectedTranId &&
    Number.isFinite(amount) &&
    Math.round(amount * 100) === Math.round(input.expectedAmount * 100) &&
    (input.currency ?? "").toUpperCase() === expectedCurrency &&
    [0, 1].includes(Number(input.riskLevel));
}

export function createPaymentTransactionId(): string {
  return `LVS-${randomUUID().replace(/-/g, "").slice(0, 24).toUpperCase()}`;
}
