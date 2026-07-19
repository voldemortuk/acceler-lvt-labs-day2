import { describe, expect, it } from "vitest";

import { openTestDb } from "./helpers/db";

describe("createSchema", () => {
  it("creates successfully and the orders table is queryable", async () => {
    const db = await openTestDb();

    const rows = await db.all("SELECT * FROM orders");
    expect(rows).toEqual([]);

    await db.close();
  });
});
