import { describe, expect, it } from "vitest";

import {
  fetchActiveCustomers,
  findCustomersBySegment,
  getCustomerByEmail,
  getCustomerProfile,
  listCustomersWithReviews,
  searchCustomersByName,
} from "../../src/queries/customer_queries";
import { openTestDb } from "../helpers/db";
import {
  seedAddress,
  seedCustomer,
  seedCustomerSegment,
  seedOrder,
  seedOrderItem,
  seedProduct,
  seedReview,
} from "../helpers/seed";
import { daysBefore, toSqliteTimestamp } from "../helpers/time";

describe("getCustomerByEmail", () => {
  it("returns the customer's default shipping address, not their billing address", async () => {
    const db = await openTestDb();
    const reference = new Date("2026-07-19T00:00:00.000Z");

    const customerId = await seedCustomer(db, {
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      phone: "555-1234",
    });

    await seedAddress(db, {
      customerId,
      type: "shipping",
      street1: "1 Shipping Way",
      city: "Shipville",
      state: "CA",
      postalCode: "90001",
      isDefault: true,
    });
    await seedAddress(db, {
      customerId,
      type: "billing",
      street1: "2 Billing Blvd",
      city: "Billtown",
      state: "NY",
      postalCode: "10001",
      isDefault: true,
    });

    await seedOrder(db, {
      customerId,
      status: "delivered",
      createdAt: toSqliteTimestamp(reference),
    });

    const result = await getCustomerByEmail(db, "ada@example.com");

    expect(result.shipping_street_1).toBe("1 Shipping Way");
    expect(result.shipping_city).toBe("Shipville");
    expect(result.shipping_state).toBe("CA");
    expect(result.shipping_postal_code).toBe("90001");

    await db.close();
  });
});

describe("fetchActiveCustomers", () => {
  it("returns only customers with an order inside the inactivity window", async () => {
    const db = await openTestDb();
    // fetchActiveCustomers computes its cutoff from the real wall clock
    // internally (not injectable) — reconciling column names here, not that
    // design, so this test necessarily anchors to real "now" too.
    const now = new Date();

    const activeCustomerId = await seedCustomer(db, {
      email: "active@example.com",
      firstName: "Grace",
      lastName: "Hopper",
    });
    await seedOrder(db, {
      customerId: activeCustomerId,
      status: "delivered",
      createdAt: toSqliteTimestamp(daysBefore(now, 5)),
    });

    const inactiveCustomerId = await seedCustomer(db, {
      email: "inactive@example.com",
      firstName: "Charles",
      lastName: "Babbage",
    });
    await seedOrder(db, {
      customerId: inactiveCustomerId,
      status: "delivered",
      createdAt: toSqliteTimestamp(daysBefore(now, 200)),
    });

    const results = await fetchActiveCustomers(db, 90);

    expect(results).toHaveLength(1);
    expect(results[0].email).toBe("active@example.com");
    expect(results[0].total_order_count).toBe(1);

    await db.close();
  });
});

describe("findCustomersBySegment", () => {
  it("excludes expired segment memberships", async () => {
    const db = await openTestDb();
    // findCustomersBySegment compares against the real wall clock
    // (datetime('now')) internally — reconciling column/table names here,
    // not that design, so this test necessarily anchors to real "now" too.
    const now = new Date();

    const activeCustomerId = await seedCustomer(db, {
      email: "vip-active@example.com",
      firstName: "Marie",
      lastName: "Curie",
    });
    await seedCustomerSegment(db, {
      customerId: activeCustomerId,
      segmentName: "vip",
      expiresAt: null,
    });

    const expiredCustomerId = await seedCustomer(db, {
      email: "vip-expired@example.com",
      firstName: "Niels",
      lastName: "Bohr",
    });
    await seedCustomerSegment(db, {
      customerId: expiredCustomerId,
      segmentName: "vip",
      expiresAt: toSqliteTimestamp(daysBefore(now, 30)),
    });

    const results = await findCustomersBySegment(db, "vip");

    expect(results).toHaveLength(1);
    expect(results[0].email).toBe("vip-active@example.com");

    await db.close();
  });
});

