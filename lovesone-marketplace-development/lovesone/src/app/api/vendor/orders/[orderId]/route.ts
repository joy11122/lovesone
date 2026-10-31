import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { auth } from "../../../../../../auth";
import { connectDatabase } from "@/lib/db";
import { canTransitionVendorOrder, aggregateParentOrderStatus, type VendorOrderStatus } from "@/lib/order-workflow";
import { Order } from "@/models/Order";
import { Product } from "@/models/Product";
import { VendorProfile } from "@/models/VendorProfile";

const schema = z.object({
  status: z.enum(["processing", "shipped", "delivered", "cancelled"])
});

type OrderLine = { productId: string; quantity: number; lineTotal?: number; unitPrice?: number };
type VendorSubOrder = { vendorId: string; status: string; items: OrderLine[]; updatedAt?: Date; cancelledAt?: Date };

export async function PATCH(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  let dbSession: mongoose.ClientSession | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    if (session.user.role !== "vendor") return NextResponse.json({ error: "Verified seller access is required." }, { status: 403 });

    const { orderId } = await context.params;
    if (!mongoose.isValidObjectId(orderId)) return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
    const body: unknown = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid order status." }, { status: 400 });

    await connectDatabase();
    const profile = await VendorProfile.findOne({ userId: session.user.id, verificationStatus: "verified" }).select("_id").lean();
    if (!profile) return NextResponse.json({ error: "Your seller profile is not verified." }, { status: 403 });

    const transactionSession = await mongoose.startSession();
    dbSession = transactionSession;
    await transactionSession.withTransaction(async () => {
      const order = await Order.findOne({
        _id: orderId,
        "subOrders.vendorId": session.user.id
      }).session(transactionSession);
      if (!order) throw new Error("ORDER_NOT_FOUND");

      const subOrders = order.subOrders as VendorSubOrder[];
      const subOrder = subOrders.find((item) => String(item.vendorId) === session.user.id);
      if (!subOrder) throw new Error("ORDER_NOT_FOUND");

      const nextStatus = parsed.data.status as VendorOrderStatus;
      if (!canTransitionVendorOrder(subOrder.status, nextStatus)) throw new Error("INVALID_ORDER_TRANSITION");

      if (nextStatus === "cancelled") {
        for (const item of subOrder.items || []) {
          const restored = await Product.updateOne(
            { _id: item.productId, vendorId: session.user.id },
            { $inc: { stock: item.quantity } },
            { session: transactionSession }
          );
          if (restored.matchedCount !== 1) throw new Error("RESTOCK_FAILED");
        }
        subOrder.cancelledAt = new Date();
      }

      subOrder.status = nextStatus;
      subOrder.updatedAt = new Date();
      order.subOrders = subOrders;
      order.markModified("subOrders");
      order.status = aggregateParentOrderStatus(subOrders.map((item) => item.status));
      order.total = subOrders.reduce((sum, item) => {
        if (item.status === "cancelled") return sum;
        return sum + (item.items || []).reduce((lineSum, line) => {
          const lineTotal = typeof line.lineTotal === "number"
            ? line.lineTotal
            : Number(line.unitPrice || 0) * Number(line.quantity || 0);
          return lineSum + lineTotal;
        }, 0);
      }, 0);
      order.total = Math.round(order.total * 100) / 100;
      await order.save({ session: transactionSession });
    });

    return NextResponse.json({ message: "Order status updated successfully." });
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_NOT_FOUND") {
      return NextResponse.json({ error: "Order not found for this seller." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "INVALID_ORDER_TRANSITION") {
      return NextResponse.json({ error: "This order cannot move to that status." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "RESTOCK_FAILED") {
      return NextResponse.json({ error: "Unable to safely restore stock. Contact marketplace support." }, { status: 409 });
    }
    console.error("Vendor order update failed", error);
    return NextResponse.json({ error: "Unable to update this order right now." }, { status: 500 });
  } finally {
    if (dbSession) await dbSession.endSession();
  }
}
