import "server-only";

import mongoose from "mongoose";
import { Product } from "@/models/Product";

/**
 * Atomically reserves inventory inside the caller's MongoDB transaction.
 * A false result means the product, ownership, availability, or stock changed.
 */
export async function reserveProductStock(
  productId: string,
  vendorId: string,
  quantity: number,
  session: mongoose.ClientSession
): Promise<boolean> {
  if (!mongoose.isValidObjectId(productId) || !mongoose.isValidObjectId(vendorId)) {
    return false;
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new Error("INVALID_STOCK_QUANTITY");
  }

  const result = await Product.updateOne(
    {
      _id: productId,
      vendorId,
      status: "active",
      deletedAt: null,
      stock: { $gte: quantity }
    },
    { $inc: { stock: -quantity } },
    { session }
  );

  return result.modifiedCount === 1;
}

/**
 * Restores inventory atomically inside the caller's MongoDB transaction.
 * Deliberately does not require an active listing: cancelled orders must
 * restore stock even if a vendor archived the listing after purchase.
 */
export async function restoreProductStock(
  productId: string,
  vendorId: string,
  quantity: number,
  session: mongoose.ClientSession
): Promise<boolean> {
  if (!mongoose.isValidObjectId(productId) || !mongoose.isValidObjectId(vendorId)) {
    return false;
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new Error("INVALID_STOCK_QUANTITY");
  }

  const result = await Product.updateOne(
    { _id: productId, vendorId },
    { $inc: { stock: quantity } },
    { session }
  );

  return result.modifiedCount === 1;
}
