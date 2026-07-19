import { fileURLToPath } from "url";

import { Database, open } from "sqlite";
import sqlite3 from "sqlite3";

import { buildAlertPayload } from "./alerts/format";
import { deliverAlert } from "./alerts/outbox";
import { findStalePendingOrders } from "./queries/order_queries";
import { createSchema } from "./schema";

const THRESHOLD_DAYS = 3;

type LogOutcome = "sent" | "skipped-duplicate" | "error";

interface LogEntry {
  outcome: LogOutcome;
  order_id: number;
  calendar_day: string;
  reason?: string;
}

function logOutcome(entry: LogEntry): void {
  console.log(JSON.stringify(entry));
}

function resolveNow(): Date {
  return process.env.ALERT_NOW ? new Date(process.env.ALERT_NOW) : new Date();
}

function calendarDayUTC(now: Date): string {
  return now.toISOString().slice(0, 10);
}

// The cron entry point for stale-pending-order alerts — independent of
// main.ts/schema bootstrap (spec §1/§2), so one process's failure can't
// affect the other's exit code. `now` defaults to resolveNow() (reads
// ALERT_NOW, else the real clock) for real runs; tests pass a fixed Date
// directly so two calls are reproducible (AC10) without touching
// process.env. `db` is optional dependency injection, matching every
// query function's own convention — omitted in real runs (opens the real
// "ecommerce.db"), passed explicitly by tests (an isolated in-memory db).
export async function run(
  now: Date = resolveNow(),
  db?: Database
): Promise<number> {
  const ownsDb = !db;
  const activeDb =
    db ??
    (await open({
      filename: "ecommerce.db",
      driver: sqlite3.Database,
    }));
  const includePii = process.env.ALERT_INCLUDE_PII === "true";
  const calendarDay = calendarDayUTC(now);
  let exitCode = 0;

  try {
    await createSchema(activeDb);
    const staleOrders = await findStalePendingOrders(
      activeDb,
      THRESHOLD_DAYS,
      now
    );

    for (const order of staleOrders) {
      // AC7: a per-order data issue — log it, keep going, still deliver
      // every other valid order in this run.
      if (order.customer_row_id == null) {
        logOutcome({
          outcome: "error",
          order_id: order.order_id,
          calendar_day: calendarDay,
          reason: `customer_id ${order.customer_id} has no matching customers row`,
        });
        exitCode = 1;
        continue;
      }

      const line = buildAlertPayload({
        orderId: order.order_id,
        customerId: order.customer_id,
        firstName: order.first_name!,
        lastName: order.last_name!,
        phone: order.phone,
        calendarDay,
        includePii,
      });

      try {
        const outcome = await deliverAlert(line);
        logOutcome({
          outcome,
          order_id: order.order_id,
          calendar_day: calendarDay,
        });
      } catch (err) {
        // AC6: a systemic delivery failure — every remaining order would
        // fail the same way, so stop here instead of repeating the error.
        logOutcome({
          outcome: "error",
          order_id: order.order_id,
          calendar_day: calendarDay,
          reason: (err as Error).message,
        });
        exitCode = 1;
        break;
      }
    }
  } finally {
    if (ownsDb) {
      await activeDb.close();
    }
  }

  return exitCode;
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  run().then((code) => process.exit(code));
}
