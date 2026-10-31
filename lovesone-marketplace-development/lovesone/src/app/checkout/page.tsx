import { requireRole } from "@/lib/authz";
import { CheckoutForm } from "@/components/storefront";
export const metadata={title:"Checkout"};
export default async function CheckoutPage(){await requireRole(["customer"]);return <section className="container py-12"><span className="eyebrow">Almost home</span><h1 className="mt-3 mb-8 text-4xl font-black">Checkout.</h1><CheckoutForm/></section>;}