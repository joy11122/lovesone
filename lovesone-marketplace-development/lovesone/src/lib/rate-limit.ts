import "server-only";

import { createHmac } from "node:crypto";
import mongoose from "mongoose";

type RateLimitRecord = {
  _id: string;
  windowStartedAt: Date;
  count: number;
  expiresAt: Date;
};

let ttlIndexPromise: Promise<string> | undefined;

/**
 * Atomically consumes one request from a MongoDB-backed fixed window.
 * The shared collection makes limits consistent across serverless instances.
 */
export async function consumeRateLimit(
  identifier: string,
  maxAttempts: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  if (!identifier.trim() || !Number.isInteger(maxAttempts) || maxAttempts < 1 ||
      !Number.isInteger(windowMs) || windowMs < 1) {
    throw new Error("Invalid rate-limit configuration");
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required for rate limiting");
  const database = mongoose.connection.db;
  if (!database) throw new Error("Database connection is not ready");

  const collection = database.collection<RateLimitRecord>("api_rate_limits");
  ttlIndexPromise ??= collection.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: "api_rate_limits_ttl" }
  );
  try {
    await ttlIndexPromise;
  } catch (error) {
    ttlIndexPromise = undefined;
    throw error;
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - windowMs);
  const nextExpiry = new Date(now.getTime() + windowMs);
  const digest = createHmac("sha256", secret).update(identifier).digest("hex");

  const record = await collection.findOneAndUpdate(
    { _id: digest },
    [
      {
        $set: {
          count: {
            $cond: [
              { $gt: ["$windowStartedAt", cutoff] },
              { $add: [{ $ifNull: ["$count", 0] }, 1] },
              1
            ]
          },
          windowStartedAt: {
            $cond: [{ $gt: ["$windowStartedAt", cutoff] }, "$windowStartedAt", now]
          },
          expiresAt: {
            $cond: [{ $gt: ["$windowStartedAt", cutoff] }, "$expiresAt", nextExpiry]
          }
        }
      }
    ],
    { upsert: true, returnDocument: "after" }
  );

  if (!record) throw new Error("Unable to apply rate limit");
  return {
    allowed: record.count <= maxAttempts,
    retryAfterSeconds: Math.max(1, Math.ceil((record.expiresAt.getTime() - now.getTime()) / 1000))
  };
}
