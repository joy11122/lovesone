import mongoose, { Schema } from "mongoose";

const VendorProfileSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  storeName: { type: String, required: true, trim: true },
  phone: { type: String, default: "" },
  businessAddress: { type: String, default: "" },
  verificationStatus: { type: String, enum: ["pending", "under-review", "verified", "rejected"], default: "pending", index: true }
}, { timestamps: true });

export const VendorProfile = (mongoose.models.VendorProfile as mongoose.Model<any>) || mongoose.model("VendorProfile", VendorProfileSchema);
