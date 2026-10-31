import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { connectDatabase } from "@/lib/db";
import { Product } from "@/models/Product";
import { ProductPurchase } from "@/components/storefront";

export const dynamic = "force-dynamic";
const categoryDetails: Record<string, { label: string; icon: string }> = {
  food: { label: "Food & nutrition", icon: "🥣" }, fashion: { label: "Pet fashion", icon: "🧣" },
  medicine: { label: "Health & medicine", icon: "🩺" }, grooming: { label: "Grooming", icon: "🧼" },
  toys: { label: "Toys & play", icon: "🧸" }, beds: { label: "Beds & furniture", icon: "🛏️" },
  accessories: { label: "Accessories", icon: "🐾" }, aquariums: { label: "Aquarium supplies", icon: "🐠" },
};

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await connectDatabase();
  const product = await Product.findOne({ slug, status: "active", deletedAt: null }).lean() as { _id: unknown; slug: string; title: string; price: number; stock: number; description?: string; categorySlug: string; vendorId: unknown; imageUrl?: string } | null;
  if (!product) notFound();
  const category = categoryDetails[product.categorySlug] ?? { label: product.categorySlug, icon: "🐾" };

  return (
    <main className="container py-10 sm:py-14">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-[#777487]"><Link href="/" className="hover:text-[#a45b2d]">Home</Link><span aria-hidden="true">/</span><Link href="/shop" className="hover:text-[#a45b2d]">Shop</Link><span aria-hidden="true">/</span><Link href={`/shop?category=${product.categorySlug}`} className="hover:text-[#a45b2d]">{category.label}</Link><span aria-hidden="true">/</span><span className="font-bold text-[#241d1a]">{product.title}</span></nav>
      <div className="mt-7 grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:gap-12">
        <div className="relative flex min-h-[320px] items-center justify-center overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#fff1e4] via-[#f8e4d4] to-[#f1d5c1] p-10 sm:min-h-[500px]"><div className="absolute -left-8 -top-8 h-44 w-44 rounded-full bg-white/30 blur-2xl"/><div className="absolute -bottom-10 -right-8 h-56 w-56 rounded-full bg-[#e5b99a]/40 blur-2xl"/><div className="relative flex h-full w-full flex-col items-center justify-center rounded-[2rem] border border-white/70 bg-white/30 text-center">{product.imageUrl ? <Image src={product.imageUrl} alt={product.title} fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="z-10 object-contain p-10" /> : <span className="text-8xl sm:text-9xl" role="img" aria-label={category.label}>{category.icon}</span>}<span className="relative z-20 mt-6 rounded-full bg-white/80 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#a45b2d]">Picked with love</span></div></div>
        <section className="flex flex-col justify-center"><Link href="/shop" className="w-fit text-sm font-bold text-[#a45b2d]">← Back to all products</Link><span className="eyebrow mt-7">{category.label}</span><h1 className="mt-3 text-4xl font-black leading-tight tracking-tight sm:text-5xl">{product.title}</h1><p className="mt-5 text-3xl font-black">৳{product.price.toLocaleString("en-BD")}</p><div className="mt-5 flex flex-wrap items-center gap-3"><span className={`rounded-full px-4 py-2 text-xs font-bold ${product.stock > 0 ? "bg-[#edf5eb] text-[#47724d]" : "bg-[#f7eeee] text-[#a14b4b]"}`}>{product.stock > 0 ? `${product.stock} available` : "Currently out of stock"}</span><span className="text-xs text-[#777487]">Secure order · Cash on delivery</span></div><div className="my-7 border-t border-[#f0e9e1]"/><h2 className="text-lg font-black">A little more about this find</h2><p className="mt-3 whitespace-pre-line leading-7 text-[#777487]">{product.description || "A thoughtful pick for your favourite companion. Add this lovely find to your bag and make their day a little brighter."}</p><div className="mt-8 rounded-3xl bg-[#fff4ea] p-5"><p className="font-black">A happy pet starts with thoughtful care.</p><p className="mt-2 text-sm leading-6 text-[#777487]">Check the product details and availability before placing your order. Stock is confirmed again at checkout.</p></div><ProductPurchase product={{ _id: String(product._id), slug: product.slug, title: product.title, price: product.price, vendorId: String(product.vendorId), stock: product.stock }}/><Link href={`/shop?category=${product.categorySlug}`} className="mt-5 text-center text-sm font-bold text-[#a45b2d]">Explore more in {category.label} →</Link></section>
      </div>
    </main>
  );
}