import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "LOVESONE — Your pet's happy place",
  description:
    "A thoughtfully curated pet marketplace for cats, dogs, birds, fish and small pets in Bangladesh.",
};

const categories = [
  { name: "Food & nutrition", slug: "food", detail: "Everyday meals, treats and healthy nutrition", mark: "🥣" },
  { name: "Pet fashion", slug: "fashion", detail: "Comfortable outfits for little companions", mark: "🧣" },
  { name: "Health & medicine", slug: "medicine", detail: "Care essentials for happier, healthier pets", mark: "🩺" },
  { name: "Grooming", slug: "grooming", detail: "Bath time, brushes and coat care", mark: "🧼" },
  { name: "Toys & play", slug: "toys", detail: "Enrichment, exercise and joyful play", mark: "🧸" },
  { name: "Beds & furniture", slug: "beds", detail: "Cosy corners and comfy naps", mark: "🛏️" },
  { name: "Accessories", slug: "accessories", detail: "Useful everyday pet-parent essentials", mark: "🐾" },
  { name: "Aquarium supplies", slug: "aquariums", detail: "Everything for beautiful aquatic homes", mark: "🐠" },
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden">
      

      <section className="container grid items-center gap-10 pb-16 pt-10 md:grid-cols-[1.05fr_.95fr] md:pb-24 md:pt-16">
        <div>
          <span className="eyebrow">A little more love, every day</span>
          <h1 className="mt-5 max-w-2xl text-5xl font-black leading-[1.06] tracking-tight sm:text-6xl">
            Everything your
            <span className="block text-[#c46b3d]">best friend</span>
            deserves.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#777487]">
            Discover thoughtful essentials for the pets who make your house a home.
            LOVESONE is building a trusted place for pet parents across Bangladesh.
          </p>
          <Link href="/shop" className="btn mt-8">Explore pet categories <span aria-hidden="true" className="ml-2">→</span></Link>
          <p className="mt-4 text-xs text-[#96919a]">Made for every paw, fin, feather and little friend.</p>
        </div>

        <div className="relative mx-auto flex aspect-square w-full max-w-[470px] items-center justify-center rounded-[3rem] bg-[#f7e9dc] p-8">
          <div className="absolute left-8 top-8 h-20 w-20 rounded-full bg-[#f1d1b8]" />
          <div className="absolute bottom-10 right-8 h-28 w-28 rounded-full bg-[#e9c6ad]" />
          <div className="relative flex h-full w-full flex-col items-center justify-center rounded-[2.5rem] border border-white/70 bg-[#fffaf5]/70 text-center shadow-[0_25px_70px_rgba(85,54,34,0.08)]">
            <span className="text-8xl sm:text-9xl" role="img" aria-label="Happy pet paw">🐾</span>
            <p className="mt-5 text-2xl font-black">Love lives here.</p>
            <p className="mt-2 text-sm text-[#777487]">For the ones who make life brighter.</p>
          </div>
        </div>
      </section>

      <section id="categories" className="bg-[#fff4ea] py-16 sm:py-20">
        <div className="container">
          <div className="max-w-xl">
            <span className="eyebrow">Find their favourites</span>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">A happy place for every kind of pet.</h2>
            <p className="mt-3 leading-7 text-[#777487]">We are bringing trusted pet essentials together in one welcoming marketplace.</p>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <a href={`/shop?category=${category.slug}`} key={category.slug} className="block rounded-3xl border border-[#f0e5db] bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg">
                <span className="text-4xl" role="img" aria-label={category.name}>{category.mark}</span>
                <h3 className="mt-5 text-xl font-black">{category.name}</h3>
                <p className="mt-2 text-sm leading-6 text-[#777487]">{category.detail}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="container py-16 text-center sm:py-20">
        <span className="eyebrow">The LOVESONE promise</span>
        <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">Because they are family. Not just pets.</h2>
        <p className="mx-auto mt-4 max-w-2xl leading-7 text-[#777487]">
          Our goal is simple: make caring for your companion easier with a thoughtful,
          dependable pet-shopping experience.
        </p>
      </section>

    </main>
  );
}
