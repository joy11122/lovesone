import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { auth } from "../../../../../../auth";
import { connectDatabase } from "@/lib/db";
import { enforceUserRateLimit } from "@/lib/api-rate-limit";
import { getPaymentAppUrl, initiateSslCommerzSession, isSslCommerzConfigured } from "@/lib/payments/sslcommerz";
import { createPaymentTransactionId } from "@/lib/payments/payment-state";
import { reconcileSslCommerzAttempt } from "@/lib/payments/complete-sslcommerz";
import { Order } from "@/models/Order";
import { PaymentTransaction } from "@/models/PaymentTransaction";

const schema = z.object({ orderId: z.string().regex(/^[a-f0-9]{24}$/i) });

export async function POST(request: NextRequest) {
  let transactionId = "";
  let orderId = "";
  let customerId = "";
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Please sign in before paying." }, { status: 401 });
    if (session.user.role !== "customer") return NextResponse.json({ error: "Customer accounts only." }, { status: 403 });
    customerId = session.user.id;
    if (!session.user.email) return NextResponse.json({ error: "An email address is required for online payment." }, { status: 422 });

    const body: unknown = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid order reference." }, { status: 400 });
    orderId = parsed.data.orderId;

    if (!isSslCommerzConfigured()) {
      return NextResponse.json({ error: "Online payment is not configured yet. Please choose cash on delivery or contact support." }, { status: 503 });
    }

    await connectDatabase();
    const limited = await enforceUserRateLimit("payment-initiate", customerId, 5, 15 * 60 * 1000);
    if (limited) return limited;

    const order = await Order.findOne({ _id: orderId, customerId }).select("orderNumber total paymentMethod paymentStatus status paymentAttemptId shipping").lean() as unknown as {
      _id: unknown; orderNumber: string; total: number; paymentMethod: string; paymentStatus: string; status: string;
      paymentAttemptId?: string | null; shipping: { name: string; phone: string; address: string; city: string };
    } | null;
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.paymentMethod !== "sslcommerz") return NextResponse.json({ error: "This order is not configured for online payment." }, { status: 409 });
    if (order.paymentStatus === "paid") return NextResponse.json({ error: "This order has already been paid." }, { status: 409 });
    if (order.status !== "pending" || order.paymentStatus !== "pending") return NextResponse.json({ error: "This order is not eligible for payment." }, { status: 409 });

    if (order.paymentAttemptId) {
      const previousTransactionId = order.paymentAttemptId;
      const active = await PaymentTransaction.findOne({ transactionId: previousTransactionId, orderId }).select("gatewayUrl status createdAt").lean() as { gatewayUrl?: string; status?: string; createdAt?: Date } | null;
      const attemptAge = active?.createdAt ? Date.now() - new Date(active.createdAt).getTime() : 0;
      if (active?.status === "initiated" && active.gatewayUrl && attemptAge < 15 * 60 * 1000) {
        return NextResponse.json({ gatewayUrl: active.gatewayUrl, orderId });
      }
      if (active && ["pending", "initiated"].includes(active.status || "") && attemptAge < 15 * 60 * 1000) {
        return NextResponse.json({ error: "A payment attempt is already being prepared. Please wait and retry." }, { status: 409 });
      }
      if (active && ["pending", "initiated"].includes(active.status || "") && attemptAge >= 15 * 60 * 1000) {
        const providerStatus = await reconcileSslCommerzAttempt(previousTransactionId);
        if (providerStatus === "paid") return NextResponse.json({ orderId, paymentCompleted: true });
        if (providerStatus === "review") return NextResponse.json({ orderId, paymentReview: true });
        if (providerStatus === "pending") return NextResponse.json({ error: "The previous payment is still being confirmed. Please wait before retrying." }, { status: 409 });
        if (providerStatus === "not_found" && attemptAge < 30 * 60 * 1000) {
          return NextResponse.json({ error: "The previous payment session has not expired yet. Please retry in a few minutes." }, { status: 409 });
        }
        if (providerStatus === "not_found") {
          await PaymentTransaction.updateOne({ transactionId: previousTransactionId, status: { $in: ["pending", "initiated"] } }, { $set: { status: "cancelled" } });
          await Order.updateOne({ _id: orderId, paymentAttemptId: previousTransactionId }, { $set: { paymentAttemptId: null } });
        }
      } else {
        await Order.updateOne({ _id: orderId, paymentAttemptId: previousTransactionId }, { $set: { paymentAttemptId: null } });
      }
    }

    transactionId = createPaymentTransactionId();
    const appUrl = getPaymentAppUrl();
    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        const lockedOrder = await Order.findOne({
          _id: orderId,
          customerId,
          paymentMethod: "sslcommerz",
          paymentStatus: "pending",
          status: "pending",
          $or: [{ paymentAttemptId: null }, { paymentAttemptId: { $exists: false } }]
        }).session(dbSession);
        if (!lockedOrder) throw new Error("PAYMENT_ATTEMPT_LOCKED");

        await PaymentTransaction.create([{
          orderId: lockedOrder._id,
          customerId,
          provider: "sslcommerz",
          transactionId,
          amount: lockedOrder.total,
          currency: "BDT",
          status: "pending"
        }], { session: dbSession });
        lockedOrder.paymentAttemptId = transactionId;
        await lockedOrder.save({ session: dbSession });
      });
    } finally {
      await dbSession.endSession();
    }

    try {
      const gateway = await initiateSslCommerzSession({
        transactionId,
        amount: order.total,
        customer: {
          name: order.shipping.name,
          email: session.user.email,
          phone: order.shipping.phone,
          address: order.shipping.address,
          city: order.shipping.city
        },
        successUrl: `${appUrl}/api/payments/sslcommerz/success`,
        failUrl: `${appUrl}/api/payments/sslcommerz/fail`,
        cancelUrl: `${appUrl}/api/payments/sslcommerz/cancel`,
        ipnUrl: `${appUrl}/api/payments/sslcommerz/ipn`
      });
      await PaymentTransaction.updateOne(
        { transactionId, status: "pending" },
        { $set: { status: "initiated", gatewayUrl: gateway.gatewayUrl } }
      );
      return NextResponse.json({ gatewayUrl: gateway.gatewayUrl, orderId }, { status: 200 });
    } catch (error) {
      await PaymentTransaction.updateOne({ transactionId, status: { $in: ["pending", "initiated"] } }, { $set: { status: "failed" } });
      await Order.updateOne({ _id: orderId, paymentAttemptId: transactionId }, { $set: { paymentAttemptId: null } });
      console.error("SSLCommerz session initiation failed", error);
      return NextResponse.json({ error: "Could not start online payment. Please retry or choose cash on delivery." }, { status: 502 });
    }
  } catch (error) {
    if (error instanceof Error && error.message === "PAYMENT_ATTEMPT_LOCKED") {
      return NextResponse.json({ error: "A payment attempt is already active. Please retry in a moment." }, { status: 409 });
    }
    console.error("Payment initiation failed", error);
    return NextResponse.json({ error: "Unable to start payment right now." }, { status: 500 });
  }
}
