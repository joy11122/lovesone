import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "../../../../../../../auth";
import { connectDatabase } from "@/lib/db";
import { Product } from "@/models/Product";
import { z } from "zod";

const reviewSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  approvalReference: z.string().trim().min(3).max(120).optional()
});

export async function POST(request: NextRequest, context: { params: Promise<{ productId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id || !["admin", "super-admin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { productId } = await context.params;
    if (!mongoose.isValidObjectId(productId)) {
      return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
    }

    const body: unknown = await request.json().catch(() => null);
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid review decision", issues: parsed.error.issues }, { status: 400 });
    }

    await connectDatabase();
    const product = await Product.findOne({ _id: productId, deletedAt: null }).select("medicine status").lean() as unknown as { status: string; medicine?: { isMedicine?: boolean } } | null;
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    if (product.status !== "pending-review") {
      return NextResponse.json({ error: "This product has already been reviewed." }, { status: 409 });
    }
    if (parsed.data.decision === "approve" && product.medicine?.isMedicine && !parsed.data.approvalReference) {
      return NextResponse.json({
        error: "Medicine listings require a verified compliance reference before approval."
      }, { status: 422 });
    }

    const update: Record<string, unknown> = {
      status: parsed.data.decision === "approve" ? "active" : "rejected"
    };
    if (parsed.data.decision === "approve" && product.medicine?.isMedicine) {
      update["medicine.approvalReference"] = parsed.data.approvalReference;
    }

    const updated = await Product.findOneAndUpdate(
      { _id: productId, status: "pending-review", deletedAt: null },
      { $set: update },
      { new: true }
    ).select("_id status");

    if (!updated) return NextResponse.json({ error: "This product has already been reviewed." }, { status: 409 });
    return NextResponse.json({
      message: `Product ${updated.status}`,
      productId: String(updated._id)
    });
  } catch (error) {
    console.error("Product moderation failed", error);
    return NextResponse.json({ error: "Unable to review this product right now." }, { status: 500 });
  }
}
