import { describe, it, expect } from "vitest";
import { effectiveTimezone } from "./index.js";

describe("bootstrap — startup timezone (FR-018 / Q5)", () => {
  it("effectiveTimezone() returns a non-empty string", () => {
    const tz = effectiveTimezone();
    expect(typeof tz).toBe("string");
    expect(tz.length).toBeGreaterThan(0);
  });

  it("effectiveTimezone() matches Intl or a UTC offset fallback", () => {
    const tz = effectiveTimezone();
    const intlTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Either the IANA zone or a "UTC±HH:MM" fallback shape.
    const isIana = intlTz && tz === intlTz;
    const isOffset = /^UTC[+-]\d{2}:\d{2}$/.test(tz);
    expect(isIana || isOffset).toBe(true);
  });
});
