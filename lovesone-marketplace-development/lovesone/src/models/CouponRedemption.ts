import mongoose, { Schema } from "mongoose";

const CouponRedemptionSchema = new Schema({
  couponId: { type: Schema.Types.ObjectId, ref: "Coupon", required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
  discountAmount: { type: Number, required: true, min: 0 },
  redeemedAt: { type: Date, default: Date.now }
}, { timestamps: true });

CouponRedemptionSchema.index({ couponId: 1, userId: 1 }, { unique: true });

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mongoose model cache uses a dynamic model type.
export const CouponRedemption = (mongoose.models.CouponRedemption as mongoose.Model<any>) || mongoose.model("CouponRedemption", CouponRedemptionSchema);
