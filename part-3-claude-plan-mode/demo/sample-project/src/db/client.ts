// In-memory "database" for the demo.
// Real projects would swap this for Prisma, Drizzle, or a raw driver.

export type OrderRow = {
  id: string;
  customerId: string;
  amountCents: number;
  currency: string;
  status: "pending" | "paid" | "cancelled";
  createdAt: string; // ISO-8601
};

const rows: OrderRow[] = [
  {
    id: "ord_001",
    customerId: "cus_alpha",
    amountCents: 4200,
    currency: "USD",
    status: "paid",
    createdAt: "2026-06-01T10:00:00.000Z",
  },
  {
    id: "ord_002",
    customerId: "cus_alpha",
    amountCents: 9900,
    currency: "USD",
    status: "pending",
    createdAt: "2026-06-05T14:12:00.000Z",
  },
  {
    id: "ord_003",
    customerId: "cus_beta",
    amountCents: 15000,
    currency: "EUR",
    status: "cancelled",
    createdAt: "2026-06-10T08:30:00.000Z",
  },
];

export const db = {
  async findOrdersByCustomer(customerId: string): Promise<OrderRow[]> {
    // Simulate async I/O.
    await Promise.resolve();
    return rows.filter((r) => r.customerId === customerId);
  },
  async findOrderById(id: string): Promise<OrderRow | undefined> {
    await Promise.resolve();
    return rows.find((r) => r.id === id);
  },
};
