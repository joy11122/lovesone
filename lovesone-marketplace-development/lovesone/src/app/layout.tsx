import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "LOVESONE — Pet Marketplace", template: "%s | LOVESONE" },
  description: "Discover trusted pet products for cats, dogs, birds, fish and small pets across Bangladesh.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
