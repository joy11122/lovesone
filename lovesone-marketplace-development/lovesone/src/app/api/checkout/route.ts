import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { auth } from "../../../../auth";
import { enforceUserRateLimit } from "@/lib/api-rate-limit";
import { connectDatabase } from "@/lib/db";
import { reserveProductStock } from "@/lib/inventory";
import { Product } from "@/models/Product";
import { Order } from "@/models/Order";
import { Coupon } from "@/models/Coupon";
import { CouponRedemption } from "@/models/CouponRedemption";
import { findUsableCoupon, calculateCouponDiscount } from "@/lib/coupons";
import { isSslCommerzConfigured } from "@/lib/payments/sslcommerz";\nimport { isValidSslCommerzAmount } from "@/lib/payments/payment-state";

const schema = z.object({
  idempotencyKey: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().regex(/^[a-f0-9]{24}$/i),
    variantId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
    quantity: z.number().int().min(1).max(99)
  })).min(1).max(40),
  shipping: z.object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().trim().regex(/^(?:\+?88)?01[3-9]\d{8}$/),
    address: z.string().trim().min(8).max(500),
    city: z.string().trim().min(2).max(80)
  }),
  couponCode: z.string().trim().toUpperCase().min(3).max(40).optional(),
  paymentMethod: z.enum(["cod", "sslcommerz"])
});

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function POST(request: NextRequest) {
  let dbSession: mongoose.ClientSession | undefined;
  let customerId = "";
  let idempotencyKey = "";
  let requestFingerprint = "";
  let couponCode = "";

  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Please sign in before checkout." }, { status: 401 });
    if (session.user.role !== "customer") return NextResponse.json({ error: "Customer accounts only." }, { status: 403 });
    customerId = session.user.id;

    const body: unknown = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Please check your delivery details and cart." }, { status: 400 });

    if (parsed.data.paymentMethod === "sslcommerz" && !session.user.email) {
      return NextResponse.json({ error: "A verified email address is required for online payment." }, { status: 422 });
    }
    if (parsed.data.paymentMethod === "sslcommerz" && !isSslCommerzConfigured()) {
      return NextResponse.json({ error: "Online payment is not configured yet. Please choose cash on delivery." }, { status: 503 });
    }

    idempotencyKey = parsed.data.idempotencyKey;
    couponCode = parsed.data.couponCode ?? "";
    const quantities = new Map<string, { productId: string; variantId?: string; quantity: number }>();
    for (const item of parsed.data.items) {
      const key = item.productId + ":" + (item.variantId ?? "default");
      const existing = quantities.get(key);
      quantities.set(key, { productId: item.productId, ...(item.variantId ? { variantId: item.variantId } : {}), quantity: (existing?.quantity ?? 0) + item.quantity });
    }
    if (quantities.size !== parsed.data.items.length) {
      return NextResponse.json({ error: "Remove duplicate cart lines and try again." }, { status: 400 });
    }

    const fingerprint = createHash("sha256").update(JSON.stringify({
      items: [...quantities.values()].sort((a, b) => a.productId.localeCompare(b.productId) || (a.variantId ?? "").localeCompare(b.variantId ?? "")),
      shipping: parsed.data.shipping,
      couponCode: parsed.data.couponCode ?? ""
    })).digest("hex");
    requestFingerprint = fingerprint;

    await connectDatabase();
    const previousOrder = await Order.findOne({ customerId, idempotencyKey }).select("_id idempotencyFingerprint paymentMethod paymentStatus").lean() as unknown as { _id: unknown; idempotencyFingerprint?: string; paymentMethod?: string; paymentStatus?: string } | null;
    if (previousOrder) {
      if (previousOrder.idempotencyFingerprint !== fingerprint) {
        return NextResponse.json({ error: "This checkout key was already used with different order details. Please retry checkout." }, { status: 409 });
      }
      return NextResponse.json({ message: "Order already placed.", orderId: String(previousOrder._id), paymentMethod: previousOrder.paymentMethod ?? "cod", paymentCompleted: previousOrder.paymentStatus === "paid" }, { status: 200 });
    }

    const limited = await enforceUserRateLimit("checkout", customerId, 8, 15 * 60 * 1000);
    if (limited) return limited;

    const transactionSession = await mongoose.startSession();
    dbSession = transactionSession;
    let createdOrderId = "";

    await transactionSession.withTransaction(async () => {
      const ids = [...new Set([...quantities.values()].map((line) => line.productId))];
      const products = await Product.find({
        _id: { $in: ids },
        status: "active",
        deletedAt: null
      }).session(transactionSession);

      if (products.length !== ids.length) throw new Error("PRODUCT_UNAVAILABLE");

      const grouped = new Map<string, {
        vendorId: string;
        items: Array<{ productId: string; title: string; quantity: number; unitPrice: number; lineTotal: number; variantId?: string; variantName?: string; originalLineTotal?: number; discountAmount?: number }>;
      }>();
      let total = 0;

      for (const product of products) {
        if (product.medicine?.isMedicine && product.medicine?.requiresPrescription) {
          throw new Error("PRESCRIPTION_REQUIRED");
        }

        const productLines = [...quantities.values()].filter((line) => line.productId === String(product._id));
        const totalQuantity = productLines.reduce((sum, line) => sum + line.quantity, 0);
        if (product.variants?.length && productLines.some((line) => !line.variantId)) throw new Error("VARIANT_REQUIRED");
        const reserved = await reserveProductStock(
          String(product._id),
          String(product.vendorId),
          totalQuantity,
          transactionSession
        );
        if (!reserved) throw new Error("INSUFFICIENT_STOCK");

        const vendorId = String(product.vendorId);
        const group = grouped.get(vendorId) || { vendorId, items: [] };
        for (const line of productLines) {
          const variant = line.variantId ? product.variants?.id(line.variantId) : null;
          if (line.variantId && !variant) throw new Error("VARIANT_UNAVAILABLE");
          const unitPrice = variant?.price ?? product.price;
          const lineTitle = variant ? `${product.title} — ${variant.name}` : product.title;
          const lineTotal = Math.round(unitPrice * line.quantity * 100) / 100;
          total += lineTotal;
          group.items.push({
            productId: String(product._id),
            ...(variant ? { variantId: String(variant._id), variantName: variant.name } : {}),
            title: lineTitle,
            quantity: line.quantity,
            unitPrice,
            lineTotal
          });
        }
        grouped.set(vendorId, group);
      }

      let discountAmount = 0;
      let appliedCoupon: { _id: unknown; code: string } | null = null;
      if (parsed.data.couponCode) {
        const coupon = await findUsableCoupon(parsed.data.couponCode, customerId, total, transactionSession);
        discountAmount = calculateCouponDiscount(coupon, total);
        const couponFilter: Record<string, unknown> = { _id: coupon._id, active: true, startsAt: { $lte: new Date() }, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] };
        if (coupon.usageLimit !== null && coupon.usageLimit !== undefined) couponFilter.usageCount = { $lt: coupon.usageLimit };
        const reservedCoupon = await Coupon.findOneAndUpdate(couponFilter, { $inc: { usageCount: 1 } }, { new: true, session: transactionSession }).select("_id code");
        if (!reservedCoupon) throw new Error("COUPON_LIMIT");
        appliedCoupon = { _id: reservedCoupon._id, code: reservedCoupon.code };

        const orderLines = [...grouped.values()].flatMap(group => group.items);
        let remainingDiscount = discountAmount;
        orderLines.forEach((line, index) => {
          const share = index === orderLines.length - 1
            ? remainingDiscount
            : Math.min(remainingDiscount, line.lineTotal, Math.round((line.lineTotal / total) * discountAmount * 100) / 100);
          line.originalLineTotal = line.lineTotal;
          line.discountAmount = share;
          line.lineTotal = Math.round((line.lineTotal - share) * 100) / 100;
          remainingDiscount = Math.round((remainingDiscount - share) * 100) / 100;
        });
      }

      const payableTotal = Math.round((total - discountAmount) * 100) / 100;
      if (parsed.data.paymentMethod === "sslcommerz" && !isValidSslCommerzAmount(payableTotal)) {
        throw new Error("PAYMENT_AMOUNT_OUT_OF_RANGE");
      }

      const created = await Order.create([{
        orderNumber: `LVS-${randomUUID().slice(0, 8).toUpperCase()}`,
        customerId,
        idempotencyKey,
        idempotencyFingerprint: fingerprint,
        subOrders: [...grouped.values()].map((group) => ({ ...group, status: "pending" })),
        total: payableTotal,
        subtotal: Math.round(total * 100) / 100,
        originalTotal: payableTotal,
        discountTotal: discountAmount,
        ...(appliedCoupon ? { couponCode: appliedCoupon.code } : {}),
        cancelledTotal: 0,
        shipping: parsed.data.shipping,
        paymentMethod: parsed.data.paymentMethod,
        paymentStatus: "pending",
        status: "pending"
      }], { session: transactionSession });
      const order = Array.isArray(created) ? created[0] : created;

      createdOrderId = String(order._id);
      if (appliedCoupon) await CouponRedemption.create([{ couponId: appliedCoupon._id, userId: customerId, orderId: order._id, discountAmount }], { session: transactionSession });
    });

    return NextResponse.json({ message: "Order placed successfully.", orderId: createdOrderId, paymentMethod: parsed.data.paymentMethod }, { status: 201 });
  } catch (error) {
    if (isDuplicateKeyError(error) && customerId && idempotencyKey) {
      const existing = await Order.findOne({ customerId, idempotencyKey }).select("_id idempotencyFingerprint paymentMethod paymentStatus").lean().catch(() => null) as unknown as { _id: unknown; idempotencyFingerprint?: string; paymentMethod?: string; paymentStatus?: string } | null;
      if (existing && existing.idempotencyFingerprint === requestFingerprint) {
        return NextResponse.json({ message: "Order already placed.", orderId: String(existing._id), paymentMethod: existing.paymentMethod ?? "cod", paymentCompleted: existing.paymentStatus === "paid" }, { status: 200 });
      }
    }
    if (isDuplicateKeyError(error) && customerId && couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode }).select("_id").lean().catch(() => null) as { _id: unknown } | null;
      if (coupon && await CouponRedemption.exists({ couponId: coupon._id, userId: customerId }).catch(() => null)) {
        return NextResponse.json({ error: "You have already used this coupon." }, { status: 422 });
      }
    }
    if (error instanceof Error && error.message.startsWith("COUPON_")) {
      const couponMessages: Record<string, string> = {
        COUPON_INVALID: "This coupon code is invalid or inactive.",
        COUPON_EXPIRED: "This coupon is not currently valid.",
        COUPON_MINIMUM: "Your order does not meet this coupon's minimum amount.",
        COUPON_LIMIT: "This coupon has reached its usage limit.",
        COUPON_ALREADY_USED: "You have already used this coupon."
      };
      return NextResponse.json({ error: couponMessages[error.message] ?? "This coupon cannot be applied." }, { status: 422 });
    }
    if (error instanceof Error && error.message === "PRODUCT_UNAVAILABLE") {
      return NextResponse.json({ error: "One or more products are no longer available. Please refresh your bag." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      return NextResponse.json({ error: "A product does not have enough stock. Please update your quantity." }, { status: 409 });
    }
    if (error instanceof Error && (error.message === "VARIANT_REQUIRED" || error.message === "VARIANT_UNAVAILABLE")) {
      return NextResponse.json({ error: "A selected product option is no longer available. Refresh your bag and try again." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "PAYMENT_AMOUNT_OUT_OF_RANGE") {
      return NextResponse.json({ error: "SSLCommerz supports order totals from ৳10 to ৳500,000. Please choose cash on delivery for this order." }, { status: 422 });
    }
    if (error instanceof Error && error.message === "PRESCRIPTION_REQUIRED") {
      return NextResponse.json({ error: "Prescription-controlled products cannot be ordered online yet." }, { status: 422 });
    }
    console.error("Checkout failed", error);
    return NextResponse.json({ error: "Unable to place your order right now." }, { status: 500 });
  } finally {
    if (dbSession) await dbSession.endSession();
  }
}