describe("getCustomerProfile", () => {
  it("returns all addresses, the order count, and the most recent products", async () => {
    const db = await openTestDb();
    const reference = new Date("2026-07-19T00:00:00.000Z");

    const customerId = await seedCustomer(db, {
      email: "profile@example.com",
      firstName: "Rosalind",
      lastName: "Franklin",
    });

    await seedAddress(db, {
      customerId,
      type: "shipping",
      street1: "1 Shipping Way",
      city: "Shipville",
      state: "CA",
      postalCode: "90001",
      isDefault: true,
    });
    await seedAddress(db, {
      customerId,
      type: "billing",
      street1: "2 Billing Blvd",
      city: "Billtown",
      state: "NY",
      postalCode: "10001",
    });

    const productOld = await seedProduct(db, {
      sku: "SKU-OLD",
      name: "Old Product",
    });
    const productNew = await seedProduct(db, {
      sku: "SKU-NEW",
      name: "New Product",
    });

    const orderOld = await seedOrder(db, {
      customerId,
      status: "delivered",
      createdAt: toSqliteTimestamp(daysBefore(reference, 10)),
    });
    await seedOrderItem(db, { orderId: orderOld, productId: productOld });

    const orderNew = await seedOrder(db, {
      customerId,
      status: "delivered",
      createdAt: toSqliteTimestamp(daysBefore(reference, 1)),
    });
    await seedOrderItem(db, { orderId: orderNew, productId: productNew });

    const profile = await getCustomerProfile(db, customerId);

    expect(profile.addresses).toHaveLength(2);
    expect(profile.order_count).toBe(2);
    expect(profile.last_5_products[0]).toBe("New Product");
    expect(profile.last_5_products).toContain("Old Product");

    await db.close();
  });

  it("returns null for a nonexistent customer", async () => {
    const db = await openTestDb();
    const profile = await getCustomerProfile(db, 999);
    expect(profile).toBeNull();
    await db.close();
  });
});

describe("searchCustomersByName", () => {
  it("filters by overlapping name substrings and resolves the default shipping address", async () => {
    const db = await openTestDb();

    const graceId = await seedCustomer(db, {
      email: "grace@example.com",
      firstName: "Grace",
      lastName: "Hopper",
    });
    await seedAddress(db, {
      customerId: graceId,
      type: "shipping",
      street1: "1 Shipping Way",
      city: "Shipville",
      state: "CA",
      postalCode: "90001",
      isDefault: true,
    });

    await seedCustomer(db, {
      email: "grant@example.com",
      firstName: "Grant",
      lastName: "Ericson",
    });

    const results = await searchCustomersByName(db, "Gra", "Hopper");

    expect(results).toHaveLength(1);
    expect(results[0].email).toBe("grace@example.com");
    expect(results[0].default_city).toBe("Shipville");
    expect(results[0].default_state).toBe("CA");

    await db.close();
  });
});

describe("listCustomersWithReviews", () => {
  it("returns only customers who have written at least one review", async () => {
    const db = await openTestDb();

    const reviewerId = await seedCustomer(db, {
      email: "reviewer@example.com",
      firstName: "Jane",
      lastName: "Goodall",
    });
    const productA = await seedProduct(db, { sku: "SKU-A", name: "A" });
    const productB = await seedProduct(db, { sku: "SKU-B", name: "B" });
    await seedReview(db, { productId: productA, customerId: reviewerId, rating: 5 });
    await seedReview(db, { productId: productB, customerId: reviewerId, rating: 3 });

    await seedCustomer(db, {
      email: "silent@example.com",
      firstName: "Silent",
      lastName: "Bob",
    });

    const results = await listCustomersWithReviews(db);

    expect(results).toHaveLength(1);
    expect(results[0].email).toBe("reviewer@example.com");
    expect(results[0].review_count).toBe(2);
    expect(results[0].average_rating_given).toBe(4);

    await db.close();
  });
});
