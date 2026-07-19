import { describe, expect, it } from "vitest";

import { buildAlertPayload, maskName, maskPhone } from "../../src/alerts/format";

describe("maskName", () => {
  it("reduces to first name + last initial", () => {
    expect(maskName("Jane", "Doe")).toBe("Jane D");
  });
});

describe("maskPhone", () => {
  it("reduces to the last 4 characters", () => {
    expect(maskPhone("555-0123")).toBe("0123");
  });

  it("renders null as unknown", () => {
    expect(maskPhone(null)).toBe("unknown");
  });
});

describe("buildAlertPayload", () => {
  const baseInput = {
    orderId: 42,
    customerId: 7,
    firstName: "Jane",
    lastName: "Doe",
    phone: "555-0123",
    calendarDay: "2026-07-19",
  };

  it("masks name/phone by default (AC9) and matches the exact §2.1 field shape", () => {
    const line = buildAlertPayload({ ...baseInput, includePii: false });

    expect(line).toEqual({
      order_id: 42,
      customer_id: 7,
      customer_name: "Jane D",
      customer_phone: "0123",
      channel: "#order-alerts",
      calendar_day: "2026-07-19",
    });
  });

  it("emits raw name/phone when includePii is true (AC9)", () => {
    const line = buildAlertPayload({ ...baseInput, includePii: true });

    expect(line.customer_name).toBe("Jane Doe");
    expect(line.customer_phone).toBe("555-0123");
  });

  it("renders a null phone as unknown regardless of includePii (AC8)", () => {
    const masked = buildAlertPayload({ ...baseInput, phone: null, includePii: false });
    const raw = buildAlertPayload({ ...baseInput, phone: null, includePii: true });

    expect(masked.customer_phone).toBe("unknown");
    expect(raw.customer_phone).toBe("unknown");
  });

  it("always includes customer_id unmasked and channel fixed to #order-alerts", () => {
    const line = buildAlertPayload({ ...baseInput, includePii: false });

    expect(line.customer_id).toBe(7);
    expect(line.channel).toBe("#order-alerts");
  });
});
