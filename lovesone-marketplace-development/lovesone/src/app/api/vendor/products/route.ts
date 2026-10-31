import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { auth } from "../../../../../auth";
import { connectDatabase } from "@/lib/db";
import { Product } from "@/models/Product";
import { VendorProfile } from "@/models/VendorProfile";

const schema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(4000).default(""),
  price: z.number().positive().max(10000000),
  stock: z.number().int().min(0).max(1000000),
  categorySlug: z.enum(["food", "fashion", "medicine", "grooming", "toys", "beds", "accessories", "aquariums"]),
  imageUrl: z.string().url().optional(),
  imagePublicId: z.string().trim().min(1).max(255).optional()
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "vendor") {
      return NextResponse.json({ error: "Verified seller access is required." }, { status: 403 });
    }

    const body: unknown = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid product details.", issues: parsed.error.issues }, { status: 400 });
    }

    if (Boolean(parsed.data.imageUrl) !== Boolean(parsed.data.imagePublicId)) {
      return NextResponse.json({ error: "Upload a product image using the seller dashboard." }, { status: 400 });
    }
    if (parsed.data.imageUrl && parsed.data.imagePublicId) {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const expectedFolder = `lovesone/vendors/${session.user.id}/products/`;
      const image = new URL(parsed.data.imageUrl);
      if (!cloudName || image.protocol !== "https:" || image.hostname !== "res.cloudinary.com" ||
          !image.pathname.startsWith(`/${cloudName}/image/upload/`) ||
          !parsed.data.imagePublicId.startsWith(expectedFolder)) {
        return NextResponse.json({ error: "The product image is not a valid upload for this seller." }, { status: 400 });
      }
    }

    await connectDatabase();
    const profile = await VendorProfile.findOne({
      userId: session.user.id,
      verificationStatus: "verified"
    }).select("_id").lean();
    if (!profile) return NextResponse.json({ error: "Your seller profile is not verified." }, { status: 403 });

    const slug = parsed.data.title.toLowerCase().normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90)
      + "-" + randomUUID().slice(0, 8);

    const product = await Product.create({
      ...parsed.data,
      price: Math.round(parsed.data.price * 100) / 100,
      vendorId: session.user.id,
      slug,
      status: "pending-review"
    });

    return NextResponse.json({
      message: "Product submitted for review.",
      productId: String(product._id)
    }, { status: 201 });
  } catch (error) {
    console.error("Vendor product creation failed", error);
    return NextResponse.json({ error: "Unable to create product right now." }, { status: 500 });
  }
}

const updateSchema = z.object({
  productId: z.string().regex(/^[a-f0-9]{24}$/i),
  price: z.number().positive().max(10000000).optional(),
  stock: z.number().int().min(0).max(1000000).optional(),
  description: z.string().trim().max(4000).optional()
}).refine((data) => data.price !== undefined || data.stock !== undefined || data.description !== undefined);

const productIdSchema = z.object({ productId: z.string().regex(/^[a-f0-9]{24}$/i) });

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "vendor") {
      return NextResponse.json({ error: "Verified seller access is required." }, { status: 403 });
    }
    const body: unknown = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid product update.", issues: parsed.error.issues }, { status: 400 });

    await connectDatabase();
    const profile = await VendorProfile.findOne({ userId: session.user.id, verificationStatus: "verified" }).select("_id").lean();
    if (!profile) return NextResponse.json({ error: "Your seller profile is not verified." }, { status: 403 });

    const current = await Product.findOne({
      _id: parsed.data.productId,
      vendorId: session.user.id,
      deletedAt: null,
      status: { $in: ["active", "pending-review", "rejected", "draft"] }
    }).select("price description status updatedAt");
    if (!current) return NextResponse.json({ error: "Product not found or no longer editable." }, { status: 404 });

    const changes: Record<string, unknown> = {};
    if (parsed.data.price !== undefined) changes.price = Math.round(parsed.data.price * 100) / 100;
    if (parsed.data.stock !== undefined) changes.stock = parsed.data.stock;
    if (parsed.data.description !== undefined) changes.description = parsed.data.description;

    const contentChanged =
      (parsed.data.price !== undefined && changes.price !== current.price) ||
      (parsed.data.description !== undefined && parsed.data.description !== current.description);
    if (contentChanged && current.status === "active") changes.status = "pending-review";

    const updated = await Product.findOneAndUpdate({
      _id: parsed.data.productId,
      vendorId: session.user.id,
      deletedAt: null,
      status: { $in: ["active", "pending-review", "rejected", "draft"] },
      updatedAt: current.updatedAt
    }, { $set: changes }, { new: true }).select("_id status price stock");

    if (!updated) return NextResponse.json({ error: "Product changed while you were editing. Refresh and try again." }, { status: 409 });
    return NextResponse.json({
      message: updated.status === "pending-review" ? "Product updated and sent for review." : "Product inventory updated.",
      product: { id: String(updated._id), status: updated.status, price: updated.price, stock: updated.stock }
    });
  } catch (error) {
    console.error("Vendor product update failed", error);
    return NextResponse.json({ error: "Unable to update this product right now." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "vendor") {
      return NextResponse.json({ error: "Verified seller access is required." }, { status: 403 });
    }
    const body: unknown = await request.json().catch(() => null);
    const parsed = productIdSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid product ID." }, { status: 400 });

    await connectDatabase();
    const profile = await VendorProfile.findOne({ userId: session.user.id, verificationStatus: "verified" }).select("_id").lean();
    if (!profile) return NextResponse.json({ error: "Your seller profile is not verified." }, { status: 403 });

    const archived = await Product.findOneAndUpdate({
      _id: parsed.data.productId,
      vendorId: session.user.id,
      deletedAt: null,
      status: { $in: ["active", "pending-review", "rejected", "draft"] }
    }, { $set: { status: "archived" } }, { new: true }).select("_id");

    if (!archived) return NextResponse.json({ error: "Product not found or already archived." }, { status: 404 });
    return NextResponse.json({ message: "Product archived successfully." });
  } catch (error) {
    console.error("Vendor product archive failed", error);
    return NextResponse.json({ error: "Unable to archive this product right now." }, { status: 500 });
  }
}
