"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export type AdminCoupon = {
  _id: string;
  code: string;
  description?: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderAmount: number;
  maxDiscount?: number | null;
  startsAt: string;
  expiresAt?: string | null;
  usageLimit?: number | null;
  usageCount: number;
  active: boolean;
};

export function CouponManager({ coupons }: { coupons: AdminCoupon[] }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("0");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      if (!startsAt || (expiresAt && new Date(expiresAt) <= new Date(startsAt))) throw new Error("Choose a valid start and expiry date.");
      const response = await fetch("/api/admin/coupons", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code, description, discountType, discountValue: Number(discountValue),
          minOrderAmount: Number(minOrderAmount),
          ...(maxDiscount ? { maxDiscount: Number(maxDiscount) } : {}),
          startsAt: new Date(startsAt).toISOString(),
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          usageLimit: usageLimit ? Number(usageLimit) : null
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create coupon.");
      setCode(""); setDescription(""); setDiscountValue(""); setMinOrderAmount("0"); setMaxDiscount(""); setExpiresAt(""); setUsageLimit("");
      setMessage("Coupon created successfully."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create coupon."); }
    finally { setBusy(false); }
  }

  async function toggle(coupon: AdminCoupon) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/coupons", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ couponId: coupon._id, active: !coupon.active }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update coupon.");
      setMessage(data.message || "Coupon updated."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update coupon."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-8">
    <form onSubmit={create} className="grid gap-4 rounded-3xl border border-[#f0e9e1] bg-white p-6 md:grid-cols-2">
      <div className="md:col-span-2"><h2 className="text-xl font-black">Create a promotion</h2><p className="mt-1 text-sm text-[#777487]">Coupons apply once per customer and are validated again inside the checkout transaction.</p></div>
      <label className="text-sm font-bold">Coupon code<input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} required minLength={3} maxLength={40} pattern="[A-Za-z0-9]+(-[A-Za-z0-9]+)*" placeholder="WELCOME10" className="mt-2 w-full rounded-xl border border-[#eadfd5] px-4 py-3 font-normal"/></label>
      <label className="text-sm font-bold">Discount type<select value={discountType} onChange={e=>setDiscountType(e.target.value as "percentage"|"fixed")} className="mt-2 w-full rounded-xl border border-[#eadfd5] bg-white px-4 py-3 font-normal"><option value="percentage">Percentage (%)</option><option value="fixed">Fixed amount (৳)</option></select></label>
      <label className="text-sm font-bold">Discount value<input type="number" min="0.01" max={discountType==="percentage"?"100":"10000000"} step="0.01" value={discountValue} onChange={e=>setDiscountValue(e.target.value)} required className="mt-2 w-full rounded-xl border border-[#eadfd5] px-4 py-3 font-normal"/></label>
      <label className="text-sm font-bold">Minimum order (৳)<input type="number" min="0" step="0.01" value={minOrderAmount} onChange={e=>setMinOrderAmount(e.target.value)} className="mt-2 w-full rounded-xl border border-[#eadfd5] px-4 py-3 font-normal"/></label>
      <label className="text-sm font-bold">Maximum discount (৳)<input type="number" min="0.01" step="0.01" value={maxDiscount} onChange={e=>setMaxDiscount(e.target.value)} placeholder="Optional" className="mt-2 w-full rounded-xl border border-[#eadfd5] px-4 py-3 font-normal"/></label>
      <label className="text-sm font-bold">Starts at<input type="datetime-local" value={startsAt} onChange={e=>setStartsAt(e.target.value)} required className="mt-2 w-full rounded-xl border border-[#eadfd5] px-4 py-3 font-normal"/></label>
      <label className="text-sm font-bold">Expires at<input type="datetime-local" value={expiresAt} onChange={e=>setExpiresAt(e.target.value)} className="mt-2 w-full rounded-xl border border-[#eadfd5] px-4 py-3 font-normal"/></label>
      <label className="text-sm font-bold">Total usage limit<input type="number" min="1" step="1" value={usageLimit} onChange={e=>setUsageLimit(e.target.value)} placeholder="Unlimited" className="mt-2 w-full rounded-xl border border-[#eadfd5] px-4 py-3 font-normal"/></label>
      <label className="text-sm font-bold md:col-span-2">Description<input value={description} onChange={e=>setDescription(e.target.value)} maxLength={200} placeholder="A little welcome gift for new customers" className="mt-2 w-full rounded-xl border border-[#eadfd5] px-4 py-3 font-normal"/></label>
      <div className="md:col-span-2 flex flex-wrap items-center gap-3"><button disabled={busy} className="btn">{busy?"Please wait…":"Create coupon"}</button>{message&&<p role="status" className="text-sm text-[#777487]">{message}</p>}</div>
    </form>
    <section><div className="mb-4"><h2 className="text-2xl font-black">Existing coupons</h2><p className="mt-1 text-sm text-[#777487]">Deactivate codes at any time. Usage counters update atomically at checkout.</p></div>
      <div className="space-y-3">{coupons.length ? coupons.map(coupon=><article key={coupon._id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#f0e9e1] bg-white p-5"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-lg">{coupon.code}</strong><span className={coupon.active?"rounded-full bg-[#edf5eb] px-3 py-1 text-xs font-bold text-[#47724d]":"rounded-full bg-[#f4eeee] px-3 py-1 text-xs font-bold text-[#8d6262]"}>{coupon.active?"Active":"Inactive"}</span></div><p className="mt-1 text-sm text-[#777487]">{coupon.discountType==="percentage"?coupon.discountValue+"% off":"৳"+coupon.discountValue.toLocaleString("en-BD")+" off"} · Minimum ৳{coupon.minOrderAmount.toLocaleString("en-BD")}{coupon.maxDiscount? " · Max ৳"+coupon.maxDiscount.toLocaleString("en-BD"):""}</p><p className="mt-1 text-xs text-[#96919a]">Used {coupon.usageCount}{coupon.usageLimit? " / "+coupon.usageLimit:""} · Starts {new Date(coupon.startsAt).toLocaleString("en-BD")}{coupon.expiresAt?" · Expires "+new Date(coupon.expiresAt).toLocaleString("en-BD"):""}</p></div><button type="button" disabled={busy} onClick={()=>void toggle(coupon)} className="rounded-full border border-[#eadfd5] px-4 py-2 text-xs font-bold text-[#a45b2d]">{coupon.active?"Deactivate":"Activate"}</button></article>) : <div className="rounded-2xl border border-dashed border-[#e8ddd2] p-8 text-center text-sm text-[#777487]">No coupons created yet.</div>}</div>
    </section>
  </div>;
}
