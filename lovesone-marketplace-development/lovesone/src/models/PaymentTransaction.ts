import mongoose, { Schema } from "mongoose";

const PaymentTransactionSchema = new Schema({
  orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  provider: { type: String, enum: ["sslcommerz"], required: true },
  transactionId: { type: String, required: true, unique: true, index: true },
  validationId: { type: String, default: null },
  amount: { type: Number, required: true, min: 0 },
  refundedAmount: { type: Number, min: 0, default: 0 },
  currency: { type: String, default: "BDT", uppercase: true },
  status: { type: String, enum: ["pending", "initiated", "paid", "failed", "cancelled", "review", "partially_refunded", "refunded"], default: "pending", index: true },
  gatewayUrl: { type: String, default: null },
  bankTransactionId: { type: String, default: null },
  verifiedAt: { type: Date, default: null },
  reviewedAt: { type: Date, default: null },
  reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null }
}, { timestamps: true });

PaymentTransactionSchema.index({ orderId: 1, createdAt: -1 });

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mongoose models use the repository's established dynamic model typing.
export const PaymentTransaction = (mongoose.models.PaymentTransaction as mongoose.Model<any>) ||
  mongoose.model("PaymentTransaction", PaymentTransactionSchema);
