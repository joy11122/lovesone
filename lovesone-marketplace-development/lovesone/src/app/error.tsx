"use client";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="container flex min-h-[65vh] flex-col items-center justify-center py-16 text-center">
      <span className="text-6xl" role="img" aria-label="Paw print">🐾</span>
      <p className="eyebrow mt-6">A small hiccup</p>
      <h1 className="mt-3 text-3xl font-black sm:text-4xl">Something went wrong.</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-[#777487]">
        We couldn’t load this part of LOVESONE. Your account and order information have not been intentionally changed.
        Please try again.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn">Try again</button>
        <a href="/" className="inline-flex min-h-11 items-center rounded-full border border-[#eadfd5] px-5 py-3 text-sm font-bold hover:bg-[#fff4ea]">Back to home</a>
      </div>
    </main>
  );
}
