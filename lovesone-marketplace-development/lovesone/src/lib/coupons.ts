import "server-only";
import type mongoose from "mongoose";
import { Coupon } from "@/models/Coupon";
import { CouponRedemption } from "@/models/CouponRedemption";
export { calculateCouponDiscount } from "@/lib/coupon-math";

export async function findUsableCoupon(code: string, userId: string, subtotal: number, session?: mongoose.ClientSession) {
  const normalizedCode = code.trim().toUpperCase();
  const query = Coupon.findOne({ code: normalizedCode, active: true });
  if (session) query.session(session);
  const coupon = await query;
  if (!coupon) throw new Error("COUPON_INVALID");
  const now = new Date();
  if (coupon.startsAt > now || (coupon.expiresAt && coupon.expiresAt <= now)) throw new Error("COUPON_EXPIRED");
  if (subtotal < coupon.minOrderAmount) throw new Error("COUPON_MINIMUM");
  if (coupon.usageLimit !== null && coupon.usageLimit !== undefined && coupon.usageCount >= coupon.usageLimit) throw new Error("COUPON_LIMIT");
  const redemptionQuery = CouponRedemption.exists({ couponId: coupon._id, userId });
  if (session) redemptionQuery.session(session);
  if (await redemptionQuery) throw new Error("COUPON_ALREADY_USED");
  return coupon;
}


export async function releaseCouponRedemption(code: string | null | undefined, userId: string, orderId: string, session: mongoose.ClientSession) {
  if (!code) return;
  const coupon = await Coupon.findOne({ code }).select("_id").session(session);
  if (!coupon) return;
  const redemption = await CouponRedemption.findOneAndDelete({ couponId: coupon._id, userId, orderId }).session(session);
  if (redemption) {
    await Coupon.updateOne({ _id: coupon._id, usageCount: { $gt: 0 } }, { $inc: { usageCount: -1 } }).session(session);
  }
}
