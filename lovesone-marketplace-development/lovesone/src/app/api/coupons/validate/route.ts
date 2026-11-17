import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "../../../../../auth";
import { connectDatabase } from "@/lib/db";
import { Product } from "@/models/Product";
import { findUsableCoupon, calculateCouponDiscount } from "@/lib/coupons";
import { enforceUserRateLimit } from "@/lib/api-rate-limit";

const schema = z.object({
  code: z.string().trim().min(3).max(40),
  items: z.array(z.object({
    productId: z.string().regex(/^[a-f0-9]{24}$/i),
    variantId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
    quantity: z.number().int().min(1).max(99)
  })).min(1).max(40)
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Please sign in to apply a coupon." }, { status: 401 });
    if (session.user.role !== "customer") return NextResponse.json({ error: "Customer accounts only." }, { status: 403 });
    const limited = await enforceUserRateLimit("coupon-validate", session.user.id, 20, 15 * 60 * 1000);
    if (limited) return limited;
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid coupon request." }, { status: 400 });
    await connectDatabase();
    const ids = [...new Set(parsed.data.items.map(item => item.productId))];
    const products = await Product.find({ _id: { $in: ids }, status: "active", deletedAt: null });
    if (products.length !== ids.length) return NextResponse.json({ error: "Refresh your bag before applying a coupon." }, { status: 409 });
    let subtotal = 0;
    for (const item of parsed.data.items) {
      const product = products.find(entry => String(entry._id) === item.productId);
      if (!product) return NextResponse.json({ error: "A product is no longer available." }, { status: 409 });
      if (product.variants?.length && !item.variantId) return NextResponse.json({ error: "Choose an option for each product before applying a coupon." }, { status: 400 });
      const variant = item.variantId ? product.variants?.id(item.variantId) : null;
      if (item.variantId && !variant) return NextResponse.json({ error: "A selected product option is no longer available." }, { status: 409 });
      subtotal += (variant?.price ?? product.price) * item.quantity;
    }
    const coupon = await findUsableCoupon(parsed.data.code, session.user.id, subtotal);
    const discountAmount = calculateCouponDiscount(coupon, subtotal);
    return NextResponse.json({ code: coupon.code, subtotal, discountAmount, total: Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100) });
  } catch (error) {
    const messages: Record<string, string> = {
      COUPON_INVALID: "This coupon code is invalid or inactive.",
      COUPON_EXPIRED: "This coupon is not currently valid.",
      COUPON_MINIMUM: "Your bag does not meet this coupon's minimum order amount.",
      COUPON_LIMIT: "This coupon has reached its usage limit.",
      COUPON_ALREADY_USED: "You have already used this coupon."
    };
    if (error instanceof Error && messages[error.message]) return NextResponse.json({ error: messages[error.message] }, { status: 422 });
    console.error("Coupon validation failed", error);
    return NextResponse.json({ error: "Unable to validate this coupon right now." }, { status: 500 });
  }
}
