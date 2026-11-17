import Link from "next/link";
import { requireRole } from "@/lib/authz";
import { connectDatabase } from "@/lib/db";
import { Refund } from "@/models/Refund";
import { RefundReviewAction } from "@/components/dashboard/refund-review-action";

export const metadata = { title: "Refund management" };

export default async function AdminRefundsPage() {
  await requireRole(["admin", "super-admin"], "/admin/refunds");
  await connectDatabase();
  const refunds = await Refund.find({ status: { $in: ["requested", "approved", "processing"] } })
    .sort({ createdAt: 1 })
    .limit(100)
    .populate("orderId", "orderNumber total paymentMethod paymentStatus")
    .populate("customerId", "name email")
    .lean();

  return <section className="container py-10">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><span className="eyebrow">Finance operations</span><h1 className="mt-4 text-4xl font-black">Refund management</h1><p className="mt-2 text-[#777487]">Review requests, track manual payouts and retain an auditable external reference.</p></div>
      <Link href="/admin" className="rounded-full border border-[#eadfd5] px-5 py-3 text-sm font-bold">Back to admin</Link>
    </div>
    <div className="mt-8 space-y-4">
      {refunds.map(refund => {
        const order = refund.orderId as unknown as { orderNumber?: string; total?: number; paymentMethod?: string; paymentStatus?: string } | null;
        const customer = refund.customerId as unknown as { name?: string; email?: string } | null;
        return <article key={String(refund._id)} className="rounded-3xl border border-[#f0e9e1] bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-wide text-[#a45b2d]">{order?.orderNumber || "Order unavailable"}</p><h2 className="mt-1 text-2xl font-black">৳{Number(refund.amount).toLocaleString("en-BD", { minimumFractionDigits: 2 })}</h2><p className="mt-1 text-sm text-[#777487]">{customer?.name || "Customer"} · {customer?.email || "No email"}</p></div>
            <span className="rounded-full bg-[#fff0e3] px-3 py-1 text-xs font-bold capitalize">{refund.status}</span>
          </div>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <p><span className="text-[#777487]">Payout method:</span> <strong className="capitalize">{String(refund.method).replaceAll("_", " ")}</strong></p>
            <p><span className="text-[#777487]">Order payment:</span> <strong className="capitalize">{order?.paymentMethod || "Unknown"} · {order?.paymentStatus || "Unknown"}</strong></p>
            <p className="sm:col-span-2"><span className="text-[#777487]">Reason:</span> {refund.reason}</p>
            {refund.payoutReference && <p className="sm:col-span-2"><span className="text-[#777487]">Payout reference:</span> {refund.payoutReference}</p>}
          </div>
          <RefundReviewAction refundId={String(refund._id)} status={refund.status} />
        </article>;
      })}
      {!refunds.length && <div className="rounded-3xl border border-dashed border-[#e8ddd2] p-10 text-center"><h2 className="font-black">No pending refunds</h2><p className="mt-2 text-sm text-[#777487]">New refund requests will appear here for review.</p></div>}
    </div>
  </section>;
}
