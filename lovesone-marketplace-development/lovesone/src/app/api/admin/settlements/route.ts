import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { auth } from "../../../../../auth";
import { connectDatabase } from "@/lib/db";
import { enforceUserRateLimit } from "@/lib/api-rate-limit";
import { Order } from "@/models/Order";
import { Refund } from "@/models/Refund";
import { VendorSettlement } from "@/models/VendorSettlement";
import { allocateVendorRefundShares, calculateVendorSettlementAmounts } from "@/lib/payments/vendor-settlement";

const schema = z.object({ orderId: z.string().regex(/^[a-f0-9]{24}$/i) });
type SettlementLine = { lineTotal?: number; unitPrice?: number; quantity?: number };
type SettlementSubOrder = { vendorId?: unknown; items?: SettlementLine[]; status?: string };

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!["admin", "super-admin"].includes(session.user.role)) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    const body: unknown = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "A valid order ID is required." }, { status: 400 });

    const commissionBps = Number(process.env.PLATFORM_COMMISSION_BPS);
    if (!process.env.PLATFORM_COMMISSION_BPS || !Number.isInteger(commissionBps) || commissionBps < 0 || commissionBps > 10000) {
      return NextResponse.json({ error: "Vendor settlement is disabled until PLATFORM_COMMISSION_BPS is configured as an integer from 0 to 10000." }, { status: 503 });
    }

    await connectDatabase();
    const limited = await enforceUserRateLimit("admin-settlement-create", session.user.id, 30, 60 * 60 * 1000);
    if (limited) return limited;

    const dbSession = await mongoose.startSession();
    let result: Array<{ id: string; vendorId: string; grossAmount: number; refundShare: number; commissionAmount: number; netAmount: number; status: string }> = [];
    try {
      await dbSession.withTransaction(async () => {
        const order = await Order.findById(parsed.data.orderId).session(dbSession);
        if (!order) throw new Error("ORDER_NOT_FOUND");
        if (order.status !== "delivered" || !["paid", "partially_refunded"].includes(order.paymentStatus)) throw new Error("ORDER_NOT_SETTLED");
        const subOrders = (order.subOrders || []) as SettlementSubOrder[];
        const vendors = subOrders.map((subOrder) => ({
          vendorId: String(subOrder.vendorId || ""),
          gross: Math.round((subOrder.items || []).reduce((sum, item) => sum + Number(item.lineTotal ?? Number(item.unitPrice || 0) * Number(item.quantity || 0)), 0) * 100) / 100
        })).filter((entry) => mongoose.isValidObjectId(entry.vendorId) && entry.gross > 0);
        if (!vendors.length) throw new Error("NO_VENDOR_BALANCE");
        if (vendors.length !== subOrders.length) throw new Error("INVALID_VENDOR_LINES");

        const openRefund = await Refund.exists({ orderId: order._id, status: { $in: ["requested", "approved", "processing"] } }).session(dbSession);
        if (openRefund) throw new Error("OPEN_REFUND");
        const existing = await VendorSettlement.find({ orderId: order._id }).session(dbSession).lean();
        if (existing.length) {
          if (existing.length !== vendors.length) throw new Error("PARTIAL_SETTLEMENT_EXISTS");
          result = existing.map((entry) => ({
            id: String(entry._id), vendorId: String(entry.vendorId), grossAmount: Number(entry.grossAmount),
            refundShare: Number(entry.refundShare), commissionAmount: Number(entry.commissionAmount),
            netAmount: Number(entry.netAmount), status: String(entry.status)
          }));
          return;
        }

        const lock = await Order.updateOne(
          { _id: order._id, settlementLockedAt: null },
          { $set: { settlementLockedAt: new Date() } },
          { session: dbSession }
        );
        if (lock.modifiedCount !== 1) throw new Error("SETTLEMENT_LOCKED");

        const shares = allocateVendorRefundShares(vendors.map((entry) => entry.gross), Number(order.refundedAmount || 0));
        if (!shares) throw new Error("REFUND_ALLOCATION_INVALID");
        const documents = vendors.map((vendor, index) => {
          const amounts = calculateVendorSettlementAmounts(vendor.gross, shares[index], commissionBps);
          if (!amounts) throw new Error("SETTLEMENT_CALCULATION_FAILED");
          return {
            orderId: order._id, vendorId: vendor.vendorId, currency: "BDT",
            ...amounts, status: "pending", createdBy: session.user.id
          };
        });
        const created = await VendorSettlement.create(documents, { session: dbSession });
        result = created.map((entry) => ({
          id: String(entry._id), vendorId: String(entry.vendorId), grossAmount: entry.grossAmount,
          refundShare: entry.refundShare, commissionAmount: entry.commissionAmount,
          netAmount: entry.netAmount, status: entry.status
        }));
      });
    } finally {
      await dbSession.endSession();
    }
    return NextResponse.json({ message: "Vendor settlement ledger is ready.", settlements: result }, { status: 200 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "ORDER_NOT_FOUND") return NextResponse.json({ error: "Order not found." }, { status: 404 });
      if (error.message === "ORDER_NOT_SETTLED") return NextResponse.json({ error: "Only delivered orders with confirmed payment can be settled." }, { status: 409 });
      if (error.message === "NO_VENDOR_BALANCE" || error.message === "INVALID_VENDOR_LINES") return NextResponse.json({ error: "This order has no valid vendor settlement lines." }, { status: 409 });
      if (error.message === "OPEN_REFUND") return NextResponse.json({ error: "Resolve all open refund requests before creating vendor settlements." }, { status: 409 });
      if (error.message === "PARTIAL_SETTLEMENT_EXISTS") return NextResponse.json({ error: "A partial settlement ledger already exists. Contact support; do not retry payout manually." }, { status: 409 });
      if (error.message === "SETTLEMENT_LOCKED") return NextResponse.json({ error: "This order has already been locked for settlement." }, { status: 409 });
      if (error.message === "REFUND_ALLOCATION_INVALID" || error.message === "SETTLEMENT_CALCULATION_FAILED") return NextResponse.json({ error: "The refund allocation or settlement calculation is invalid." }, { status: 409 });
      if ("code" in error && error.code === 11000) return NextResponse.json({ error: "A settlement already exists for one or more vendors on this order." }, { status: 409 });
    }
    console.error("Vendor settlement creation failed", error);
    return NextResponse.json({ error: "Unable to create vendor settlements." }, { status: 500 });
  }
}
