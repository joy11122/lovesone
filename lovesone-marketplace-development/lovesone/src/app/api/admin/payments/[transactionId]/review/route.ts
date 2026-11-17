import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "../../../../../../../auth";
import { connectDatabase } from "@/lib/db";
import { enforceUserRateLimit } from "@/lib/api-rate-limit";
import { Order } from "@/models/Order";
import { PaymentTransaction } from "@/models/PaymentTransaction";

export async function POST(request: NextRequest, context: { params: Promise<{ transactionId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (session.user.role !== "admin" && session.user.role !== "super-admin") {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }
  const { transactionId } = await context.params;
  if (!/^LVS-[A-Z0-9]{24}$/.test(transactionId)) {
    return NextResponse.json({ error: "Invalid payment transaction." }, { status: 400 });
  }
  const limited = await enforceUserRateLimit("admin-payment-review", session.user.id, 30, 60 * 60 * 1000);
  if (limited) return limited;

  try {
    await connectDatabase();
    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        const transaction = await PaymentTransaction.findOne({
          provider: "sslcommerz",
          transactionId,
          status: "review"
        }).session(dbSession);
        if (!transaction) throw new Error("PAYMENT_REVIEW_NOT_FOUND");
        const order = await Order.findOne({
          _id: transaction.orderId,
          paymentMethod: "sslcommerz",
          paymentStatus: "review",
          status: "pending"
        }).session(dbSession);
        if (!order) throw new Error("PAYMENT_REVIEW_ORDER_MISMATCH");

        transaction.status = "paid";
        transaction.reviewedAt = new Date();
        transaction.reviewedBy = session.user.id;
        await transaction.save({ session: dbSession });

        order.paymentStatus = "paid";
        order.paymentAttemptId = null;
        await order.save({ session: dbSession });
      });
    } finally {
      await dbSession.endSession();
    }
    return NextResponse.json({ message: "Payment approved. The order is now available for seller fulfilment." });
  } catch (error) {
    if (error instanceof Error && error.message === "PAYMENT_REVIEW_NOT_FOUND") {
      return NextResponse.json({ error: "This payment is no longer awaiting review." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "PAYMENT_REVIEW_ORDER_MISMATCH") {
      return NextResponse.json({ error: "The related order is not eligible for payment approval." }, { status: 409 });
    }
    console.error("Admin payment review failed", error);
    return NextResponse.json({ error: "Unable to approve this payment." }, { status: 500 });
  }
}
