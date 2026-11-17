import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { auth } from "../../../../../../auth";
import { connectDatabase } from "@/lib/db";
import { enforceUserRateLimit } from "@/lib/api-rate-limit";
import { Order } from "@/models/Order";
import { PaymentTransaction } from "@/models/PaymentTransaction";
import { Refund } from "@/models/Refund";

const schema = z.object({
  amount: z.number().finite().positive().max(1_000_000),
  method: z.enum(["bank_transfer", "mobile_financial_service", "cod_cash"]),
  reason: z.string().trim().min(5).max(500)
});

export async function POST(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Please sign in to request a refund." }, { status: 401 });
    if (session.user.role !== "customer") return NextResponse.json({ error: "Customer accounts only." }, { status: 403 });

    const { orderId } = await context.params;
    if (!mongoose.isValidObjectId(orderId)) return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });

    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 120) {
      return NextResponse.json({ error: "A valid Idempotency-Key header is required." }, { status: 400 });
    }

    const body: unknown = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid refund request.", issues: parsed.error.issues }, { status: 400 });

    await connectDatabase();
    const limited = await enforceUserRateLimit("customer-refund-request", session.user.id, 5, 24 * 60 * 60 * 1000);
    if (limited) return limited;

    const prior = await Refund.findOne({ customerId: session.user.id, idempotencyKey }).lean() as unknown as { _id: unknown; status: string; amount: number } | null;
    if (prior) return NextResponse.json({ message: "Refund request already received.", refund: { id: String(prior._id), status: prior.status, amount: prior.amount } });

    const dbSession = await mongoose.startSession();
    let created: { id: string; amount: number; status: string } | null = null;
    try {
      await dbSession.withTransaction(async () => {
        const order = await Order.findOne({ _id: orderId, customerId: session.user.id }).session(dbSession);
        if (!order) throw new Error("ORDER_NOT_FOUND");
        if (order.status !== "delivered" || order.returnRequest?.status !== "approved") {
          throw new Error("RETURN_NOT_APPROVED");
        }
        if (order.paymentMethod === "sslcommerz" && order.paymentStatus !== "paid" && order.paymentStatus !== "partially_refunded") {
          throw new Error("PAYMENT_NOT_SETTLED");
        }
        const amount = Math.round(parsed.data.amount * 100) / 100;
        const payment = order.paymentMethod === "sslcommerz"
          ? await PaymentTransaction.findOne({ orderId: order._id, customerId: session.user.id, provider: "sslcommerz", status: { $in: ["paid", "partially_refunded"] } }).sort({ createdAt: -1 }).session(dbSession)
          : null;
        if (order.paymentMethod === "sslcommerz" && !payment) throw new Error("PAYMENT_NOT_FOUND");

        const paidAmount = payment ? Number(payment.amount) : Number(order.total);
        const reserved = await Order.findOneAndUpdate(
          {
            _id: order._id,
            customerId: session.user.id,
            status: "delivered",
            "returnRequest.status": "approved",
            $expr: {
              $lte: [
                { $add: [{ $ifNull: ["$refundedAmount", 0] }, { $ifNull: ["$refundReservedAmount", 0] }, amount] },
                paidAmount
              ]
            }
          },
          { $inc: { refundReservedAmount: amount } },
          { new: true, session: dbSession }
        );
        if (!reserved) throw new Error("REFUND_LIMIT_EXCEEDED");

        const refund = new Refund({
          orderId: order._id,
          paymentTransactionId: payment?._id ?? null,
          customerId: session.user.id,
          amount,
          currency: "BDT",
          method: parsed.data.method,
          status: "requested",
          reason: parsed.data.reason,
          idempotencyKey
        });
        await refund.save({ session: dbSession });
        created = { id: String(refund._id), amount, status: refund.status };
      });
    } finally {
      await dbSession.endSession();
    }

    if (!created) return NextResponse.json({ error: "Unable to create refund request." }, { status: 500 });
    return NextResponse.json({ message: "Refund request submitted for administrator review.", refund: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "ORDER_NOT_FOUND") return NextResponse.json({ error: "Order not found." }, { status: 404 });
      if (error.message === "RETURN_NOT_APPROVED") return NextResponse.json({ error: "An approved return request is required before requesting a refund." }, { status: 409 });
      if (error.message === "PAYMENT_NOT_SETTLED" || error.message === "PAYMENT_NOT_FOUND") return NextResponse.json({ error: "The related payment is not eligible for a refund." }, { status: 409 });
      if (error.message === "REFUND_LIMIT_EXCEEDED") return NextResponse.json({ error: "The requested amount exceeds the remaining refundable balance." }, { status: 409 });
      if ("code" in error && error.code === 11000) return NextResponse.json({ error: "This refund request was already submitted." }, { status: 409 });
    }
    console.error("Customer refund request failed", error);
    return NextResponse.json({ error: "Unable to submit refund request right now." }, { status: 500 });
  }
}
