import fs from "fs";
import path from "path";

// See src/alerts/format.ts's AlertLine doc comment for the stale-order-alert
// caller's full six-field line shape (spec §2.1). This module doesn't depend
// on that type directly — it only needs the dedupe-key fields every outbox
// line must carry, so a second caller with its own additional fields
// (see mcp/alert-server.ts's send_alert tool) can go through the exact same
// delivery/dedupe path without a second implementation.
//
// `source` is an optional third dedupe-key component, separate from the
// (order_id, calendar_day) pair spec §2.1 names. AlertLine (built by
// buildAlertPayload for alert-check.ts) never sets it — its six-field shape
// is locked by that spec and is left untouched here — so every line written
// by alert-check.ts implicitly shares one unnamed "default" bucket. That's
// fine as long as it stays the ONLY caller in that bucket. Any other caller
// — the mcp/alert-server.ts send_alert tool included — must set its own
// distinct `source` string, or it silently lands in alert-check.ts's
// namespace: the two can then suppress each other any time they happen to
// touch the same order_id on the same calendar_day, even though they're
// unrelated alerts with completely different content. This was an
// unintended coupling the first time a second caller was added (a manual
// send_alert call and the automated stale-order check sharing one physical
// key with no way to tell them apart); it's fixed by this field, not by
// documenting the collision as accepted behavior.
export interface OutboxLine {
  order_id: number;
  calendar_day: string;
  source?: string;
}

export type DeliveryOutcome = "sent" | "skipped-duplicate";

function resolveOutboxPath(outboxPath?: string): string {
  const configured =
    outboxPath ?? process.env.ALERT_OUTBOX ?? "outbox/alerts.jsonl";
  return path.resolve(process.cwd(), configured);
}

function readLinesFromFile(filePath: string): Record<string, unknown>[] {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw err;
  }

  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function isDuplicate(
  lines: Record<string, unknown>[],
  line: OutboxLine
): boolean {
  return lines.some(
    (existing) =>
      existing.order_id === line.order_id &&
      existing.calendar_day === line.calendar_day &&
      existing.source === line.source
  );
}

// Reused by mcp/alert-server.ts's list_sent_alerts tool, so reading the
// outbox back has exactly one implementation too, mirroring the write side.
export function readOutboxLines(
  outboxPath?: string
): Record<string, unknown>[] {
  return readLinesFromFile(resolveOutboxPath(outboxPath));
}

// The single delivery/dedupe entry point every caller goes through — no
// second implementation of this read-before-write check exists anywhere
// else. Dedupe key is (order_id, calendar_day, source) — see OutboxLine's
// doc comment above for why `source` exists and who needs to set it. The
// directory is made ready on every call so a fresh checkout doesn't fail on
// first run. A genuinely unwritable path (e.g. a path component that's
// itself a file) throws here, before any bytes are appended, so prior file
// content is never disturbed.
export async function deliverAlert<T extends OutboxLine>(
  line: T,
  outboxPath?: string
): Promise<DeliveryOutcome> {
  const filePath = resolveOutboxPath(outboxPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const existing = readLinesFromFile(filePath);
  if (isDuplicate(existing, line)) {
    return "skipped-duplicate";
  }

  fs.appendFileSync(filePath, JSON.stringify(line) + "\n");
  return "sent";
}
