import { createHmac, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDatabase } from "../../src/lib/db";
import { consumeRateLimit } from "../../src/lib/rate-limit";

const integrationDescribe = process.env.MONGODB_URI && process.env.AUTH_SECRET ? describe : describe.skip;
const identifiers: string[] = [];

integrationDescribe("MongoDB shared rate limiter", () => {
  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    const database = mongoose.connection.db;
    const secret = process.env.AUTH_SECRET;
    if (!database || !secret || identifiers.length === 0) return;
    const digests = identifiers.map((identifier) =>
      createHmac("sha256", secret).update(identifier).digest("hex")
    );
    await database.collection("api_rate_limits").deleteMany({ _id: { $in: digests } });
  });

  it("enforces an exact limit under concurrent first-request upserts", async () => {
    const identifier = `test:concurrent:${randomUUID()}`;
    identifiers.push(identifier);

    const results = await Promise.all(
      Array.from({ length: 32 }, () => consumeRateLimit(identifier, 5, 60_000))
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(5);
    expect(results.filter((result) => !result.allowed)).toHaveLength(27);
  });

  it("keeps independent identifiers in separate buckets", async () => {
    const first = `test:first:${randomUUID()}`;
    const second = `test:second:${randomUUID()}`;
    identifiers.push(first, second);

    const [firstResult, secondResult] = await Promise.all([
      consumeRateLimit(first, 1, 60_000),
      consumeRateLimit(second, 1, 60_000)
    ]);

    expect(firstResult.allowed).toBe(true);
    expect(secondResult.allowed).toBe(true);
  });
});
