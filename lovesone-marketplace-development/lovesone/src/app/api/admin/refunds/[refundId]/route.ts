import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { auth } from "../../../../../../auth";
import { connectDatabase } from "@/lib/db";
import { enforceUserRateLimit } from "@/lib/api-rate-limit";
import { Order } from "@/models/Order";
import { PaymentTransaction } from "@/models/PaymentTransaction";
import { Refund } from "@/models/Refund";
import { canTransitionRefundStatus, type RefundStatus } from "@/lib/payments/refund-state";

const schema = z.object({
  status: z.enum(["approved", "rejected", "processing", "paid"]),
  adminNote: z.string().trim().max(500).optional(),
  payoutReference: z.string().trim().min(3).max(120).optional()
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ refundId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!["admin", "super-admin"].includes(session.user.role)) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

    const { refundId } = await context.params;
    if (!mongoose.isValidObjectId(refundId)) return NextResponse.json({ error: "Invalid refund ID." }, { status: 400 });
    const body: unknown = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid refund review.", issues: parsed.error.issues }, { status: 400 });
    if (parsed.data.status === "paid" && !parsed.data.payoutReference) {
      return NextResponse.json({ error: "A verified external payout reference is required before marking a refund paid." }, { status: 400 });
    }

    await connectDatabase();
    const limited = await enforceUserRateLimit("admin-refund-review", session.user.id, 60, 60 * 60 * 1000);
    if (limited) return limited;

    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        const refund = await Refund.findById(refundId).session(dbSession);
        if (!refund) throw new Error("REFUND_NOT_FOUND");
        const nextStatus = parsed.data.status as RefundStatus;
        if (!canTransitionRefundStatus(refund.status as RefundStatus, nextStatus)) throw new Error("INVALID_REFUND_TRANSITION");

        if (nextStatus === "rejected") {
          const released = await Order.updateOne(
            { _id: refund.orderId, refundReservedAmount: { $gte: refund.amount } },
            { $inc: { refundReservedAmount: -refund.amount } },
            { session: dbSession }
          );
          if (released.modifiedCount !== 1) throw new Error("REFUND_RESERVATION_MISSING");
        }

        if (nextStatus === "paid") {
          const order = await Order.findOneAndUpdate(
            { _id: refund.orderId, refundReservedAmount: { $gte: refund.amount } },
            { $inc: { refundReservedAmount: -refund.amount, refundedAmount: refund.amount } },
            { new: true, session: dbSession }
          );
          if (!order) throw new Error("REFUND_RESERVATION_MISSING");

          if (refund.paymentTransactionId) {
            const payment = await PaymentTransaction.findById(refund.paymentTransactionId).session(dbSession);
            if (!payment || !["paid", "partially_refunded"].includes(payment.status)) throw new Error("PAYMENT_NOT_REFUNDABLE");
            const nextRefunded = Math.round((Number(payment.refundedAmount || 0) + refund.amount) * 100) / 100;
            if (nextRefunded > Number(payment.amount)) throw new Error("REFUND_LIMIT_EXCEEDED");
            payment.refundedAmount = nextRefunded;
            payment.status = nextRefunded === Number(payment.amount) ? "refunded" : "partially_refunded";
            await payment.save({ session: dbSession });
          }
        }

        refund.status = nextStatus;
        refund.adminNote = parsed.data.adminNote || refund.adminNote || "";
        refund.reviewedBy = session.user.id;
        refund.reviewedAt = new Date();
        if (parsed.data.payoutReference) refund.payoutReference = parsed.data.payoutReference;
        if (nextStatus === "paid") refund.paidAt = new Date();
        await refund.save({ session: dbSession });
      });
    } finally {
      await dbSession.endSession();
    }

    return NextResponse.json({ message: `Refund ${parsed.data.status}.` });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "REFUND_NOT_FOUND") return NextResponse.json({ error: "Refund request not found." }, { status: 404 });
      if (error.message === "INVALID_REFUND_TRANSITION") return NextResponse.json({ error: "This refund cannot move to the requested state." }, { status: 409 });
      if (error.message === "REFUND_RESERVATION_MISSING") return NextResponse.json({ error: "Refund reservation is missing or already settled." }, { status: 409 });
      if (error.message === "PAYMENT_NOT_REFUNDABLE" || error.message === "REFUND_LIMIT_EXCEEDED") return NextResponse.json({ error: "The associated payment cannot accept this refund." }, { status: 409 });
    }
    console.error("Admin refund review failed", error);
    return NextResponse.json({ error: "Unable to update refund request." }, { status: 500 });
  }
}
