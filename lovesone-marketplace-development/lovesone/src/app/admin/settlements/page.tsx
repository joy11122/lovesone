import Link from "next/link";
import { requireRole } from "@/lib/authz";
import { connectDatabase } from "@/lib/db";
import { VendorSettlement } from "@/models/VendorSettlement";
import { SettlementPayoutAction } from "@/components/dashboard/settlement-payout-action";

export const metadata = { title: "Vendor settlements" };

export default async function AdminSettlementsPage() {
  await requireRole(["admin", "super-admin"], "/admin/settlements");
  await connectDatabase();
  const settlements = await VendorSettlement.find()
    .sort({ status: 1, createdAt: 1 })
    .limit(200)
    .populate("vendorId", "name email")
    .populate("orderId", "orderNumber")
    .lean();

  return <section className="container py-10">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><span className="eyebrow">Finance operations</span><h1 className="mt-4 text-4xl font-black">Vendor settlements</h1><p className="mt-2 text-[#777487]">Review the per-order vendor ledger and record confirmed external payouts.</p></div>
      <Link href="/admin" className="rounded-full border border-[#eadfd5] px-5 py-3 text-sm font-bold">Back to admin</Link>
    </div>
    <div className="mt-8 space-y-3">
      {settlements.map((settlement) => {
        const vendor = settlement.vendorId as unknown as { name?: string; email?: string } | null;
        const order = settlement.orderId as unknown as { orderNumber?: string } | null;
        return <article key={String(settlement._id)} className="rounded-3xl border border-[#f0e9e1] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-wide text-[#a45b2d]">{order?.orderNumber || "Order unavailable"}</p><h2 className="mt-1 text-xl font-black">{vendor?.name || "Vendor"}</h2><p className="mt-1 text-sm text-[#777487]">{vendor?.email || "No email"}</p></div>
            <span className="rounded-full bg-[#fff0e3] px-3 py-1 text-xs font-bold capitalize">{settlement.status}</span>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-[#777487]">Gross</dt><dd className="font-bold">৳{Number(settlement.grossAmount).toLocaleString("en-BD", { minimumFractionDigits: 2 })}</dd></div>
            <div><dt className="text-[#777487]">Refund share</dt><dd className="font-bold">৳{Number(settlement.refundShare).toLocaleString("en-BD", { minimumFractionDigits: 2 })}</dd></div>
            <div><dt className="text-[#777487]">Platform commission ({(Number(settlement.commissionBps) / 100).toFixed(2)}%)</dt><dd className="font-bold">৳{Number(settlement.commissionAmount).toLocaleString("en-BD", { minimumFractionDigits: 2 })}</dd></div>
            <div><dt className="text-[#777487]">Vendor net</dt><dd className="text-lg font-black">৳{Number(settlement.netAmount).toLocaleString("en-BD", { minimumFractionDigits: 2 })}</dd></div>
          </dl>
          {settlement.payoutReference && <p className="mt-3 break-all text-xs text-[#777487]">Payout reference: {settlement.payoutReference}</p>}
          <SettlementPayoutAction settlementId={String(settlement._id)} status={settlement.status} />
        </article>;
      })}
      {!settlements.length && <div className="rounded-3xl border border-dashed border-[#e8ddd2] p-10 text-center"><h2 className="font-black">No vendor settlements yet</h2><p className="mt-2 text-sm text-[#777487]">Create a settlement from an eligible delivered order using the order settlement API.</p></div>}
    </div>
  </section>;
}
