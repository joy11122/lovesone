import mongoose, { Schema } from "mongoose";

const VendorSettlementSchema = new Schema({
  orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
  vendorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  currency: { type: String, enum: ["BDT"], default: "BDT", required: true },
  grossAmount: { type: Number, required: true, min: 0 },
  refundShare: { type: Number, required: true, min: 0, default: 0 },
  commissionBps: { type: Number, required: true, min: 0, max: 10000 },
  commissionAmount: { type: Number, required: true, min: 0 },
  netAmount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ["pending", "paid"], default: "pending", index: true },
  payoutReference: { type: String, default: null, trim: true, maxlength: 120 },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  paidBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  paidAt: { type: Date, default: null }
}, { timestamps: true });

VendorSettlementSchema.index({ orderId: 1, vendorId: 1 }, { unique: true });
VendorSettlementSchema.index({ vendorId: 1, status: 1, createdAt: -1 });

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Match the repository's established dynamic Mongoose model typing.
export const VendorSettlement = (mongoose.models.VendorSettlement as mongoose.Model<any>) ||
  mongoose.model("VendorSettlement", VendorSettlementSchema);
