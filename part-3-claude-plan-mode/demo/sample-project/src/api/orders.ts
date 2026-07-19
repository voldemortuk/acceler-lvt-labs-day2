// DELIBERATELY MESSY.
// This handler mixes HTTP concerns, business rules, DB access, formatting, and logging.
// The Plan Mode demo refactors it into route + service + repository.
// Do not "fix" this file by hand — it is the demo's starting point.

import type { Request, Response } from "express";
import { db, type OrderRow } from "../db/client.js";

type OrderDto = {
  id: string;
  customer_id: string;
  amount: { value: number; currency: string };
  status: "pending" | "paid" | "cancelled";
  created_at: string;
  is_refundable: boolean;
};

const REFUND_WINDOW_DAYS = 30;

export async function listOrdersForCustomer(req: Request, res: Response): Promise<void> {
  // ---- HTTP parsing ----------------------------------------------------
  const customerId = req.params.customerId;
  if (!customerId || typeof customerId !== "string" || customerId.length < 3) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ level: "warn", event: "invalid_customer_id", customerId }));
    res.status(400).json({ error: "invalid customerId" });
    return;
  }
  const includeCancelledRaw = req.query.includeCancelled;
  const includeCancelled = includeCancelledRaw === "1" || includeCancelledRaw === "true";

  // ---- DB access -------------------------------------------------------
  let rows: OrderRow[];
  try {
    rows = await db.findOrdersByCustomer(customerId);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({ level: "error", event: "db_error", customerId, err: String(err) })
    );
    res.status(500).json({ error: "internal error" });
    return;
  }

  // ---- Business rules --------------------------------------------------
  const filtered = includeCancelled ? rows : rows.filter((r) => r.status !== "cancelled");

  const now = Date.now();
  const dtos: OrderDto[] = filtered.map((r) => {
    const ageDays = (now - Date.parse(r.createdAt)) / (1000 * 60 * 60 * 24);
    const isRefundable = r.status === "paid" && ageDays <= REFUND_WINDOW_DAYS;
    return {
      id: r.id,
      customer_id: r.customerId,
      amount: { value: r.amountCents / 100, currency: r.currency },
      status: r.status,
      created_at: r.createdAt,
      is_refundable: isRefundable,
    };
  });

  // ---- Response formatting + logging -----------------------------------
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({ level: "info", event: "orders_listed", customerId, count: dtos.length })
  );
  res.status(200).json({ orders: dtos, total: dtos.length });
}
