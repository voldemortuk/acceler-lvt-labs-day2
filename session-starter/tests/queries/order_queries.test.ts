import { describe, expect, it } from "vitest";

import {
  fetchCustomerOrders,
  fetchOrdersByDateRange,
  findOrdersByStatus,
  getHighValueOrders,
  getOrderDetails,
  getPendingOrders,
  getRecentOrders,
} from "../../src/queries/order_queries";
import { openTestDb } from "../helpers/db";
import {
  seedAddress,
  seedCategory,
  seedCustomer,
  seedCustomerSegment,
  seedInventory,
  seedOrder,
  seedOrderItem,
  seedProduct,
  seedWarehouse,
} from "../helpers/seed";
import { daysBefore, toSqliteTimestamp } from "../helpers/time";

describe("getOrderDetails", () => {
  it("returns the order, its shipping address, and all line items", async () => {
    const db = await openTestDb();
    const reference = new Date("2026-07-19T00:00:00.000Z");

    const customerId = await seedCustomer(db, {
      email: "buyer@example.com",
      firstName: "Buyer",
      lastName: "One",
    });

    const shippingAddressId = await seedAddress(db, {
      customerId,
      type: "shipping",
      street1: "1 Shipping Way",
      city: "Shipville",
      state: "CA",
      postalCode: "90001",
      isDefault: true,
    });

    const orderId = await seedOrder(db, {
      customerId,
      status: "processing",
      createdAt: toSqliteTimestamp(reference),
    });
    // seedOrder doesn't set shipping_address_id, so patch it directly —
    // that FK isn't part of the seed helper's input surface.
    await db.run("UPDATE orders SET shipping_address_id = ? WHERE id = ?", [
      shippingAddressId,
      orderId,
    ]);

    const productA = await seedProduct(db, { sku: "SKU-A", name: "Widget" });
    const productB = await seedProduct(db, { sku: "SKU-B", name: "Gadget" });
    await seedOrderItem(db, { orderId, productId: productA, quantity: 2 });
    await seedOrderItem(db, { orderId, productId: productB, quantity: 1 });

    const details = await getOrderDetails(db, orderId);

    expect(details).not.toBeNull();
    expect(details!.id).toBe(orderId);
    expect(details!.customer_email).toBe("buyer@example.com");
    expect(details!.shipping_city).toBe("Shipville");
    expect(details!.shipping_postal_code).toBe("90001");
    expect(details!.items).toHaveLength(2);
    expect(details!.items.map((i) => i.product_name).sort()).toEqual([
      "Gadget",
      "Widget",
    ]);

    await db.close();
  });

  it("returns null for a nonexistent order", async () => {
    const db = await openTestDb();
    const details = await getOrderDetails(db, 999);
    expect(details).toBeNull();
    await db.close();
  });
});

describe("fetchCustomerOrders", () => {
  it("returns the customer's orders, most recent first, truncated to limit", async () => {
    const db = await openTestDb();
    const reference = new Date("2026-07-19T00:00:00.000Z");

    const customerId = await seedCustomer(db, {
      email: "frequent@example.com",
      firstName: "Frequent",
      lastName: "Buyer",
    });

    const product = await seedProduct(db, { sku: "SKU-X", name: "Thing" });

    const orderOldest = await seedOrder(db, {
      customerId,
      status: "delivered",
      createdAt: toSqliteTimestamp(daysBefore(reference, 3)),
    });
    await seedOrderItem(db, { orderId: orderOldest, productId: product });

    const orderMiddle = await seedOrder(db, {
      customerId,
      status: "delivered",
      createdAt: toSqliteTimestamp(daysBefore(reference, 2)),
    });
    await seedOrderItem(db, { orderId: orderMiddle, productId: product });

    const orderNewest = await seedOrder(db, {
      customerId,
      status: "pending",
      createdAt: toSqliteTimestamp(daysBefore(reference, 1)),
    });
    await seedOrderItem(db, { orderId: orderNewest, productId: product });
    await seedOrderItem(db, {
      orderId: orderNewest,
      productId: product,
      unitPrice: 20,
    });

    const results = await fetchCustomerOrders(db, customerId, 2);

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe(orderNewest);
    expect(results[0].item_count).toBe(2);
    expect(results[1].id).toBe(orderMiddle);

    await db.close();
  });
});

describe("getPendingOrders", () => {
  it("returns only pending orders, with customer name/phone and a plausible age", async () => {
    const db = await openTestDb();
    // getPendingOrders compares against the real wall clock (julianday('now'))
    // internally — reconciling column names here, not that design, so this
    // test necessarily anchors to real "now" too.
    const now = new Date();

    const customerId = await seedCustomer(db, {
      email: "pending-buyer@example.com",
      firstName: "Pending",
      lastName: "Buyer",
      phone: "555-0000",
    });

    const pendingOrderId = await seedOrder(db, {
      customerId,
      status: "pending",
      createdAt: toSqliteTimestamp(daysBefore(now, 5)),
    });

    await seedOrder(db, {
      customerId,
      status: "processing",
      createdAt: toSqliteTimestamp(daysBefore(now, 5)),
    });

    const results = await getPendingOrders(db);

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(pendingOrderId);
    expect(results[0].customer_name).toBe("Pending Buyer");
    expect(results[0].phone).toBe("555-0000");
    expect(results[0].days_since_created).toBeGreaterThanOrEqual(4.9);
    expect(results[0].days_since_created).toBeLessThan(5.1);

    await db.close();
  });
});

