import mongoose, { Schema } from "mongoose";

const OrderSchema = new Schema({
  orderNumber: { type: String, required: true, unique: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  idempotencyKey: { type: String, default: undefined },
  idempotencyFingerprint: { type: String, default: undefined },
  subOrders: { type: [Schema.Types.Mixed], default: [] },
  total: { type: Number, required: true, min: 0 },
  shipping: { name: { type: String, required: true }, phone: { type: String, required: true }, address: { type: String, required: true }, city: { type: String, required: true } },
  status: { type: String, default: "pending", index: true },
  paymentMethod: { type: String, default: "cod" },
  paymentStatus: { type: String, default: "pending", index: true },
  returnRequest: {
    status: { type: String, default: null },
    reason: { type: String, default: "" },
    adminNote: { type: String, default: "" },
    requestedAt: { type: Date },
    reviewedAt: { type: Date }
  }
}, { timestamps: true });

// Existing orders without a key are excluded so this index can be added safely.
OrderSchema.index(
  { customerId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Existing Mongoose model schemas are intentionally dynamic.
export const Order = (mongoose.models.Order as mongoose.Model<any>) || mongoose.model("Order", OrderSchema);
