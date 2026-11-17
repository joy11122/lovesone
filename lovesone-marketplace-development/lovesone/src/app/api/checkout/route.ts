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
  paymentMethod: z.literal("cod")
});

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function POST(request: NextRequest) {
  let dbSession: mongoose.ClientSession | undefined;
  let customerId = "";
  let idempotencyKey = "";
  let requestFingerprint = "";

  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Please sign in before checkout." }, { status: 401 });
    if (session.user.role !== "customer") return NextResponse.json({ error: "Customer accounts only." }, { status: 403 });
    customerId = session.user.id;

    const body: unknown = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Please check your delivery details and cart." }, { status: 400 });

    idempotencyKey = parsed.data.idempotencyKey;
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
      shipping: parsed.data.shipping
    })).digest("hex");
    requestFingerprint = fingerprint;

    await connectDatabase();
    const previousOrder = await Order.findOne({ customerId, idempotencyKey }).select("_id idempotencyFingerprint").lean() as unknown as { _id: unknown; idempotencyFingerprint?: string } | null;
    if (previousOrder) {
      if (previousOrder.idempotencyFingerprint !== fingerprint) {
        return NextResponse.json({ error: "This checkout key was already used with different order details. Please retry checkout." }, { status: 409 });
      }
      return NextResponse.json({ message: "Order already placed.", orderId: String(previousOrder._id) }, { status: 200 });
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
        items: Array<{ productId: string; title: string; quantity: number; unitPrice: number; lineTotal: number }>;
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

      const created = await Order.create([{
        orderNumber: `LVS-${randomUUID().slice(0, 8).toUpperCase()}`,
        customerId,
        idempotencyKey,
        idempotencyFingerprint: fingerprint,
        subOrders: [...grouped.values()].map((group) => ({ ...group, status: "pending" })),
        total: Math.round(total * 100) / 100,
        originalTotal: Math.round(total * 100) / 100,
        cancelledTotal: 0,
        shipping: parsed.data.shipping,
        paymentMethod: "cod",
        paymentStatus: "pending",
        status: "pending"
      }], { session: transactionSession });
      const order = Array.isArray(created) ? created[0] : created;

      createdOrderId = String(order._id);
    });

    return NextResponse.json({ message: "Order placed successfully.", orderId: createdOrderId }, { status: 201 });
  } catch (error) {
    if (isDuplicateKeyError(error) && customerId && idempotencyKey) {
      const existing = await Order.findOne({ customerId, idempotencyKey }).select("_id idempotencyFingerprint").lean().catch(() => null) as unknown as { _id: unknown; idempotencyFingerprint?: string } | null;
      if (existing && existing.idempotencyFingerprint === requestFingerprint) {
        return NextResponse.json({ message: "Order already placed.", orderId: String(existing._id) }, { status: 200 });
      }
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
    if (error instanceof Error && error.message === "PRESCRIPTION_REQUIRED") {
      return NextResponse.json({ error: "Prescription-controlled products cannot be ordered online yet." }, { status: 422 });
    }
    console.error("Checkout failed", error);
    return NextResponse.json({ error: "Unable to place your order right now." }, { status: 500 });
  } finally {
    if (dbSession) await dbSession.endSession();
  }
}
