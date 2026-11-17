import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { timingSafeEqual } from "node:crypto";
import { connectDatabase } from "@/lib/db";
import { releaseCouponRedemption } from "@/lib/coupons";
import { restoreProductStock } from "@/lib/inventory";
import { Order } from "@/models/Order";
import { PaymentTransaction } from "@/models/PaymentTransaction";

type OrderLine = { productId: string; quantity: number };
type VendorSubOrder = { vendorId: string; status: string; items: OrderLine[]; cancelledAt?: Date };

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") || "";
  if (!secret || !authorization.startsWith("Bearer ")) return false;
  const supplied = authorization.slice(7);
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  // Node's constant-time comparison avoids leaking the configured cron token.
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

async function expireUnpaidOrders(request: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "Cron job is not configured." }, { status: 503 });
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  await connectDatabase();
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);
  const candidates = await Order.find({
    paymentMethod: "sslcommerz",
    paymentStatus: "pending",
    status: "pending",
    createdAt: { $lt: cutoff }
  }).select("_id").limit(50).lean() as unknown as Array<{ _id: unknown }>;

  let expired = 0;
  for (const candidate of candidates) {
    const session = await mongoose.startSession();
    let didExpire = false;
    try {
      await session.withTransaction(async () => {
        const order = await Order.findOne({
          _id: candidate._id,
          paymentMethod: "sslcommerz",
          paymentStatus: "pending",
          status: "pending",
          createdAt: { $lt: cutoff }
        }).session(session);
        if (!order) return;

        const subOrders = order.subOrders as VendorSubOrder[];
        if (subOrders.some((subOrder) => !["pending", "cancelled"].includes(subOrder.status))) return;
        for (const subOrder of subOrders) {
          if (subOrder.status === "cancelled") continue;
          for (const item of subOrder.items || []) {
            const restored = await restoreProductStock(item.productId, subOrder.vendorId, item.quantity, session);
            if (!restored) throw new Error("PAYMENT_EXPIRY_RESTOCK_FAILED");
          }
          subOrder.status = "cancelled";
          subOrder.cancelledAt = new Date();
        }

        order.subOrders = subOrders;
        order.markModified("subOrders");
        order.status = "cancelled";
        order.paymentStatus = "failed";
        order.paymentAttemptId = null;
        order.cancelledTotal = typeof order.originalTotal === "number" ? order.originalTotal : order.total;
        order.total = 0;
        await order.save({ session });
        await PaymentTransaction.updateMany(
          { orderId: order._id, status: { $in: ["pending", "initiated"] } },
          { $set: { status: "cancelled" } },
          { session }
        );
        await releaseCouponRedemption(order.couponCode, String(order.customerId), String(order._id), session);
        didExpire = true;
      });
      if (didExpire) expired += 1;
    } finally {
      await session.endSession();
    }
  }

  return NextResponse.json({ expired, checked: candidates.length });
}

export async function GET(request: NextRequest) {
  try {
    return await expireUnpaidOrders(request);
  } catch (error) {
    console.error("Unpaid online order expiry failed", error);
    return NextResponse.json({ error: "Unable to expire unpaid orders." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