describe("findOrdersByStatus", () => {
  it("returns orders for the given status with fanned-out SKUs and warehouses", async () => {
    const db = await openTestDb();
    const reference = new Date("2026-07-19T00:00:00.000Z");

    const customerId = await seedCustomer(db, {
      email: "status-buyer@example.com",
      firstName: "Status",
      lastName: "Buyer",
    });

    const product = await seedProduct(db, { sku: "SKU-STATUS", name: "Thing" });
    const warehouse = await seedWarehouse(db, {
      code: "WH-1",
      name: "Main Warehouse",
    });
    await seedInventory(db, { productId: product, warehouseId: warehouse });

    const shippedOrderId = await seedOrder(db, {
      customerId,
      status: "shipped",
      createdAt: toSqliteTimestamp(reference),
    });
    await seedOrderItem(db, { orderId: shippedOrderId, productId: product });

    const pendingOrderId = await seedOrder(db, {
      customerId,
      status: "pending",
      createdAt: toSqliteTimestamp(reference),
    });
    await seedOrderItem(db, { orderId: pendingOrderId, productId: product });

    const results = await findOrdersByStatus(db, "shipped");

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(shippedOrderId);
    expect(results[0].product_skus).toBe("SKU-STATUS");
    expect(results[0].warehouses).toBe("Main Warehouse");

    await db.close();
  });
});

describe("getRecentOrders", () => {
  it("only returns orders within the window, with active segment names comma-joined", async () => {
    const db = await openTestDb();
    // getRecentOrders compares against the real wall clock (date('now', ...))
    // internally — reconciling column/table names here, not that design, so
    // this test necessarily anchors to real "now" too.
    const now = new Date();

    const customerId = await seedCustomer(db, {
      email: "recent-buyer@example.com",
      firstName: "Recent",
      lastName: "Buyer",
    });
    await seedCustomerSegment(db, {
      customerId,
      segmentName: "vip",
      expiresAt: null,
    });
    await seedCustomerSegment(db, {
      customerId,
      segmentName: "newsletter",
      expiresAt: null,
    });

    const category = await seedCategory(db, { name: "Gadgets" });
    const product = await seedProduct(db, {
      sku: "SKU-RECENT",
      name: "Thing",
      categoryId: category,
    });

    const inWindowOrderId = await seedOrder(db, {
      customerId,
      status: "delivered",
      createdAt: toSqliteTimestamp(daysBefore(now, 1)),
    });
    await seedOrderItem(db, { orderId: inWindowOrderId, productId: product });

    const outOfWindowOrderId = await seedOrder(db, {
      customerId,
      status: "delivered",
      createdAt: toSqliteTimestamp(daysBefore(now, 30)),
    });
    await seedOrderItem(db, {
      orderId: outOfWindowOrderId,
      productId: product,
    });

    const results = await getRecentOrders(db, 7);

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(inWindowOrderId);
    expect(results[0].customer_segments.split(",").sort()).toEqual([
      "newsletter",
      "vip",
    ]);
    expect(results[0].product_categories).toBe("Gadgets");

    await db.close();
  });
});

describe("fetchOrdersByDateRange", () => {
  it("filters by created_at range and resolves the billing address state", async () => {
    const db = await openTestDb();
    const reference = new Date("2026-07-19T00:00:00.000Z");

    const customerId = await seedCustomer(db, {
      email: "range-buyer@example.com",
      firstName: "Range",
      lastName: "Buyer",
    });

    const billingAddressId = await seedAddress(db, {
      customerId,
      type: "billing",
      street1: "2 Billing Blvd",
      city: "Billtown",
      state: "NY",
      postalCode: "10001",
    });

    const inRangeOrderId = await seedOrder(db, {
      customerId,
      status: "delivered",
      createdAt: toSqliteTimestamp(daysBefore(reference, 5)),
    });
    await db.run("UPDATE orders SET billing_address_id = ? WHERE id = ?", [
      billingAddressId,
      inRangeOrderId,
    ]);

    const outOfRangeOrderId = await seedOrder(db, {
      customerId,
      status: "delivered",
      createdAt: toSqliteTimestamp(daysBefore(reference, 20)),
    });

    const results = await fetchOrdersByDateRange(
      db,
      toSqliteTimestamp(daysBefore(reference, 10)),
      toSqliteTimestamp(reference)
    );

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(inRangeOrderId);
    expect(results[0].billing_state).toBe("NY");
    expect(results.map((r) => r.id)).not.toContain(outOfRangeOrderId);

    await db.close();
  });
});

describe("getHighValueOrders", () => {
  it("only returns orders at or above minAmount, with lifetime value and shipping address", async () => {
    const db = await openTestDb();
    const reference = new Date("2026-07-19T00:00:00.000Z");

    const customerId = await seedCustomer(db, {
      email: "whale@example.com",
      firstName: "Big",
      lastName: "Spender",
    });

    const shippingAddressId = await seedAddress(db, {
      customerId,
      type: "shipping",
      street1: "1 Shipping Way",
      city: "Shipville",
      state: "CA",
      postalCode: "90001",
      isDefault: true,
    });

    const highValueOrderId = await seedOrder(db, {
      customerId,
      status: "delivered",
      createdAt: toSqliteTimestamp(reference),
      subtotal: 1000,
      totalAmount: 1000,
    });
    await db.run("UPDATE orders SET shipping_address_id = ? WHERE id = ?", [
      shippingAddressId,
      highValueOrderId,
    ]);

    await seedOrder(db, {
      customerId,
      status: "delivered",
      createdAt: toSqliteTimestamp(reference),
      subtotal: 10,
      totalAmount: 10,
    });

    const results = await getHighValueOrders(db, 500);

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(highValueOrderId);
    // lifetime value sums across BOTH orders for this customer (1000 + 10)
    expect(results[0].customer_lifetime_value).toBe(1010);
    expect(results[0].shipping_city).toBe("Shipville");

    await db.close();
  });
});
