import { CartView } from "@/components/storefront";
export const metadata={title:"Your shopping bag"};
export default function CartPage(){return <section className="container py-12"><span className="eyebrow">Saved for your sidekick</span><h1 className="mt-3 mb-8 text-4xl font-black">Your shopping bag.</h1><CartView/></section>;}