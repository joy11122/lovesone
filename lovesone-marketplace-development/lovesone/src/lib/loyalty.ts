import "server-only";

import type mongoose from "mongoose";
import { LoyaltyTransaction } from "@/models/LoyaltyTransaction";
import { calculateLoyaltyPoints } from "@/lib/loyalty-math";

type LoyaltyOrder = {
  orderId: string;
  userId: string;
  orderNumber: string;
  total: number;
};

/**
 * Awards points only when the caller has confirmed the complete parent order
 * is delivered. The unique order/type index is the final idempotency guard.
 * Call this inside the same MongoDB transaction as the delivery status update.
 */
export async function awardLoyaltyPoints(order: LoyaltyOrder, session: mongoose.ClientSession): Promise<number> {
  const points = calculateLoyaltyPoints(order.total);
  if (points < 1) return 0;

  const existing = await LoyaltyTransaction.findOne({
    orderId: order.orderId,
    type: "earned"
  }).session(session).select("_id").lean();

  if (existing) return 0;

  await LoyaltyTransaction.create([{
    userId: order.userId,
    orderId: order.orderId,
    points,
    type: "earned",
    description: `Reward for delivered order ${order.orderNumber}`
  }], { session });

  return points;
}
