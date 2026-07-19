import { open } from "sqlite";
import sqlite3 from "sqlite3";

import { createSchema } from "../src/schema";
import { seedCustomer, seedOrder } from "../tests/helpers/seed";
import { daysBefore, toSqliteTimestamp } from "../tests/helpers/time";

// Fixed reference date, matching the test suite's own convention — every
// seeded order's age is deterministic relative to this, not the real
// wall-clock date the script happens to run on.
const REFERENCE = new Date("2026-07-19T00:00:00.000Z");

async function main() {
  const db = await open({
    filename: "ecommerce.db",
    driver: sqlite3.Database,
  });
  await createSchema(db);

  const staleCustomerA = await seedCustomer(db, {
    email: "demo-stale-a@example.com",
    firstName: "Stale",
    lastName: "Alpha",
    phone: "555-1001",
  });
  const staleOrderA = await seedOrder(db, {
    customerId: staleCustomerA,
    status: "pending",
    createdAt: toSqliteTimestamp(daysBefore(REFERENCE, 4)),
  });

  const staleCustomerB = await seedCustomer(db, {
    email: "demo-stale-b@example.com",
    firstName: "Stale",
    lastName: "Bravo",
    phone: "555-1002",
  });
  const staleOrderB = await seedOrder(db, {
    customerId: staleCustomerB,
    status: "pending",
    createdAt: toSqliteTimestamp(daysBefore(REFERENCE, 10)),
  });

  const freshCustomer = await seedCustomer(db, {
    email: "demo-fresh@example.com",
    firstName: "Fresh",
    lastName: "Charlie",
    phone: "555-1003",
  });
  const freshOrder = await seedOrder(db, {
    customerId: freshCustomer,
    status: "pending",
    createdAt: toSqliteTimestamp(daysBefore(REFERENCE, 1)),
  });

  const shippedCustomer = await seedCustomer(db, {
    email: "demo-shipped@example.com",
    firstName: "Shipped",
    lastName: "Delta",
    phone: "555-1004",
  });
  const shippedOrder = await seedOrder(db, {
    customerId: shippedCustomer,
    status: "shipped",
    createdAt: toSqliteTimestamp(daysBefore(REFERENCE, 20)),
  });

  console.log(
    JSON.stringify(
      {
        reference: REFERENCE.toISOString(),
        seeded: {
          stalePendingOrders: [staleOrderA, staleOrderB],
          freshPendingOrder: freshOrder,
          shippedOrder: shippedOrder,
        },
      },
      null,
      2
    )
  );

  await db.close();
}

main();
