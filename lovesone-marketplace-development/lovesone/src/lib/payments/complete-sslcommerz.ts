import "server-only";

import mongoose from "mongoose";
import { connectDatabase } from "@/lib/db";
import { Order } from "@/models/Order";
import { PaymentTransaction } from "@/models/PaymentTransaction";
import { isVerifiedSslCommerzPayment } from "@/lib/payments/payment-state";
import { validateSslCommerzTransaction } from "@/lib/payments/sslcommerz";

export async function completeSslCommerzPayment(validationId: string, transactionId: string): Promise<{ orderId: string }> {
  if (!validationId || !transactionId) throw new Error("PAYMENT_CALLBACK_INVALID");
  await connectDatabase();

  const payment = await PaymentTransaction.findOne({ provider: "sslcommerz", transactionId })
    .select("orderId amount currency status")
    .lean() as unknown as { orderId: unknown; amount: number; currency: string; status: string } | null;
  if (!payment) throw new Error("PAYMENT_NOT_FOUND");

  const validation = await validateSslCommerzTransaction(validationId);
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
      if (transaction.status !== "initiated" ||
          order.paymentMethod !== "sslcommerz" ||
          order.paymentStatus !== "pending" ||
          order.status !== "pending" ||
          order.paymentAttemptId !== transactionId) {
        throw new Error("PAYMENT_NOT_PENDING");
      }

      transaction.status = "paid";
      transaction.validationId = validation.val_id || validationId;
      transaction.bankTransactionId = validation.bank_tran_id || null;
      transaction.verifiedAt = new Date();
      await transaction.save({ session });

      order.paymentStatus = "paid";
      order.paymentAttemptId = null;
      await order.save({ session });
      completedOrderId = String(order._id);
    });
  } finally {
    await session.endSession();
  }

  if (!completedOrderId) throw new Error("PAYMENT_COMPLETION_FAILED");
  return { orderId: completedOrderId };
}
