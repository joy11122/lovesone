import mongoose, { Schema } from "mongoose";

const WishlistSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  productIds: [{ type: Schema.Types.ObjectId, ref: "Product" }]
}, { timestamps: true });


// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mongoose model cache uses a dynamic model type.
export const Wishlist = (mongoose.models.Wishlist as mongoose.Model<any>) || mongoose.model("Wishlist", WishlistSchema);
