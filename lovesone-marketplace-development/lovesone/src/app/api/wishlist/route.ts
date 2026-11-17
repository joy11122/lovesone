import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "../../../../auth";
import { connectDatabase } from "@/lib/db";
import { Product } from "@/models/Product";
import { Wishlist } from "@/models/Wishlist";
import { enforceUserRateLimit } from "@/lib/api-rate-limit";

const idSchema = z.object({ productId: z.string().regex(/^[a-f0-9]{24}$/i) });

async function customerSession() {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Please sign in to use your wishlist." }, { status: 401 }) };
  if (session.user.role !== "customer") return { error: NextResponse.json({ error: "Customer accounts only." }, { status: 403 }) };
  return { userId: session.user.id };
}

export async function GET() {
  try {
    const access = await customerSession();
    if ("error" in access) return access.error;
    await connectDatabase();
    const wishlist = await Wishlist.findOne({ userId: access.userId }).select("productIds").lean() as { productIds?: unknown[] } | null;
    const ids = (wishlist?.productIds ?? []).map(String);
    const products = ids.length ? await Product.find({ _id: { $in: ids }, status: "active", deletedAt: null })
      .select("slug title price stock imageUrl categorySlug")
      .lean() : [];
    return NextResponse.json({ products });
  } catch (error) {
    console.error("Wishlist fetch failed", error);
    return NextResponse.json({ error: "Unable to load your wishlist." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await customerSession();
    if ("error" in access) return access.error;
    const limited = await enforceUserRateLimit("wishlist-update", access.userId, 60, 60 * 60 * 1000);
    if (limited) return limited;
    const parsed = idSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid product." }, { status: 400 });
    await connectDatabase();
    const product = await Product.exists({ _id: parsed.data.productId, status: "active", deletedAt: null });
    if (!product) return NextResponse.json({ error: "This product is no longer available." }, { status: 404 });
    await Wishlist.updateOne({ userId: access.userId }, { $addToSet: { productIds: parsed.data.productId } }, { upsert: true });
    return NextResponse.json({ message: "Added to your wishlist." });
  } catch (error) {
    console.error("Wishlist update failed", error);
    return NextResponse.json({ error: "Unable to update your wishlist." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await customerSession();
    if ("error" in access) return access.error;
    const limited = await enforceUserRateLimit("wishlist-update", access.userId, 60, 60 * 60 * 1000);
    if (limited) return limited;
    const parsed = idSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid product." }, { status: 400 });
    await connectDatabase();
    await Wishlist.updateOne({ userId: access.userId }, { $pull: { productIds: parsed.data.productId } });
    return NextResponse.json({ message: "Removed from your wishlist." });
  } catch (error) {
    console.error("Wishlist removal failed", error);
    return NextResponse.json({ error: "Unable to update your wishlist." }, { status: 500 });
  }
}
