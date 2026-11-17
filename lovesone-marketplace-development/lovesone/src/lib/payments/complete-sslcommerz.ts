import "server-only";

import mongoose from "mongoose";
import { connectDatabase } from "@/lib/db";
import { Order } from "@/models/Order";
import { PaymentTransaction } from "@/models/PaymentTransaction";
import { isVerifiedSslCommerzPayment } from "@/lib/payments/payment-state";
import { querySslCommerzTransaction, validateSslCommerzTransaction } from "@/lib/payments/sslcommerz";

export async function completeSslCommerzPayment(validationId: string, transactionId: string): Promise<{ orderId: string; reviewRequired?: boolean }> {
  if (!validationId || !transactionId) throw new Error("PAYMENT_CALLBACK_INVALID");
  await connectDatabase();

  const payment = await PaymentTransaction.findOne({ provider: "sslcommerz", transactionId })
    .select("orderId amount currency status")
    .lean() as unknown as { orderId: unknown; amount: number; currency: string; status: string } | null;
  if (!payment) throw new Error("PAYMENT_NOT_FOUND");

  const validation = await validateSslCommerzTransaction(validationId);
  if (validation.val_id && validation.val_id !== validationId) throw new Error("PAYMENT_VALIDATION_ID_MISMATCH");
  if (!isVerifiedSslCommerzPayment({
    status: validation.status,
    tranId: validation.tran_id,
    expectedTranId: transactionId,
    amount: validation.amount,
    expectedAmount: payment.amount,
    currency: validation.currency,
    expectedCurrency: payment.currency
  })) {
    throw new Error("PAYMENT_VALIDATION_FAILED");
  }

  const session = await mongoose.startSession();
  let completedOrderId = "";
  let reviewRequired = false;
  try {
    await session.withTransaction(async () => {
      const transaction = await PaymentTransaction.findOne({ provider: "sslcommerz", transactionId }).session(session);
      const order = transaction
        ? await Order.findById(transaction.orderId).session(session)
        : null;
      if (!transaction || !order) throw new Error("PAYMENT_NOT_FOUND");

      if (transaction.status === "paid" && order.paymentStatus === "paid") {
        completedOrderId = String(order._id);
        return;
      }
      if (transaction.status === "review" && order.paymentStatus === "review") {
        completedOrderId = String(order._id);
        reviewRequired = true;
        return;
      }
      if (transaction.status !== "initiated" ||
          order.paymentMethod !== "sslcommerz" ||
          order.paymentStatus !== "pending" ||
          order.status !== "pending" ||
          order.paymentAttemptId !== transactionId) {
        throw new Error("PAYMENT_NOT_PENDING");
      }

      transaction.validationId = validation.val_id || validationId;
      transaction.bankTransactionId = validation.bank_tran_id || null;
      transaction.verifiedAt = new Date();
      if (Number(validation.risk_level) === 1) {
        transaction.status = "review";
        order.paymentStatus = "review";
        reviewRequired = true;
      } else {
        transaction.status = "paid";
        order.paymentStatus = "paid";
      }
      order.paymentAttemptId = null;
      await transaction.save({ session });
      await order.save({ session });
      completedOrderId = String(order._id);
    });
  } finally {
    await session.endSession();
  }

  if (!completedOrderId) throw new Error("PAYMENT_COMPLETION_FAILED");
  return { orderId: completedOrderId, ...(reviewRequired ? { reviewRequired: true } : {}) };
}

/**
 * Reconciles a browser fail/cancel redirect or a stale payment attempt against
 * the provider's server-side transaction query API. Never trusts redirect data.
 */
export async function reconcileSslCommerzAttempt(transactionId: string): Promise<"paid" | "review" | "failed" | "cancelled" | "not_found" | "pending"> {
  if (!transactionId) throw new Error("PAYMENT_CALLBACK_INVALID");
  await connectDatabase();
  const transaction = await PaymentTransaction.findOne({ provider: "sslcommerz", transactionId })
    .select("orderId status")
    .lean() as unknown as { orderId: unknown; status: string } | null;
  if (!transaction) return "not_found";
  if (transaction.status === "paid") return "paid";

  const result = await querySslCommerzTransaction(transactionId);
  if (result.APIConnect !== "DONE") throw new Error("PAYMENT_QUERY_FAILED");
  const providerTransaction = result.element?.find((entry) => entry.tran_id === transactionId);
  if (!providerTransaction) return Number(result.no_of_trans_found) === 0 ? "not_found" : "pending";

  const providerStatus = (providerTransaction.status ?? "").toUpperCase();
  if (["VALID", "VALIDATED"].includes(providerStatus) && providerTransaction.val_id) {
    const completion = await completeSslCommerzPayment(providerTransaction.val_id, transactionId);
    return completion.reviewRequired ? "review" : "paid";
  }

  if (["FAILED", "CANCEL", "CANCELLED"].includes(providerStatus)) {
    const nextStatus = providerStatus === "FAILED" ? "failed" : "cancelled";
    await PaymentTransaction.updateOne(
      { provider: "sslcommerz", transactionId, status: { $in: ["pending", "initiated"] } },
      { $set: { status: nextStatus } }
    );
    await Order.updateOne(
      { _id: transaction.orderId, paymentAttemptId: transactionId, paymentStatus: "pending" },
      { $set: { paymentAttemptId: null } }
    );
    return nextStatus;
  }

  return "pending";
}
