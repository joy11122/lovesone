import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, select: false },
  role: { type: String, enum: ["customer", "vendor", "admin", "super-admin"], default: "customer", index: true },
  status: { type: String, enum: ["active", "suspended", "pending"], default: "active", index: true }
}, { timestamps: true, strict: true });

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Existing Mongoose model schemas are intentionally dynamic.
export const User = (mongoose.models.User as mongoose.Model<any>) || mongoose.model("User", UserSchema);
