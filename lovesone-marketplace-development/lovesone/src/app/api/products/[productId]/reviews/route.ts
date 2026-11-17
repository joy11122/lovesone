import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { auth } from "../../../../../../auth";
import { connectDatabase } from "@/lib/db";
import { Product } from "@/models/Product";
import { Review } from "@/models/Review";
import { Order } from "@/models/Order";
import { enforceUserRateLimit } from "@/lib/api-rate-limit";

const paramsSchema = z.object({ productId: z.string().regex(/^[a-f0-9]{24}$/i) });
const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(100).default(""),
  body: z.string().trim().min(10).max(2000)
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const { productId } = await params;
    if (!paramsSchema.safeParse({ productId }).success) return NextResponse.json({ error: "Invalid product." }, { status: 400 });
    await connectDatabase();
    const [reviews, summary] = await Promise.all([
      Review.find({ productId, status: "published" }).sort({ createdAt: -1 }).limit(50)
        .populate("customerId", "name").select("rating title body createdAt customerId").lean(),
      Review.aggregate([
        { $match: { productId: new mongoose.Types.ObjectId(productId), status: "published" } },
        { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } }
      ])
    ]);
    return NextResponse.json({ reviews, summary: summary[0] ? { average: Math.round(summary[0].average * 10) / 10, count: summary[0].count } : { average: 0, count: 0 } });
  } catch (error) {
    console.error("Product reviews fetch failed", error);
    return NextResponse.json({ error: "Unable to load product reviews." }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Please sign in to leave a review." }, { status: 401 });
    if (session.user.role !== "customer") return NextResponse.json({ error: "Customer accounts only." }, { status: 403 });
    const { productId } = await params;
    if (!paramsSchema.safeParse({ productId }).success) return NextResponse.json({ error: "Invalid product." }, { status: 400 });
    const limited = await enforceUserRateLimit("product-review", session.user.id, 10, 60 * 60 * 1000);
    if (limited) return limited;
    const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Please provide a rating and a review of at least 10 characters." }, { status: 400 });

    await connectDatabase();
    const product = await Product.exists({ _id: productId, status: "active", deletedAt: null });
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    const orders = await Order.find({ customerId: session.user.id, status: "delivered" }).select("subOrders").lean();
    const eligibleOrder = orders.find(order => Array.isArray(order.subOrders) && order.subOrders.some((sub: unknown) =>
      typeof sub === "object" && sub !== null && "items" in sub && Array.isArray(sub.items) &&
      sub.items.some((item: unknown) => typeof item === "object" && item !== null && "productId" in item && String(item.productId) === productId)
    ));
    if (!eligibleOrder) return NextResponse.json({ error: "You can review this product after an order containing it has been delivered." }, { status: 403 });

    const existing = await Review.findOne({ productId, customerId: session.user.id }).select("_id");
    if (existing) return NextResponse.json({ error: "You have already reviewed this product for that order." }, { status: 409 });
    const review = await Review.create({ productId, customerId: session.user.id, orderId: eligibleOrder._id, ...parsed.data });
    return NextResponse.json({ message: "Thank you for sharing your experience.", reviewId: String(review._id) }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return NextResponse.json({ error: "You have already reviewed this product for that order." }, { status: 409 });
    }
    console.error("Product review submission failed", error);
    return NextResponse.json({ error: "Unable to submit your review right now." }, { status: 500 });
  }
}
