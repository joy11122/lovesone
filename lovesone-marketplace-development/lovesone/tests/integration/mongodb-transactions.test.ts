import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import type { Collection } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Product } from "../../src/models/Product";
import { Order } from "../../src/models/Order";
import { canCustomerCancelOrder } from "../../src/lib/order-workflow";
import { reserveProductStock, restoreProductStock } from "../../src/lib/inventory";

vi.mock("server-only", () => ({}));

type TransactionTestDocument = { _id: string; state?: string };

const mongoUri = process.env.MONGODB_URI;
const runIntegrationTests = Boolean(mongoUri);
const collectionName = `transaction_verification_${randomUUID().replace(/-/g, "")}`;
let collection: Collection<TransactionTestDocument> | undefined;
const testProductIds: mongoose.Types.ObjectId[] = [];
const testOrderIds: mongoose.Types.ObjectId[] = [];

describe.skipIf(!runIntegrationTests)("MongoDB replica-set transactions", () => {
  beforeAll(async () => {
    await mongoose.connect(mongoUri!);
    const database = mongoose.connection.db;
    if (!database) throw new Error("MongoDB connection is not ready");

    const hello = await database.admin().command({ hello: 1 });
    expect(hello.setName).toBe("rs0");
    expect(hello.isWritablePrimary).toBe(true);

    await Order.init();
    collection = database.collection<TransactionTestDocument>(collectionName);
  });

  afterAll(async () => {
    if (testProductIds.length) await Product.deleteMany({ _id: { $in: testProductIds } }).catch(() => undefined);
    if (testOrderIds.length) await Order.deleteMany({ _id: { $in: testOrderIds } }).catch(() => undefined);
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

  it("does not reserve inventory through a different vendor identity", async () => {
    const vendorId = new mongoose.Types.ObjectId();
    const otherVendorId = new mongoose.Types.ObjectId();
    const product = await Product.create({
      vendorId,
      title: "Vendor isolation test product",
      slug: `vendor-isolation-${randomUUID()}`,
      price: 40,
      stock: 3,
      status: "active"
    });
    testProductIds.push(product._id);
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const reserved = await reserveProductStock(String(product._id), String(otherVendorId), 1, session);
        expect(reserved).toBe(false);
      });
    } finally {
      await session.endSession();
    }

    expect(await Product.findById(product._id).select("stock").lean()).toMatchObject({ stock: 3 });
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

  it("enforces one checkout record per customer idempotency key under concurrent requests", async () => {
    const customerId = new mongoose.Types.ObjectId();
    const idempotencyKey = randomUUID();
    const createOrder = () => Order.create({
      orderNumber: `LVS-${randomUUID().slice(0, 8).toUpperCase()}`,
      customerId,
      idempotencyKey,
      idempotencyFingerprint: "same-request-fingerprint",
      subOrders: [],
      total: 0,
      shipping: { name: "Test Customer", phone: "01712345678", address: "123 Test Street", city: "Khulna" },
      paymentMethod: "cod",
      paymentStatus: "pending",
      status: "pending"
    });

    const attempts = await Promise.allSettled([createOrder(), createOrder()]);
    const successful = attempts.filter((result) => result.status === "fulfilled");
    expect(successful).toHaveLength(1);
    const order = successful[0];
    if (order.status === "fulfilled") testOrderIds.push(order.value._id);

    const duplicate = attempts.find((result) => result.status === "rejected");
    expect(duplicate).toBeDefined();
    if (duplicate?.status === "rejected") {
      expect((duplicate.reason as { code?: number }).code).toBe(11000);
    }
    expect(await Order.countDocuments({ customerId, idempotencyKey })).toBe(1);
  });

  it("restores stock only once when customer cancellation requests race", async () => {
    const customerId = new mongoose.Types.ObjectId();
    const vendorId = new mongoose.Types.ObjectId();
    const product = await Product.create({
      vendorId,
      title: "Cancellation race test product",
      slug: `cancel-race-${randomUUID()}`,
      price: 25,
      stock: 0,
      status: "active"
    });
    testProductIds.push(product._id);

    const order = await Order.create({
      orderNumber: `LVS-${randomUUID().slice(0, 8).toUpperCase()}`,
      customerId,
      subOrders: [{
        vendorId: String(vendorId),
        status: "pending",
        items: [{ productId: String(product._id), quantity: 2, unitPrice: 25, lineTotal: 50 }]
      }],
      total: 50,
      originalTotal: 50,
      cancelledTotal: 0,
      shipping: { name: "Test Customer", phone: "01712345678", address: "123 Test Street", city: "Khulna" },
      paymentMethod: "cod",
      paymentStatus: "pending",
      status: "pending"
    });
    testOrderIds.push(order._id);

    const cancelOnce = async () => {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const current = await Order.findById(order._id).session(session);
          if (!current) throw new Error("ORDER_NOT_FOUND");
          const subOrders = current.subOrders as Array<{ vendorId: string; status: string; items: Array<{ productId: string; quantity: number }> }>;
          if (!canCustomerCancelOrder(subOrders.map((subOrder) => subOrder.status), current.paymentStatus)) {
            throw new Error("CANCELLATION_NOT_ALLOWED");
          }
          for (const subOrder of subOrders) {
            if (subOrder.status === "cancelled") continue;
            for (const item of subOrder.items) {
              const restored = await restoreProductStock(item.productId, subOrder.vendorId, item.quantity, session);
              if (!restored) throw new Error("RESTOCK_FAILED");
            }
            subOrder.status = "cancelled";
          }
          current.subOrders = subOrders;
          current.markModified("subOrders");
          current.status = "cancelled";
          current.total = 0;
          current.cancelledTotal = current.originalTotal ?? 50;
          await current.save({ session });
        });
        return "cancelled";
      } finally {
        await session.endSession();
      }
    };

    const attempts = await Promise.allSettled([cancelOnce(), cancelOnce()]);
    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await Product.findById(product._id).select("stock").lean()).toMatchObject({ stock: 2 });
    const savedOrder = await Order.findById(order._id).lean();
    expect(savedOrder?.status).toBe("cancelled");
    expect((savedOrder?.subOrders as Array<{ status: string }>)[0].status).toBe("cancelled");
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
