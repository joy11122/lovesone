import mongoose, { Schema } from "mongoose";

const RefundSchema = new Schema({
  orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
  paymentTransactionId: { type: Schema.Types.ObjectId, ref: "PaymentTransaction", default: null, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, enum: ["BDT"], default: "BDT", required: true },
  method: { type: String, enum: ["sslcommerz", "bank_transfer", "mobile_financial_service", "cod_cash"], required: true },
  status: { type: String, enum: ["requested", "approved", "rejected", "processing", "paid"], default: "requested", index: true },
  reason: { type: String, required: true, trim: true, maxlength: 500 },
  adminNote: { type: String, default: "", maxlength: 500 },
  payoutReference: { type: String, default: null, trim: true, maxlength: 120 },
  idempotencyKey: { type: String, required: true },
  reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  reviewedAt: { type: Date, default: null },
  paidAt: { type: Date, default: null }
}, { timestamps: true });

RefundSchema.index({ customerId: 1, idempotencyKey: 1 }, { unique: true });
RefundSchema.index({ orderId: 1, status: 1, createdAt: -1 });

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mongoose models use the repository's established dynamic model typing.
export const Refund = (mongoose.models.Refund as mongoose.Model<any>) || mongoose.model("Refund", RefundSchema);
