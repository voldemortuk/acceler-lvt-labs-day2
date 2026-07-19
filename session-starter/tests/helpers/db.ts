import { open, type Database } from "sqlite";
import sqlite3 from "sqlite3";

import { createSchema } from "../../src/schema";

export async function openTestDb(): Promise<Database> {
  const db = await open({
    filename: ":memory:",
    driver: sqlite3.Database,
  });
  await createSchema(db);
  return db;
}
