import Link from "next/link";
import { requireRole } from "@/lib/authz";
import { connectDatabase } from "@/lib/db";
import { Coupon } from "@/models/Coupon";
import { CouponManager, type AdminCoupon } from "@/components/dashboard/coupon-manager";

export const metadata = { title: "Coupons & promotions" };

export default async function AdminCouponsPage() {
  await requireRole(["admin", "super-admin"], "/admin/coupons");
  await connectDatabase();
  const records = await Coupon.find().sort({ createdAt: -1 }).limit(100).lean();
  const coupons = records.map(coupon => ({
    _id: String(coupon._id), code: coupon.code, description: coupon.description,
    discountType: coupon.discountType, discountValue: coupon.discountValue,
    minOrderAmount: coupon.minOrderAmount, maxDiscount: coupon.maxDiscount,
    startsAt: new Date(coupon.startsAt).toISOString(),
    expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString() : null,
    usageLimit: coupon.usageLimit, usageCount: coupon.usageCount, active: coupon.active
  })) as AdminCoupon[];
  return <main className="container py-10"><Link href="/admin" className="text-sm font-bold text-[#a45b2d]">← Back to admin</Link><span className="eyebrow mt-6 block">Growth tools</span><h1 className="mt-3 text-4xl font-black">Coupons & promotions</h1><p className="mt-2 mb-8 text-sm text-[#777487]">Create and manage discount codes for LOVESONE customers.</p><CouponManager coupons={coupons}/></main>;
}
