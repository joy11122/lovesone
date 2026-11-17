import Link from "next/link";
import { requireRole } from "@/lib/authz";
import { connectDatabase } from "@/lib/db";
import { PaymentTransaction } from "@/models/PaymentTransaction";
import { PaymentReconcileAction } from "@/components/dashboard/payment-reconcile-action";

export const metadata = { title: "Payment reconciliation" };

export default async function AdminPaymentReconciliationPage() {
  await requireRole(["admin", "super-admin"], "/admin/payments");
  await connectDatabase();
  const transactions = await PaymentTransaction.find({
    provider: "sslcommerz",
    status: { $in: ["pending", "initiated"] },
    $expr: { $lt: ["$createdAt", { $dateSubtract: { startDate: "$NOW", unit: "minute", amount: 5 } }] }
  })
    .sort({ createdAt: 1 })
    .limit(100)
    .populate("orderId", "orderNumber total")
    .lean();

  return <section className="container py-10">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><span className="eyebrow">Finance operations</span><h1 className="mt-4 text-4xl font-black">Payment reconciliation</h1><p className="mt-2 text-[#777487]">Compare stale payment attempts with SSLCommerz server-side records. Browser redirects are never treated as payment proof.</p></div>
      <Link href="/admin" className="rounded-full border border-[#eadfd5] px-5 py-3 text-sm font-bold">Back to admin</Link>
    </div>
    <div className="mt-8 space-y-3">
      {transactions.map(transaction => {
        const order = transaction.orderId as unknown as { orderNumber?: string; total?: number } | null;
        return <article key={String(transaction._id)} className="rounded-3xl border border-[#f0e9e1] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><strong>{order?.orderNumber || "Order reference unavailable"}</strong><p className="mt-1 break-all text-xs text-[#777487]">{transaction.transactionId}</p><p className="mt-2 text-sm">Expected: ৳{Number(transaction.amount).toLocaleString("en-BD", { minimumFractionDigits: 2 })} · {transaction.currency}</p><p className="mt-1 text-xs text-[#777487]">Started {transaction.createdAt.toLocaleString()}</p></div>
            <span className="rounded-full bg-[#fff0e3] px-3 py-1 text-xs font-bold capitalize">{transaction.status}</span>
          </div>
          <PaymentReconcileAction transactionId={transaction.transactionId} />
        </article>;
      })}
      {!transactions.length && <div className="rounded-3xl border border-dashed border-[#e8ddd2] p-10 text-center"><h2 className="font-black">No stale payment attempts</h2><p className="mt-2 text-sm text-[#777487]">Older pending SSLCommerz transactions will appear here.</p></div>}
    </div>
  </section>;
}
