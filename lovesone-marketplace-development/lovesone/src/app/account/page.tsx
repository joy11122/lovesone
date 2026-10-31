import Link from "next/link";
import { ReturnRequest } from "@/components/dashboard/return-request";
import { requireRole } from "@/lib/authz";
import { connectDatabase } from "@/lib/db";
import { Order } from "@/models/Order";

export const metadata = { title: "My account" };

export default async function CustomerAccountPage() {
  const user = await requireRole(["customer"]);
  await connectDatabase();
  const orders = await Order.find({ customerId: user.id }).sort({ createdAt: -1 }).limit(30).lean();
  const totalSpent = orders.filter(order => order.paymentStatus === "paid").reduce((sum, order) => sum + order.total, 0);
  return <section className="container py-12"><span className="eyebrow">Pet parent space</span><h1 className="mt-4 text-4xl font-black">Welcome back, {user.name || "Pet parent"} 🐾</h1><p className="mt-2 text-[#777487]">Track your LOVESONE orders and keep your pet's favourites close.</p>
    <div className="mt-8 grid gap-4 sm:grid-cols-3">{[["Orders placed", orders.length],["Paid total", `৳${totalSpent.toLocaleString("en-BD")}`],["In progress", orders.filter(order=>!["delivered","cancelled"].includes(order.status)).length]].map(([label,value])=><div key={label} className="rounded-3xl border border-[#f0e9e1] bg-white p-6"><p className="text-sm text-[#777487]">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>)}</div>
    <div className="mt-10 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black">Your orders</h2><p className="mt-1 text-sm text-[#777487]">Your latest 30 purchases</p></div><Link href="/shop" className="btn">Continue shopping</Link></div>
    <div className="mt-5 space-y-3">{orders.length ? orders.map(order=><article key={String(order._id)} className="rounded-2xl border border-[#f0e9e1] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black">{order.orderNumber}</p><p className="mt-1 text-xs text-[#777487]">{order.createdAt.toLocaleString()}</p></div><span className="rounded-full bg-[#fff0e3] px-3 py-1 text-xs font-bold capitalize">{order.status}</span></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-[#777487]">{order.subOrders.reduce((count, sub)=>count+sub.items.length,0)} item lines · {order.paymentMethod.toUpperCase()}</p><div className="text-right"><strong>৳{order.total.toLocaleString("en-BD")}</strong><p className="mt-1 text-xs capitalize text-[#777487]">Payment: {order.paymentStatus}</p></div></div><ReturnRequest orderId={String(order._id)} status={order.returnRequest?.status} /></article>):<div className="rounded-3xl border border-dashed border-[#e8ddd2] p-10 text-center"><p className="font-bold">Your first pet haul is waiting.</p><p className="mt-2 text-sm text-[#777487]">Explore treats, toys, food and everyday essentials.</p><Link href="/shop" className="btn mt-5">Explore the shop</Link></div>}</div>
  </section>;
}
