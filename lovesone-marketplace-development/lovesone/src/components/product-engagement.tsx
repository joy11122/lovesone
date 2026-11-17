"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

export type WishlistProduct = { _id: string; slug: string; title: string; price: number; stock: number; imageUrl?: string; categorySlug?: string };
type ReviewItem = { _id: string; rating: number; title: string; body: string; createdAt: string; customerId?: { name?: string } | string };

export function WishlistButton({ productId }: { productId: string }) {
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/wishlist").then(async response => {
      if (!response.ok) return null;
      return response.json() as Promise<{ products?: WishlistProduct[] }>;
    }).then(data => {
      if (active) setSaved(Boolean(data?.products?.some(product => String(product._id) === productId)));
    }).catch(() => undefined).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [productId]);

  async function toggle() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/wishlist", {
        method: saved ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update wishlist.");
      setSaved(!saved);
      setMessage(saved ? "Removed from saved favourites." : "Saved to your wishlist.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Please sign in to save this product.");
    } finally { setBusy(false); }
  }

  return <div className="mt-3">
    <button type="button" onClick={() => void toggle()} disabled={busy || !ready} aria-pressed={saved}
      className="w-full rounded-full border border-[#eadfd5] px-5 py-3 text-sm font-bold text-[#8c4b2a] transition hover:bg-[#fff4ea] disabled:opacity-60">
      {busy ? "Saving…" : saved ? "♥ Saved to wishlist" : "♡ Save to wishlist"}
    </button>
    {message && <p role="status" className="mt-2 text-center text-xs text-[#777487]">{message}{message.toLowerCase().includes("sign in") && <> <Link className="font-bold text-[#a45b2d] underline" href="/login">Sign in</Link></>}</p>}
  </div>;
}

export function WishlistGrid({ products: initialProducts }: { products: WishlistProduct[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  async function remove(productId: string) {
    setBusyId(productId); setMessage("");
    try {
      const response = await fetch("/api/wishlist", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to remove this product.");
      setProducts(current => current.filter(product => product._id !== productId));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update wishlist."); }
    finally { setBusyId(""); }
  }
  if (!products.length) return <div className="rounded-3xl border border-dashed border-[#e8ddd2] bg-white p-10 text-center"><p className="text-4xl">♡</p><h2 className="mt-3 text-xl font-black">No saved favourites yet.</h2><p className="mt-2 text-sm text-[#777487]">Save products you love and find them here later.</p><Link href="/shop" className="btn mt-5">Explore the shop</Link></div>;
  return <div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{products.map(product => <article key={product._id} className="rounded-3xl border border-[#f0e9e1] bg-white p-5"><Link href={"/product/" + product.slug} className="font-black hover:text-[#a45b2d]">{product.title}</Link><p className="mt-2 text-lg font-black">৳{product.price.toLocaleString("en-BD")}</p><p className="mt-1 text-xs text-[#777487]">{product.stock > 0 ? "In stock" : "Currently out of stock"}</p><div className="mt-4 flex gap-2"><Link href={"/product/" + product.slug} className="btn flex-1 text-center">View product</Link><button type="button" disabled={busyId === product._id} onClick={() => void remove(product._id)} className="rounded-full border border-[#eadfd5] px-4 py-2 text-xs font-bold text-[#a45b2d]">{busyId === product._id ? "Removing…" : "Remove"}</button></div></article>)}</div>{message && <p role="alert" className="mt-4 text-sm text-red-700">{message}</p>}</div>;
}

export function ProductReviews({ productId }: { productId: string }) {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [average, setAverage] = useState(0);
  const [count, setCount] = useState(0);
  const [rating, setRating] = useState("5");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/products/" + productId + "/reviews");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load reviews.");
    setReviews(data.reviews ?? []);
    setAverage(data.summary?.average ?? 0);
    setCount(data.summary?.count ?? 0);
  }
  useEffect(() => { let active = true; fetch("/api/products/" + productId + "/reviews").then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); if (active) { setReviews(data.reviews ?? []); setAverage(data.summary?.average ?? 0); setCount(data.summary?.count ?? 0); } }).catch(() => { if (active) setMessage("Reviews are temporarily unavailable."); }); return () => { active = false; }; }, [productId]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/products/" + productId + "/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating: Number(rating), title, body }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to submit review.");
      setTitle(""); setBody(""); setMessage(data.message || "Review submitted.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to submit review."); }
    finally { setBusy(false); }
  }

  return <section className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
    <div><span className="eyebrow">Real pet-parent feedback</span><h2 className="mt-2 text-2xl font-black">Ratings & reviews</h2><p className="mt-3 text-3xl font-black">{average ? average.toFixed(1) + " / 5" : "—"}</p><p className="mt-1 text-sm text-[#777487]">{count} {count === 1 ? "review" : "reviews"}</p>
      <form onSubmit={submit} className="mt-6 rounded-3xl border border-[#f0e9e1] bg-white p-5"><h3 className="font-black">Share your experience</h3><p className="mt-1 text-xs leading-5 text-[#777487]">Only customers with a delivered order containing this product can publish a review.</p><label className="mt-4 block text-sm font-bold">Your rating<select value={rating} onChange={event => setRating(event.target.value)} className="mt-2 w-full rounded-xl border border-[#eadfd5] bg-white px-3 py-3 font-normal">{[5,4,3,2,1].map(value => <option key={value} value={value}>{value} out of 5</option>)}</select></label><label className="mt-3 block text-sm font-bold">Review title <input value={title} onChange={event => setTitle(event.target.value)} maxLength={100} className="mt-2 w-full rounded-xl border border-[#eadfd5] px-3 py-3 font-normal" placeholder="What stood out?"/></label><label className="mt-3 block text-sm font-bold">Your review <textarea value={body} onChange={event => setBody(event.target.value)} minLength={10} maxLength={2000} required rows={4} className="mt-2 w-full rounded-xl border border-[#eadfd5] px-3 py-3 font-normal" placeholder="Share details that may help other pet parents…"/></label><button disabled={busy} className="btn mt-4 w-full">{busy ? "Submitting…" : "Submit review"}</button>{message && <p role="status" className="mt-3 text-xs text-[#777487]">{message}</p>}</form>
    </div>
    <div className="space-y-3">{reviews.length ? reviews.map(review => <article key={review._id} className="rounded-3xl border border-[#f0e9e1] bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{typeof review.customerId === "object" ? review.customerId?.name || "Verified customer" : "Verified customer"}</strong><span className="text-sm font-bold text-[#a45b2d]">{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</span></div>{review.title && <h3 className="mt-3 font-black">{review.title}</h3>}<p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#625b59]">{review.body}</p><p className="mt-3 text-xs text-[#96919a]">{new Date(review.createdAt).toLocaleDateString("en-BD")}</p></article>) : <div className="rounded-3xl border border-dashed border-[#e8ddd2] p-8 text-center text-sm text-[#777487]">No reviews yet. Be the first eligible customer to share feedback.</div>}</div>
  </section>;
}
