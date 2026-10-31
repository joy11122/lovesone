import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { auth } from "../../../../../auth";
import { connectDatabase } from "@/lib/db";
import { Order } from "@/models/Order";

const returnSchema = z.object({ reason: z.string().trim().min(5).max(500) });

export async function POST(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Please sign in to request a return." }, { status: 401 });
    const { orderId } = await context.params;
    if (!mongoose.isValidObjectId(orderId)) return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
    const parsed = returnSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Please provide a valid return reason.", issues: parsed.error.issues }, { status: 400 });
    await connectDatabase();
    const order = await Order.findOne({ _id: orderId, customerId: session.user.id });
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.status !== "delivered") return NextResponse.json({ error: "Only delivered orders can be returned." }, { status: 409 });
    if (order.returnRequest?.status) return NextResponse.json({ error: "A return request already exists for this order." }, { status: 409 });
    order.set("returnRequest", { status: "requested", reason: parsed.data.reason, requestedAt: new Date() });
    await order.save();
    return NextResponse.json({ message: "Return request submitted." }, { status: 201 });
  } catch (error) {
    console.error("Return request failed", error);
    return NextResponse.json({ error: "Unable to submit return request right now." }, { status: 500 });
  }
}
