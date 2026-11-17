"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type RecommendationProduct = {
  _id: string;
  slug: string;
  title: string;
  categorySlug: string;
  imageUrl?: string;
  price: number;
  stock: number;
};

const STORAGE_KEY = "lovesone-recent-products-v1";
const MAX_RECENT = 8;

export function ProductViewTracker({ productId }: { productId: string }) {
  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      const previous = Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string" && /^[a-f0-9]{24}$/i.test(id)) : [];
      const next = [productId, ...previous.filter(id => id !== productId)].slice(0, MAX_RECENT);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Recommendations remain optional when browser storage is unavailable.
    }
  }, [productId]);

  return null;
}

function ProductCards({ products }: { products: RecommendationProduct[] }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {products.map(product => <article key={product._id} className="overflow-hidden rounded-2xl border border-[#f0e9e1] bg-white transition hover:-translate-y-0.5 hover:shadow-md">
      <Link href={"/product/" + product.slug} className="block">
        <div className="relative flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-[#fff4ea] to-[#f7e5d5]">
          {product.imageUrl ? <Image src={product.imageUrl} alt={product.title} fill sizes="(max-width: 640px) 50vw, 25vw" className="object-contain p-3" /> : <span aria-hidden="true" className="text-5xl">🐾</span>}
        </div>
        <div className="p-4"><h3 className="line-clamp-2 min-h-10 text-sm font-black">{product.title}</h3><p className="mt-2 font-black">৳{product.price.toLocaleString("en-BD")}</p><p className="mt-1 text-xs text-[#777487]">{product.stock > 0 ? "In stock" : "Currently out of stock"}</p></div>
      </Link>
    </article>)}
  </div>;
}

export function RecentlyViewedProducts() {
  const [products, setProducts] = useState<RecommendationProduct[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        const ids = Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string" && /^[a-f0-9]{24}$/i.test(id)).slice(0, MAX_RECENT) : [];
        if (!ids.length) return;
        const response = await fetch("/api/products/recently-viewed?ids=" + encodeURIComponent(ids.join(",")), { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { products?: RecommendationProduct[] };
        if (active) setProducts(data.products ?? []);
      } catch {
        // Keep the shop usable if recommendations cannot be retrieved.
      } finally {
        if (active) setLoaded(true);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  if (!loaded || !products.length) return null;
  return <section className="mt-12" aria-labelledby="recently-viewed-heading">
    <div className="mb-5"><span className="eyebrow">Pick up where you left off</span><h2 id="recently-viewed-heading" className="mt-2 text-2xl font-black">Recently viewed</h2></div>
    <ProductCards products={products} />
  </section>;
}

export function RelatedProducts({ products }: { products: RecommendationProduct[] }) {
  if (!products.length) return null;
  return <section className="mt-14 border-t border-[#f0e9e1] pt-10" aria-labelledby="related-products-heading">
    <span className="eyebrow">A few more lovely finds</span><h2 id="related-products-heading" className="mb-5 mt-2 text-2xl font-black">You may also like</h2>
    <ProductCards products={products} />
  </section>;
}
