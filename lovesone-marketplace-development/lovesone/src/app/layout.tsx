import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { CartProvider, SiteHeader, SiteFooter } from "@/components/storefront";
import { auth } from "@/auth";

export const metadata: Metadata = {
  title: { default: "LOVESONE — Pet Marketplace", template: "%s | LOVESONE" },
  description: "Discover trusted pet products for cats, dogs, birds, fish and small pets across Bangladesh.",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await auth().catch(() => null);
  return <html lang="en"><body><CartProvider><SiteHeader session={session} />{children}<SiteFooter /></CartProvider></body></html>;
}
