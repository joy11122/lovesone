import mongoose, { Schema } from "mongoose";

const ProductSchema = new Schema({
  vendorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, index: true },
  sku: { type: String, default: "" },
  description: { type: String, default: "" },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, default: 0, min: 0 },
  categorySlug: { type: String, default: "general" },
  status: { type: String, enum: ["draft", "pending-review", "active", "rejected", "archived"], default: "pending-review", index: true },
  deletedAt: { type: Date, default: null, index: true },
  medicine: {
    isMedicine: { type: Boolean, default: false },
    requiresPrescription: { type: Boolean, default: false },
    approvalReference: { type: String, default: null }
  }
}, { timestamps: true });

export const Product = (mongoose.models.Product as mongoose.Model<any>) || mongoose.model("Product", ProductSchema);
