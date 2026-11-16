"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#fffaf5", color: "#241d1a", fontFamily: "Arial, Helvetica, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px", textAlign: "center" }}>
          <section style={{ maxWidth: "480px" }}>
            <div aria-hidden="true" style={{ fontSize: "64px" }}>🐾</div>
            <p style={{ color: "#a45b2d", fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", fontSize: "12px" }}>LOVESONE</p>
            <h1 style={{ fontSize: "32px", lineHeight: 1.15 }}>We hit an unexpected snag.</h1>
            <p style={{ color: "#777487", lineHeight: 1.7 }}>The page could not be displayed. Please try again.</p>
            <button onClick={reset} style={{ border: 0, borderRadius: "999px", background: "#241d1a", color: "white", padding: "13px 22px", fontWeight: 700, cursor: "pointer" }}>Try again</button>
          </section>
        </main>
      </body>
    </html>
  );
}
