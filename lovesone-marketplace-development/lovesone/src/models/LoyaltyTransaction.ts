import mongoose, { Schema } from "mongoose";

const LoyaltyTransactionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
  points: { type: Number, required: true, min: 1 },
  type: { type: String, enum: ["earned", "redeemed", "adjusted"], required: true },
  description: { type: String, trim: true, maxlength: 180, required: true }
}, { timestamps: true });

LoyaltyTransactionSchema.index({ orderId: 1, type: 1 }, { unique: true });
LoyaltyTransactionSchema.index({ userId: 1, createdAt: -1 });

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mongoose model cache uses a dynamic model type.
export const LoyaltyTransaction = (mongoose.models.LoyaltyTransaction as mongoose.Model<any>) || mongoose.model("LoyaltyTransaction", LoyaltyTransactionSchema);
