import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "../../../../../../auth";
import { connectDatabase } from "@/lib/db";
import { canCustomerCancelOrder } from "@/lib/order-workflow";
import { Order } from "@/models/Order";
import { Product } from "@/models/Product";

type OrderLine = { productId: string; quantity: number };
type VendorSubOrder = { vendorId: string; status: string; items: OrderLine[]; cancelledAt?: Date };

export async function POST(_request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  let dbSession: mongoose.ClientSession | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    if (session.user.role !== "customer") return NextResponse.json({ error: "Customer accounts only." }, { status: 403 });

    const { orderId } = await context.params;
    if (!mongoose.isValidObjectId(orderId)) return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });

    await connectDatabase();
    const transactionSession = await mongoose.startSession();
    dbSession = transactionSession;
    await transactionSession.withTransaction(async () => {
      const order = await Order.findOne({ _id: orderId, customerId: session.user.id }).session(transactionSession);
      if (!order) throw new Error("ORDER_NOT_FOUND");

      const subOrders = order.subOrders as VendorSubOrder[];
      if (!canCustomerCancelOrder(subOrders.map((item) => item.status), order.paymentStatus)) {
        throw new Error("CANCELLATION_NOT_ALLOWED");
      }

      for (const subOrder of subOrders) {
        if (subOrder.status === "cancelled") continue;
        for (const item of subOrder.items || []) {
          const restored = await Product.updateOne(
            { _id: item.productId, vendorId: subOrder.vendorId },
            { $inc: { stock: item.quantity } },
            { session: transactionSession }
          );
          if (restored.matchedCount !== 1) throw new Error("RESTOCK_FAILED");
        }
        subOrder.status = "cancelled";
        subOrder.cancelledAt = new Date();
      }

      order.subOrders = subOrders;
      order.markModified("subOrders");
      order.status = "cancelled";
      order.total = 0;
      await order.save({ session: transactionSession });
    });

    return NextResponse.json({ message: "Your order has been cancelled and available stock restored." });
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_NOT_FOUND") {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "CANCELLATION_NOT_ALLOWED") {
      return NextResponse.json({ error: "This order can no longer be cancelled online. Please contact marketplace support." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "RESTOCK_FAILED") {
      return NextResponse.json({ error: "Unable to safely restore stock. Contact marketplace support." }, { status: 409 });
    }
    console.error("Customer order cancellation failed", error);
    return NextResponse.json({ error: "Unable to cancel this order right now." }, { status: 500 });
  } finally {
    if (dbSession) await dbSession.endSession();
  }
}
