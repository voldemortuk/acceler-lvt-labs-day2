import { describe, it, expect } from "vitest";
import type { Request, Response } from "express";
import { listOrdersForCustomer } from "../src/api/orders.js";

// Minimal fake Express req/res so we can drive the handler without a real HTTP layer.
// The refactor must keep these tests green.

function mockReq(customerId: string, includeCancelled?: string): Request {
  return {
    params: { customerId },
    query: includeCancelled === undefined ? {} : { includeCancelled },
  } as unknown as Request;
}

function mockRes(): Response & { _status?: number; _body?: unknown } {
  const res: Partial<Response> & { _status?: number; _body?: unknown } = {};
  res.status = ((code: number) => {
    res._status = code;
    return res as Response;
  }) as Response["status"];
  res.json = ((body: unknown) => {
    res._body = body;
    return res as Response;
  }) as Response["json"];
  return res as Response & { _status?: number; _body?: unknown };
}

describe("listOrdersForCustomer", () => {
  it("returns non-cancelled orders for a valid customer by default", async () => {
    const req = mockReq("cus_alpha");
    const res = mockRes();
    await listOrdersForCustomer(req, res);
    expect(res._status).toBe(200);
    const body = res._body as { orders: unknown[]; total: number };
    // cus_alpha has one paid + one pending, no cancelled.
    expect(body.total).toBe(2);
    expect(body.orders).toHaveLength(2);
  });

  it("rejects a customerId shorter than 3 characters with 400", async () => {
    const req = mockReq("x");
    const res = mockRes();
    await listOrdersForCustomer(req, res);
    expect(res._status).toBe(400);
    expect(res._body).toEqual({ error: "invalid customerId" });
  });
});
