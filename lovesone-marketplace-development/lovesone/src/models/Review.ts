import mongoose, { Schema } from "mongoose";

const ReviewSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  title: { type: String, trim: true, maxlength: 100, default: "" },
  body: { type: String, trim: true, minlength: 10, maxlength: 2000, required: true },
  status: { type: String, enum: ["published", "hidden"], default: "published", index: true }
}, { timestamps: true });

ReviewSchema.index({ productId: 1, customerId: 1 }, { unique: true });

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mongoose model cache uses a dynamic model type.
export const Review = (mongoose.models.Review as mongoose.Model<any>) || mongoose.model("Review", ReviewSchema);
