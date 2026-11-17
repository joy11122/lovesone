import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { auth } from "../../../../../../auth";
import { connectDatabase } from "@/lib/db";
import { enforceUserRateLimit } from "@/lib/api-rate-limit";
import { VendorSettlement } from "@/models/VendorSettlement";

const schema = z.object({ status: z.literal("paid"), payoutReference: z.string().trim().min(3).max(120) });

export async function PATCH(request: NextRequest, context: { params: Promise<{ settlementId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!["admin", "super-admin"].includes(session.user.role)) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    const { settlementId } = await context.params;
    if (!mongoose.isValidObjectId(settlementId)) return NextResponse.json({ error: "Invalid settlement ID." }, { status: 400 });
    const body: unknown = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "A payout reference is required." }, { status: 400 });

    await connectDatabase();
    const limited = await enforceUserRateLimit("admin-settlement-payout", session.user.id, 30, 60 * 60 * 1000);
    if (limited) return limited;
    const settlement = await VendorSettlement.findOneAndUpdate(
      { _id: settlementId, status: "pending" },
      { $set: { status: "paid", payoutReference: parsed.data.payoutReference, paidBy: session.user.id, paidAt: new Date() } },
      { new: true, runValidators: true }
    ).lean();
    if (!settlement) {
      const exists = await VendorSettlement.exists({ _id: settlementId });
      return NextResponse.json({ error: exists ? "This settlement has already been paid or changed." : "Settlement not found." }, { status: exists ? 409 : 404 });
    }
    return NextResponse.json({ message: "Vendor payout recorded.", settlement: { id: String(settlement._id), status: settlement.status, payoutReference: settlement.payoutReference, netAmount: settlement.netAmount } });
  } catch (error) {
    console.error("Vendor payout recording failed", error);
    return NextResponse.json({ error: "Unable to record this vendor payout." }, { status: 500 });
  }
}
