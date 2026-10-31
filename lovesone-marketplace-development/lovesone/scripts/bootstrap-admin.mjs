import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
if (!uri || !email) {
  console.error("Set MONGODB_URI and BOOTSTRAP_ADMIN_EMAIL before running this one-time administrative script.");
  process.exit(1);
}
await mongoose.connect(uri);
try {
  const User = mongoose.models.User || mongoose.model("User", new mongoose.Schema({ email: String, role: String, status: String }, { strict: false }));
  const existingRoot = await User.findOne({ role: "super-admin" }).lean();
  if (existingRoot) throw new Error("A super-admin already exists. Refusing to replace the root administrator.");
  const user = await User.findOne({ email }).select("email role status");
  if (!user) throw new Error("No account found for BOOTSTRAP_ADMIN_EMAIL. Register the account first.");
  if (user.status !== "active") throw new Error("The target account is not active.");
  user.role = "super-admin";
  await user.save();
  console.log(`Promoted ${email} to super-admin. Remove BOOTSTRAP_ADMIN_EMAIL from the environment now.`);
} finally {
  await mongoose.disconnect();
}
