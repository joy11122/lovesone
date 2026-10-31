import mongoose, { Schema } from "mongoose";

const OrderSchema = new Schema({
  orderNumber: { type: String, required: true, unique: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  subOrders: { type: [Schema.Types.Mixed], default: [] },
  total: { type: Number, required: true, min: 0 },
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

export const Order = (mongoose.models.Order as mongoose.Model<any>) || mongoose.model("Order", OrderSchema);
