import { NextRequest, NextResponse } from "next/server";
import { connectDatabase } from "@/lib/db";
import { parseRecentProductIds } from "@/lib/product-recommendations";
import { Product } from "@/models/Product";

export async function GET(request: NextRequest) {
  try {
    const ids = parseRecentProductIds(request.nextUrl.searchParams.get("ids"));
    if (!ids.length) return NextResponse.json({ products: [] });
    await connectDatabase();
    const products = await Product.find({
      _id: { $in: ids },
      status: "active",
      deletedAt: null
    }).select("slug title categorySlug imageUrl price stock").lean();
    const byId = new Map(products.map(product => [String(product._id), product]));
    return NextResponse.json({ products: ids.map(id => byId.get(id)).filter(Boolean) });
  } catch (error) {
    console.error("Recently viewed products could not be loaded", error);
    return NextResponse.json({ error: "Unable to load recently viewed products." }, { status: 500 });
  }
}
