import mongoose, { Schema } from "mongoose";

const CouponSchema = new Schema({
  code: { type: String, required: true, trim: true, uppercase: true, unique: true, maxlength: 40 },
  description: { type: String, trim: true, maxlength: 200, default: "" },
  discountType: { type: String, enum: ["percentage", "fixed"], required: true },
  discountValue: { type: Number, required: true, min: 0.01 },
  minOrderAmount: { type: Number, default: 0, min: 0 },
  maxDiscount: { type: Number, min: 0 },
  startsAt: { type: Date, required: true },
  expiresAt: { type: Date, default: null },
  usageLimit: { type: Number, default: null, min: 1 },
  usageCount: { type: Number, default: 0, min: 0 },
  active: { type: Boolean, default: true, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mongoose model cache uses a dynamic model type.
export const Coupon = (mongoose.models.Coupon as mongoose.Model<any>) || mongoose.model("Coupon", CouponSchema);
