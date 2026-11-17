import Link from "next/link";
import mongoose from "mongoose";
import { ReturnRequest } from "@/components/dashboard/return-request";
import { CustomerOrderActions, RetryOnlinePayment } from "@/components/storefront";
import { requireRole } from "@/lib/authz";
import { connectDatabase } from "@/lib/db";
import { LoyaltyTransaction } from "@/models/LoyaltyTransaction";
import { Order } from "@/models/Order";

export const metadata = { title: "My account" };

export default async function CustomerAccountPage({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const params = await searchParams;
  const user = await requireRole(["customer"], "/account");
  await connectDatabase();
  const [orders, loyaltyBalanceRows, loyaltyTransactions] = await Promise.all([
    Order.find({ customerId: user.id }).sort({ createdAt: -1 }).limit(30).lean(),
    LoyaltyTransaction.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(user.id) } },
      { $group: { _id: null, balance: { $sum: { $cond: [{ $eq: ["$type", "redeemed"] }, { $multiply: ["$points", -1] }, "$points"] } } } }
    ]),
    LoyaltyTransaction.find({ userId: user.id }).sort({ createdAt: -1 }).limit(10).select("points type description createdAt").lean()
  ]);
  const loyaltyBalance = Number(loyaltyBalanceRows[0]?.balance ?? 0);
  const totalSpent = orders.filter(order => order.paymentStatus === "paid").reduce((sum, order) => sum + order.total, 0);
  const paymentNotice = params.payment === "review"
    ? "Your payment was received but flagged for an additional security review. Please do not pay again; our team will review the transaction."
    : params.payment === "pending"
      ? "Your payment is still being confirmed by the provider. Please do not start another payment for the same order."
      : null;
  return <section className="container py-12"><span className="eyebrow">Pet parent space</span><h1 className="mt-4 text-4xl font-black">Welcome back, {user.name || "Pet parent"} 🐾</h1><p className="mt-2 text-[#777487]">Track your LOVESONE orders and keep your pet&apos;s favourites close.</p>{paymentNotice&&<p role="status" className="mt-5 rounded-2xl border border-[#eadfd5] bg-[#fff4ea] p-4 text-sm leading-6 text-[#6b4a37]">{paymentNotice}</p>}
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Orders placed", orders.length], ["Paid total", `৳${totalSpent.toLocaleString("en-BD")}`], ["In progress", orders.filter(order=>!["delivered","cancelled"].includes(order.status)).length], ["Reward points", loyaltyBalance]].map(([label,value])=><div key={label} className="rounded-3xl border border-[#f0e9e1] bg-white p-6"><p className="text-sm text-[#777487]">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>)}</div>
    <section className="mt-8 rounded-3xl border border-[#f0e9e1] bg-[#fff4ea] p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><span className="eyebrow">LOVESONE rewards</span><h2 className="mt-2 text-2xl font-black">Every delivered order earns a little extra love.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#777487]">Earn 1 point for every ৳100 of your final order total after discounts. Points are added automatically when every seller shipment in an order has been delivered.</p></div><div className="rounded-2xl bg-white px-5 py-4 text-center"><p className="text-xs font-bold uppercase tracking-wide text-[#777487]">Your balance</p><p className="mt-1 text-3xl font-black text-[#a45b2d]">{loyaltyBalance.toLocaleString("en-BD")}</p><p className="text-xs text-[#777487]">points</p></div></div>
      <div className="mt-6 border-t border-[#eadfd5] pt-5"><h3 className="font-black">Recent rewards activity</h3>{loyaltyTransactions.length ? <ul className="mt-3 space-y-3">{loyaltyTransactions.map(transaction=><li key={String(transaction._id)} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3"><div><p className="text-sm font-bold">{transaction.description}</p><p className="mt-1 text-xs text-[#777487]">{new Date(transaction.createdAt).toLocaleDateString("en-BD")}</p></div><span className="font-black text-[#47724d]">+{transaction.points} pts</span></li>)}</ul> : <p className="mt-2 text-sm text-[#777487]">Your first reward will appear here after an eligible order is delivered.</p>}</div>
    </section>
    <div className="mt-10 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black">Your orders</h2><p className="mt-1 text-sm text-[#777487]">Your latest 30 purchases</p></div><div className="flex flex-wrap gap-2"><Link href="/wishlist" className="rounded-full border border-[#eadfd5] px-5 py-3 text-sm font-bold">♡ Saved favourites</Link><Link href="/shop" className="btn">Continue shopping</Link></div></div>
    <div className="mt-5 space-y-3">{orders.length ? orders.map(order=><article key={String(order._id)} className="rounded-2xl border border-[#f0e9e1] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black">{order.orderNumber}</p><p className="mt-1 text-xs text-[#777487]">{order.createdAt.toLocaleString()}</p></div><span className="rounded-full bg-[#fff0e3] px-3 py-1 text-xs font-bold capitalize">{order.status}</span></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-[#777487]">{order.subOrders.reduce((count: number, sub: unknown) => count + (typeof sub === "object" && sub !== null && "items" in sub && Array.isArray(sub.items) ? sub.items.length : 0), 0)} item lines · {order.paymentMethod.toUpperCase()}</p><div className="text-right"><strong>৳{order.total.toLocaleString("en-BD")}</strong><p className="mt-1 text-xs capitalize text-[#777487]">Payment: {order.paymentStatus}</p></div></div><ReturnRequest orderId={String(order._id)} status={order.returnRequest?.status} />
      <CustomerOrderActions orderId={String(order._id)} status={order.status} paymentStatus={order.paymentStatus} paymentAttemptActive={Boolean(order.paymentAttemptId)} />{order.paymentMethod === "sslcommerz" && order.paymentStatus === "pending" && order.status === "pending" && <RetryOnlinePayment orderId={String(order._id)} />}</article>):<div className="rounded-3xl border border-dashed border-[#e8ddd2] p-10 text-center"><p className="font-bold">Your first pet haul is waiting.</p><p className="mt-2 text-sm text-[#777487]">Explore treats, toys, food and everyday essentials.</p><Link href="/shop" className="btn mt-5">Explore the shop</Link></div>}</div>
  </section>;
}
