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
  const session = await auth();
  if (!session?.user?.id || !["admin", "super-admin"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { productId } = await context.params;
  if (!mongoose.isValidObjectId(productId)) return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
  const parsed = reviewSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid review decision", issues: parsed.error.issues }, { status: 400 });
  await connectDatabase();
  const product = await Product.findById(productId);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  if (parsed.data.decision === "approve" && product.medicine?.isMedicine && !parsed.data.approvalReference) {
    return NextResponse.json({ error: "Medicine listings require a verified compliance reference before approval." }, { status: 422 });
  }
  if (parsed.data.decision === "approve" && product.medicine?.isMedicine) {
    product.medicine.approvalReference = parsed.data.approvalReference;
  }
  product.status = parsed.data.decision === "approve" ? "active" : "rejected";
  await product.save();
  return NextResponse.json({ message: `Product ${product.status}`, productId: String(product._id) });
}
