import "server-only";

import { NextResponse } from "next/server";
import { connectDatabase } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";

/**
 * Enforces an authenticated-user limit shared across all serverless instances.
 * Returns a ready-to-send 429 response, or null when the request is allowed.
 */
export async function enforceUserRateLimit(
  scope: string,
  userId: string,
  maxAttempts: number,
  windowMs: number
): Promise<NextResponse | null> {
  if (!scope.trim() || !userId.trim()) throw new Error("A rate-limit scope and user ID are required");
  await connectDatabase();
  const result = await consumeRateLimit(`api:${scope}:${userId}`, maxAttempts, windowMs);
  if (result.allowed) return null;

  return NextResponse.json(
    { error: "Too many requests. Please wait before trying again.", code: "RATE_LIMITED" },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } }
  );
}
