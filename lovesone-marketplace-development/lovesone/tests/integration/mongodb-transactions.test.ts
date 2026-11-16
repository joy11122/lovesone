import mongoose from "mongoose";
import type { Collection } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Product } from "../../src/models/Product";
import { reserveProductStock, restoreProductStock } from "../../src/lib/inventory";

vi.mock("server-only", () => ({}));
import { randomUUID } from "node:crypto";

type TransactionTestDocument = { _id: string; state?: string };

const mongoUri = process.env.MONGODB_URI;
const runIntegrationTests = Boolean(mongoUri);
const collectionName = `transaction_verification_${randomUUID().replace(/-/g, "")}`;
let collection: Collection<TransactionTestDocument> | undefined;
const testProductIds: mongoose.Types.ObjectId[] = [];

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
    if (testProductIds.length) await Product.deleteMany({ _id: { $in: testProductIds } }).catch(() => undefined);
    if (collection) await collection.drop().catch(() => undefined);
    await mongoose.disconnect();
  });

  it("never reserves more inventory than exists under concurrent checkout attempts", async () => {
    const vendorId = new mongoose.Types.ObjectId();
    const product = await Product.create({
      vendorId,
      title: "Concurrency test product",
      slug: `concurrency-${randomUUID()}`,
      price: 100,
      stock: 4,
      status: "active"
    });

    testProductIds.push(product._id);

    const attempts = await Promise.allSettled(
      Array.from({ length: 12 }, async () => {
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            const reserved = await reserveProductStock(String(product._id), String(vendorId), 1, session);
            if (!reserved) throw new Error("INSUFFICIENT_STOCK");
          });
        } finally {
          await session.endSession();
        }
      })
    );

    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(4);
    expect(await Product.findById(product._id).select("stock").lean()).toMatchObject({ stock: 0 });
  });

  it("rolls back reserved inventory when the enclosing order transaction aborts", async () => {
    const vendorId = new mongoose.Types.ObjectId();
    const product = await Product.create({
      vendorId,
      title: "Rollback test product",
      slug: `rollback-${randomUUID()}`,
      price: 50,
      stock: 3,
      status: "active"
    });
    testProductIds.push(product._id);
    const session = await mongoose.startSession();

    try {
      await expect(session.withTransaction(async () => {
        const reserved = await reserveProductStock(String(product._id), String(vendorId), 2, session);
        if (!reserved) throw new Error("INSUFFICIENT_STOCK");
        throw new Error("INTENTIONAL_ORDER_ABORT");
      })).rejects.toThrow("INTENTIONAL_ORDER_ABORT");
    } finally {
      await session.endSession();
    }

    expect(await Product.findById(product._id).select("stock").lean()).toMatchObject({ stock: 3 });
  });

  it("restores cancelled inventory even after a listing is archived", async () => {
    const vendorId = new mongoose.Types.ObjectId();
    const product = await Product.create({
      vendorId,
      title: "Archived listing test product",
      slug: `archived-${randomUUID()}`,
      price: 75,
      stock: 0,
      status: "archived"
    });
    testProductIds.push(product._id);
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const restored = await restoreProductStock(String(product._id), String(vendorId), 2, session);
        expect(restored).toBe(true);
      });
    } finally {
      await session.endSession();
    }

    expect(await Product.findById(product._id).select("stock").lean()).toMatchObject({ stock: 2 });
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
