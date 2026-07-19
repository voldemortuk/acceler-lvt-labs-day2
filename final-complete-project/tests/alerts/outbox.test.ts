import fs from "fs";
import os from "os";
import path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AlertLine } from "../../src/alerts/format";
import { deliverAlert, readOutboxLines } from "../../src/alerts/outbox";

function makeLine(overrides: Partial<AlertLine> = {}): AlertLine {
  return {
    order_id: 1,
    customer_id: 2,
    customer_name: "Jane D",
    customer_phone: "0123",
    channel: "#order-alerts",
    calendar_day: "2026-07-19",
    ...overrides,
  };
}

function readLines(filePath: string): AlertLine[] {
  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

describe("deliverAlert", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "outbox-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("makes the parent directory ready and writes the first line", async () => {
    const outboxPath = path.join(tempDir, "nested", "alerts.jsonl");

    const outcome = await deliverAlert(makeLine(), outboxPath);

    expect(outcome).toBe("sent");
    expect(readLines(outboxPath)).toEqual([makeLine()]);
  });

  it("writes exactly one line for a repeated (order_id, calendar_day) pair (AC4)", async () => {
    const outboxPath = path.join(tempDir, "alerts.jsonl");
    const line = makeLine();

    const first = await deliverAlert(line, outboxPath);
    const second = await deliverAlert(line, outboxPath);

    expect(first).toBe("sent");
    expect(second).toBe("skipped-duplicate");
    expect(readLines(outboxPath)).toHaveLength(1);
  });

  it("writes a new line when the same order re-alerts on a later calendar_day (AC5)", async () => {
    const outboxPath = path.join(tempDir, "alerts.jsonl");

    await deliverAlert(makeLine({ calendar_day: "2026-07-19" }), outboxPath);
    const second = await deliverAlert(
      makeLine({ calendar_day: "2026-07-20" }),
      outboxPath
    );

    expect(second).toBe("sent");
    expect(readLines(outboxPath)).toHaveLength(2);
  });

  it("throws when a path component is itself a file, not merely a missing directory (AC6)", async () => {
    const blockerFile = path.join(tempDir, "not-a-directory");
    fs.writeFileSync(blockerFile, "just a file");
    const unwritablePath = path.join(blockerFile, "alerts.jsonl");

    await expect(deliverAlert(makeLine(), unwritablePath)).rejects.toThrow();
  });

  it("leaves prior byte content unchanged when a write fails after the file already has entries (AC6)", async () => {
    const outboxPath = path.join(tempDir, "alerts.jsonl");
    await deliverAlert(makeLine({ order_id: 1 }), outboxPath);
    const before = fs.readFileSync(outboxPath, "utf8");

    fs.chmodSync(outboxPath, 0o444);
    try {
      await expect(
        deliverAlert(makeLine({ order_id: 2 }), outboxPath)
      ).rejects.toThrow();
    } finally {
      fs.chmodSync(outboxPath, 0o644);
    }

    expect(fs.readFileSync(outboxPath, "utf8")).toBe(before);
  });

  it("delivers a line with extra caller-defined fields beyond AlertLine's six, keyed only on order_id/calendar_day", async () => {
    const outboxPath = path.join(tempDir, "alerts.jsonl");
    const mcpStyleLine = {
      order_id: 5,
      calendar_day: "2026-07-19",
      channel: "#order-alerts",
      summary: "Order 5 needs a follow-up",
      body: "Full detail here.",
    };

    const first = await deliverAlert(mcpStyleLine, outboxPath);
    const second = await deliverAlert(mcpStyleLine, outboxPath);

    expect(first).toBe("sent");
    expect(second).toBe("skipped-duplicate");
    expect(readLines(outboxPath)).toHaveLength(1);
  });

  it("dedupes two lines with the same explicit source, same order_id/calendar_day", async () => {
    const outboxPath = path.join(tempDir, "alerts.jsonl");
    const line = { order_id: 9, calendar_day: "2026-07-19", source: "mcp-send-alert" };

    const first = await deliverAlert(line, outboxPath);
    const second = await deliverAlert(line, outboxPath);

    expect(first).toBe("sent");
    expect(second).toBe("skipped-duplicate");
    expect(readLines(outboxPath)).toHaveLength(1);
  });

  it("does not let two different sources suppress each other on the same order_id/calendar_day", async () => {
    const outboxPath = path.join(tempDir, "alerts.jsonl");
    const staleOrderCheckLine = makeLine({ order_id: 9, calendar_day: "2026-07-19" });
    const mcpLine = {
      order_id: 9,
      calendar_day: "2026-07-19",
      source: "mcp-send-alert",
      channel: "#order-alerts",
      summary: "manual note",
      body: "manual note detail",
    };

    const first = await deliverAlert(staleOrderCheckLine, outboxPath);
    const second = await deliverAlert(mcpLine, outboxPath);

    expect(first).toBe("sent");
    expect(second).toBe("sent");
    expect(readLines(outboxPath)).toHaveLength(2);
  });
});

describe("readOutboxLines", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "outbox-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns an empty array when the outbox file doesn't exist yet", () => {
    const outboxPath = path.join(tempDir, "alerts.jsonl");

    expect(readOutboxLines(outboxPath)).toEqual([]);
  });

  it("reads back every line previously delivered, in write order", async () => {
    const outboxPath = path.join(tempDir, "alerts.jsonl");
    await deliverAlert(makeLine({ order_id: 1 }), outboxPath);
    await deliverAlert(makeLine({ order_id: 2, calendar_day: "2026-07-20" }), outboxPath);

    const lines = readOutboxLines(outboxPath);

    expect(lines).toHaveLength(2);
    expect(lines[0].order_id).toBe(1);
    expect(lines[1].order_id).toBe(2);
  });
});
