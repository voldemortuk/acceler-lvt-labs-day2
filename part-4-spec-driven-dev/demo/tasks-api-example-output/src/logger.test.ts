import { describe, it, expect } from "vitest";
import { createLogger } from "./logger.js";

describe("logger", () => {
  function make(fixedNow = new Date("2026-07-01T12:00:00.000Z")) {
    const lines: string[] = [];
    const logger = createLogger({
      write: (l) => lines.push(l),
      now: () => fixedNow,
    });
    return { logger, lines };
  }

  it("writes exactly one JSON line per call", () => {
    const { logger, lines } = make();
    logger.log("test.event", { foo: "bar" });
    expect(lines).toHaveLength(1);
    expect(lines[0]!.endsWith("\n")).toBe(true);
    const parsed = JSON.parse(lines[0]!.trimEnd());
    expect(parsed.event).toBe("test.event");
    expect(parsed.foo).toBe("bar");
    expect(parsed.timestamp).toBe("2026-07-01T12:00:00.000Z");
  });

  it("preserves arbitrary fields including nested objects and nulls", () => {
    const { logger, lines } = make();
    logger.log("x", { n: 42, s: "hi", o: { a: 1 }, u: null });
    const parsed = JSON.parse(lines[0]!.trimEnd());
    expect(parsed).toMatchObject({
      event: "x",
      n: 42,
      s: "hi",
      o: { a: 1 },
      u: null,
    });
  });

  it("timestamp is ISO 8601 UTC", () => {
    const { logger, lines } = make();
    logger.log("x");
    const parsed = JSON.parse(lines[0]!.trimEnd());
    expect(parsed.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
  });

  it("empty fields object is allowed", () => {
    const { logger, lines } = make();
    logger.log("only.event");
    const parsed = JSON.parse(lines[0]!.trimEnd());
    expect(parsed.event).toBe("only.event");
    expect(Object.keys(parsed).sort()).toEqual(["event", "timestamp"]);
  });
});
