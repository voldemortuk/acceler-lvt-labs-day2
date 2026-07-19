import fs from "fs";
import os from "os";
import path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { run } from "../src/alert-check";
import { openTestDb } from "./helpers/db";
import { seedCustomer, seedOrder } from "./helpers/seed";
import { daysBefore, toSqliteTimestamp } from "./helpers/time";

function readLines(filePath: string): any[] {
  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

describe("run (alert-check entry point)", () => {
  let tempDir: string;
  let outboxPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "alert-check-test-"));
    outboxPath = path.join(tempDir, "alerts.jsonl");
    process.env.ALERT_OUTBOX = outboxPath;
    delete process.env.ALERT_INCLUDE_PII;
    delete process.env.ALERT_NOW;
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.ALERT_OUTBOX;
    delete process.env.ALERT_INCLUDE_PII;
    delete process.env.ALERT_NOW;
  });

  it("delivers a valid stale order but logs+skips one with no matching customer, exiting 1 (AC7)", async () => {
    const db = await openTestDb();
    const now = new Date("2026-07-19T00:00:00.000Z");

    const validCustomerId = await seedCustomer(db, {
      email: "valid-buyer@example.com",
      firstName: "Valid",
      lastName: "Buyer",
      phone: "555-9999",
    });
    const validOrderId = await seedOrder(db, {
      customerId: validCustomerId,
      status: "pending",
      createdAt: toSqliteTimestamp(daysBefore(now, 10)),
    });

    const orphanOrderId = await seedOrder(db, {
      customerId: 999999,
      status: "pending",
      createdAt: toSqliteTimestamp(daysBefore(now, 10)),
    });

    const exitCode = await run(now, db);

    expect(exitCode).toBe(1);

    const lines = readLines(outboxPath);
    expect(lines).toHaveLength(1);
    expect(lines[0].order_id).toBe(validOrderId);
    expect(lines.find((l) => l.order_id === orphanOrderId)).toBeUndefined();

    await db.close();
  });

  it("produces identical outbox output across two runs given the same fixed now (AC10, also AC4 at the entry point)", async () => {
    const db = await openTestDb();
    const now = new Date("2026-07-19T00:00:00.000Z");

    const customerId = await seedCustomer(db, {
      email: "repeat-buyer@example.com",
      firstName: "Repeat",
      lastName: "Buyer",
      phone: "555-1111",
    });
    await seedOrder(db, {
      customerId,
      status: "pending",
      createdAt: toSqliteTimestamp(daysBefore(now, 5)),
    });

    const firstExitCode = await run(now, db);
    const firstLines = readLines(outboxPath);

    const secondExitCode = await run(now, db);
    const secondLines = readLines(outboxPath);

    expect(firstExitCode).toBe(0);
    expect(secondExitCode).toBe(0);
    expect(firstLines).toHaveLength(1);
    expect(secondLines).toHaveLength(1);
    expect(secondLines).toEqual(firstLines);

    await db.close();
  });

  it("exits 0 with an empty outbox when there are zero stale orders", async () => {
    const db = await openTestDb();
    const now = new Date("2026-07-19T00:00:00.000Z");

    const exitCode = await run(now, db);

    expect(exitCode).toBe(0);
    expect(fs.existsSync(outboxPath)).toBe(false);

    await db.close();
  });
});

describe("main.ts isolation (AC11)", () => {
  it("never references the alert-check entry point or the alerts module", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src", "main.ts"),
      "utf8"
    );

    expect(source.toLowerCase()).not.toContain("alert");
  });
});
