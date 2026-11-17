import Link from "next/link";
import { WishlistGrid, type WishlistProduct } from "@/components/product-engagement";
import { requireRole } from "@/lib/authz";
import { connectDatabase } from "@/lib/db";
import { Product } from "@/models/Product";
import { Wishlist } from "@/models/Wishlist";

export const metadata = { title: "My wishlist" };

export default async function WishlistPage() {
  const user = await requireRole(["customer"], "/wishlist");
  await connectDatabase();
  const wishlist = await Wishlist.findOne({ userId: user.id }).select("productIds").lean() as { productIds?: unknown[] } | null;
  const ids = (wishlist?.productIds ?? []).map(String);
  const products = ids.length ? await Product.find({ _id: { $in: ids }, status: "active", deletedAt: null })
    .select("slug title price stock imageUrl categorySlug").lean() : [];
  const safeProducts = products.map(product => ({
    _id: String(product._id),
    slug: product.slug,
    title: product.title,
    price: product.price,
    stock: product.stock,
    ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}),
    categorySlug: product.categorySlug
  })) as WishlistProduct[];
  return <main className="container py-12"><span className="eyebrow">Kept close for later</span><div className="mt-3 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-4xl font-black">Your wishlist ♡</h1><p className="mt-2 text-sm text-[#777487]">Your saved LOVESONE favourites, all in one place.</p></div><Link href="/shop" className="btn">Discover more</Link></div><div className="mt-8"><WishlistGrid products={safeProducts}/></div></main>;
}
