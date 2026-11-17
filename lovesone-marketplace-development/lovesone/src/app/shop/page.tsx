import Link from "next/link";
import Image from "next/image";
import { connectDatabase } from "@/lib/db";
import { Product } from "@/models/Product";
import { RecentlyViewedProducts } from "@/components/product-recommendations";

export const metadata = { title: "Shop pet essentials" };
export const dynamic = "force-dynamic";

const categories = [
  { slug: "food", label: "Food & nutrition", icon: "🥣" },
  { slug: "fashion", label: "Pet fashion", icon: "🧣" },
  { slug: "medicine", label: "Health & medicine", icon: "🩺" },
  { slug: "grooming", label: "Grooming", icon: "🧼" },
  { slug: "toys", label: "Toys & play", icon: "🧸" },
  { slug: "beds", label: "Beds & furniture", icon: "🛏️" },
  { slug: "accessories", label: "Accessories", icon: "🐾" },
  { slug: "aquariums", label: "Aquarium supplies", icon: "🐠" },
];

type ShopSearchParams = {
  category?: string;
  q?: string;
  sort?: string;
  page?: string;
  min?: string;
  max?: string;
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validPrice(value?: string) {
  if (!value || !/^\d{1,8}(?:\.\d{1,2})?$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<ShopSearchParams> }) {
  const params = await searchParams;
  const selectedCategory = categories.find((category) => category.slug === params.category);
  const query = (params.q || "").trim().slice(0, 80);
  const sort = ["price-asc", "price-desc"].includes(params.sort || "") ? params.sort! : "newest";
  const minPrice = validPrice(params.min);
  const maxPrice = validPrice(params.max);
  const requestedPage = /^\d{1,5}$/.test(params.page || "") ? Number(params.page) : 1;
  const pageSize = 16;

  let products: Array<{
    _id: unknown;
    slug: string;
    title: string;
    categorySlug: string;
    imageUrl?: string;
    price: number;
    stock: number;
  }> = [];
  let totalProducts = 0;
  let catalogueUnavailable = false;
  let currentPage = requestedPage;

  try {
    await connectDatabase();
    const filter: Record<string, unknown> = { status: "active", deletedAt: null };
    const conditions: Record<string, unknown>[] = [];

    if (selectedCategory) {
      const slugPattern = new RegExp("^" + escapeRegex(selectedCategory.slug) + "$", "i");
      const labelPattern = new RegExp("^" + escapeRegex(selectedCategory.label) + "$", "i");
      conditions.push({
        $or: [
          { categorySlug: slugPattern },
          { categorySlug: labelPattern },
          { category: slugPattern },
          { category: labelPattern },
        ],
      });
    }
    if (query) {
      const searchPattern = new RegExp(escapeRegex(query), "i");
      conditions.push({ $or: [{ title: searchPattern }, { description: searchPattern }] });
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      const price: Record<string, number> = {};
      if (minPrice !== undefined) price.$gte = minPrice;
      if (maxPrice !== undefined) price.$lte = maxPrice;
      conditions.push({ price });
    }
    if (conditions.length) filter.$and = conditions;

    totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize));
    currentPage = Math.min(requestedPage, totalPages);
    const sortOption: Record<string, 1 | -1> = sort === "price-asc"
      ? { price: 1, _id: 1 }
      : sort === "price-desc"
        ? { price: -1, _id: 1 }
        : { createdAt: -1, _id: -1 };

    const fetchedProducts = await Product.find(filter)
      .sort(sortOption)
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .select("slug title categorySlug imageUrl price stock")
      .lean();
    products = fetchedProducts as unknown as typeof products;
  } catch (error) {
    catalogueUnavailable = true;
    console.error("Shop catalogue could not be loaded", error);
  }

  const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize));
  const pageHref = (page: number) => {
    const next = new URLSearchParams();
    if (selectedCategory) next.set("category", selectedCategory.slug);
    if (query) next.set("q", query);
    if (sort !== "newest") next.set("sort", sort);
    if (minPrice !== undefined) next.set("min", String(minPrice));
    if (maxPrice !== undefined) next.set("max", String(maxPrice));
    next.set("page", String(page));
    return `/shop?${next.toString()}`;
  };

  return (
    <main className="container py-10 sm:py-14">
      <section className="rounded-[2rem] bg-[#fff0e3] px-6 py-9 sm:px-10 sm:py-12">
        <span className="eyebrow">The pet essentials edit</span>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
          <div><h1 className="text-4xl font-black tracking-tight sm:text-5xl">Shop their happy place.</h1><p className="mt-3 max-w-xl leading-7 text-[#777487]">Thoughtful finds for every paw, fin and feather. Browse the collection by what your companion needs.</p></div>
          <Link href="/vendor/register" className="rounded-full border border-[#e7cbb7] bg-white/70 px-5 py-3 text-sm font-bold">Sell on LOVESONE</Link>
        </div>
      </section>

      <section className="mt-9">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><span className="eyebrow">Browse by need</span><h2 className="mt-2 text-2xl font-black">Find their favourites</h2></div><Link href="/shop" className="text-sm font-bold text-[#a45b2d]">Clear filters →</Link></div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{categories.map((category) => <Link key={category.slug} href={`/shop?category=${category.slug}`} aria-current={selectedCategory?.slug === category.slug ? "page" : undefined} className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${selectedCategory?.slug === category.slug ? "border-[#c46b3d] bg-[#fff0e3]" : "border-[#f0e9e1] bg-white"}`}><span className="text-2xl" aria-hidden="true">{category.icon}</span><span className="mt-2 block text-sm font-bold">{category.label}</span></Link>)}</div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><span className="eyebrow">Made for happy pets</span><h2 className="mt-2 text-2xl font-black">{selectedCategory ? selectedCategory.label : "All products"}</h2><p className="mt-1 text-sm text-[#777487]">{catalogueUnavailable ? "Product listings are temporarily unavailable." : `${totalProducts} ${totalProducts === 1 ? "product" : "products"} found`}</p></div></div>
        <form action="/shop" method="get" className="mt-5 grid gap-3 rounded-3xl border border-[#f0e9e1] bg-white p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
          <label className="text-sm font-bold lg:col-span-2">Search products<input name="q" type="search" maxLength={80} defaultValue={query} placeholder="Try food, toys, grooming…" className="mt-2 w-full rounded-full border border-[#eadfd5] bg-white px-4 py-3 font-normal outline-none focus:border-[#c46b3d] focus:ring-2 focus:ring-[#c46b3d]/15"/></label>
          <label className="text-sm font-bold">Category<select name="category" defaultValue={selectedCategory?.slug ?? ""} className="mt-2 w-full rounded-full border border-[#eadfd5] bg-white px-4 py-3 font-normal"><option value="">All categories</option>{categories.map((category) => <option key={category.slug} value={category.slug}>{category.label}</option>)}</select></label>
          <label className="text-sm font-bold">Sort by<select name="sort" defaultValue={sort} className="mt-2 w-full rounded-full border border-[#eadfd5] bg-white px-4 py-3 font-normal"><option value="newest">Newest</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select></label>
          <label className="text-sm font-bold">Min price (৳)<input name="min" inputMode="decimal" defaultValue={minPrice?.toString() ?? ""} placeholder="0" className="mt-2 w-full rounded-full border border-[#eadfd5] px-4 py-3 font-normal"/></label>
          <label className="text-sm font-bold">Max price (৳)<input name="max" inputMode="decimal" defaultValue={maxPrice?.toString() ?? ""} placeholder="Any" className="mt-2 w-full rounded-full border border-[#eadfd5] px-4 py-3 font-normal"/></label>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-6"><button className="btn" type="submit">Apply filters</button><Link href="/shop" className="rounded-full border border-[#eadfd5] px-5 py-3 text-sm font-bold">Reset</Link></div>
        </form>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{products.map((product) => { const category = categories.find((item) => item.slug === product.categorySlug); return <article key={String(product._id)} className="group overflow-hidden rounded-3xl border border-[#f0e9e1] bg-white transition hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(75,48,28,.08)]"><Link href={`/product/${product.slug}`} className="block"><div className="relative flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-[#fff4ea] to-[#f7e5d5]">{product.imageUrl ? <Image src={product.imageUrl} alt={product.title} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-contain p-3" /> : <span className="text-7xl transition group-hover:scale-110" aria-hidden="true">{category?.icon ?? "🐾"}</span>}<span className="absolute left-4 top-4 rounded-full bg-white/85 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#a45b2d]">{category?.label ?? product.categorySlug}</span></div><div className="p-5"><h3 className="line-clamp-2 min-h-12 font-black">{product.title}</h3><div className="mt-3 flex items-center justify-between gap-2"><span className="text-xl font-black">৳{product.price.toLocaleString("en-BD")}</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${product.stock > 0 ? "bg-[#edf5eb] text-[#47724d]" : "bg-[#f7eeee] text-[#a14b4b]"}`}>{product.stock > 0 ? "In stock" : "Sold out"}</span></div><span className="mt-4 inline-flex text-sm font-bold text-[#a45b2d]">View details <span className="ml-2 transition group-hover:translate-x-1">→</span></span></div></Link></article>; })}</div>

        {!products.length && <div className="mt-7 rounded-[2rem] border border-dashed border-[#e8ddd2] bg-white px-6 py-14 text-center"><span className="text-5xl" aria-hidden="true">{catalogueUnavailable ? "⏳" : "🐾"}</span><h3 className="mt-4 text-2xl font-black">{catalogueUnavailable ? "We’re refreshing the shop." : "No matching products found."}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#777487]">{catalogueUnavailable ? "The shop is open, but product listings could not be loaded right now. Please try again in a moment." : "Try a different search or remove one or more filters to discover more products."}</p><Link href="/shop" className="btn mt-6">Browse all products</Link></div>}

        {totalPages > 1 && <nav aria-label="Product pages" className="mt-9 flex flex-wrap items-center justify-center gap-2"><Link aria-disabled={currentPage <= 1} tabIndex={currentPage <= 1 ? -1 : 0} href={pageHref(Math.max(1, currentPage - 1))} className={`rounded-full border px-4 py-2 text-sm font-bold ${currentPage <= 1 ? "pointer-events-none border-[#eee5dc] text-[#b8b0aa]" : "border-[#eadfd5] hover:bg-[#fff0e3]"}`}>Previous</Link><span className="px-3 text-sm text-[#777487]">Page {currentPage} of {totalPages}</span><Link aria-disabled={currentPage >= totalPages} tabIndex={currentPage >= totalPages ? -1 : 0} href={pageHref(Math.min(totalPages, currentPage + 1))} className={`rounded-full border px-4 py-2 text-sm font-bold ${currentPage >= totalPages ? "pointer-events-none border-[#eee5dc] text-[#b8b0aa]" : "border-[#eadfd5] hover:bg-[#fff0e3]"}`}>Next</Link></nav>}
      </section>
      <RecentlyViewedProducts />
    </main>
  );
}
