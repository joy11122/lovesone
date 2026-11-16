import mongoose from "mongoose";
import type { Collection } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

type TransactionTestDocument = { _id: string; state?: string };

const mongoUri = process.env.MONGODB_URI;
const runIntegrationTests = Boolean(mongoUri);
const collectionName = `transaction_verification_${randomUUID().replace(/-/g, "")}`;
let collection: Collection<TransactionTestDocument> | undefined;

describe.skipIf(!runIntegrationTests)("MongoDB replica-set transactions", () => {
  beforeAll(async () => {
    await mongoose.connect(mongoUri!);
    const database = mongoose.connection.db;
    if (!database) throw new Error("MongoDB connection is not ready");

    const hello = await database.admin().command({ hello: 1 });
    expect(hello.setName).toBe("rs0");
    expect(hello.isWritablePrimary).toBe(true);

    collection = database.collection<TransactionTestDocument>(collectionName);
  });

  afterAll(async () => {
    if (collection) await collection.drop().catch(() => undefined);
    await mongoose.disconnect();
  });

  it("commits writes made inside a transaction", async () => {
    if (!collection) throw new Error("Test collection is not initialized");
    const session = await mongoose.startSession();
    const id = randomUUID();

    try {
      await session.withTransaction(async () => {
        await collection!.insertOne({ _id: id, state: "committed" }, { session });
      });
    } finally {
      await session.endSession();
    }

    await expect(collection.findOne({ _id: id })).resolves.toMatchObject({
      _id: id,
      state: "committed"
    });
  });

  it("rolls back writes when a transaction fails", async () => {
    if (!collection) throw new Error("Test collection is not initialized");
    const session = await mongoose.startSession();
    const id = randomUUID();

    try {
      await expect(session.withTransaction(async () => {
        await collection!.insertOne({ _id: id, state: "must-roll-back" }, { session });
        throw new Error("INTENTIONAL_TRANSACTION_ABORT");
      })).rejects.toThrow("INTENTIONAL_TRANSACTION_ABORT");
    } finally {
      await session.endSession();
    }

    await expect(collection.findOne({ _id: id })).resolves.toBeNull();
  });
});
