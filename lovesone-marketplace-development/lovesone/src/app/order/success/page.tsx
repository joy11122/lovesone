import Link from "next/link";
import mongoose from "mongoose";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { connectDatabase } from "@/lib/db";
import { Order } from "@/models/Order";

export const metadata = { title: "Order confirmed" };
export const dynamic = "force-dynamic";

export default async function OrderSuccessPage({ searchParams }: { searchParams: Promise<{ orderId?: string }> }) {
  const params = await searchParams;
  const orderId = params.orderId ?? "";
  const user = await requireRole(["customer"], `/order/success?orderId=${encodeURIComponent(orderId)}`);
  if (!mongoose.isValidObjectId(orderId)) notFound();
  await connectDatabase();
  const order = await Order.findOne({ _id: orderId, customerId: user.id }).lean();
  if (!order) notFound();

  return <main className="container flex min-h-[65vh] items-center justify-center py-14"><section className="w-full max-w-2xl rounded-[2rem] border border-[#f0e9e1] bg-white p-8 text-center shadow-[0_20px_60px_rgba(75,48,28,.06)] sm:p-12"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#edf5eb] text-4xl" aria-hidden="true">✓</div><span className="eyebrow mt-6 block">A happy delivery is on its way</span><h1 className="mt-3 text-3xl font-black sm:text-4xl">Your order is confirmed!</h1><p className="mt-3 leading-7 text-[#777487]">Thank you for shopping with LOVESONE. Keep your phone nearby so the delivery team can reach you.</p><div className="mt-8 rounded-2xl bg-[#fff4ea] p-5 text-left"><div className="flex flex-wrap justify-between gap-3"><span className="text-sm text-[#777487]">Order number</span><strong>{order.orderNumber}</strong></div><div className="mt-3 flex flex-wrap justify-between gap-3"><span className="text-sm text-[#777487]">Order total</span><strong>৳{order.total.toLocaleString("en-BD")}</strong></div><div className="mt-3 flex flex-wrap justify-between gap-3"><span className="text-sm text-[#777487]">Payment</span><strong className="capitalize">{order.paymentMethod === "cod" ? "Cash on delivery" : order.paymentMethod}</strong></div><div className="mt-3 flex flex-wrap justify-between gap-3"><span className="text-sm text-[#777487]">Status</span><strong className="capitalize">{order.status}</strong></div></div><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/account" className="btn">View my orders</Link><Link href="/shop" className="rounded-full border border-[#eadfd5] px-5 py-3 text-sm font-bold">Continue shopping</Link></div></section></main>;
}