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
  categorySlug: z.enum(["food", "fashion", "medicine", "grooming", "toys", "beds", "accessories", "aquariums"])
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
