export default function AppLoading() {
  return (
    <main className="container min-h-[65vh] py-10" aria-busy="true" aria-label="Loading page">
      <div className="animate-pulse">
        <div className="h-3 w-32 rounded-full bg-[#eadfd5]" />
        <div className="mt-4 h-9 w-64 max-w-full rounded-xl bg-[#eadfd5]" />
        <div className="mt-3 h-4 w-80 max-w-full rounded bg-[#f0e9e1]" />
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="overflow-hidden rounded-3xl border border-[#f0e9e1] bg-white">
              <div className="aspect-[4/3] bg-[#f7eee6]" />
              <div className="space-y-3 p-5">
                <div className="h-4 w-3/4 rounded bg-[#eadfd5]" />
                <div className="h-4 w-1/3 rounded bg-[#f0e9e1]" />
                <div className="h-10 rounded-full bg-[#f7eee6]" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading LOVESONE…</span>
    </main>
  );
}
