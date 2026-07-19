import type { Database } from "sqlite";

let orderCounter = 0;

export interface SeedCustomerInput {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  status?: "active" | "inactive" | "suspended";
}

export async function seedCustomer(
  db: Database,
  input: SeedCustomerInput
): Promise<number> {
  const result = await db.run(
    `INSERT INTO customers (email, first_name, last_name, phone, status) VALUES (?, ?, ?, ?, ?)`,
    [
      input.email,
      input.firstName,
      input.lastName,
      input.phone ?? null,
      input.status ?? "active",
    ]
  );
  return result.lastID as number;
}

export interface SeedOrderInput {
  customerId: number;
  status:
    | "pending"
    | "processing"
    | "shipped"
    | "delivered"
    | "cancelled"
    | "refunded";
  // Required, not defaulted to wall-clock: callers must derive this from an
  // explicit reference time (see tests/helpers/time.ts) so staleness tests
  // never depend on the date the suite happens to run on.
  createdAt: string;
  subtotal?: number;
  totalAmount?: number;
}

export async function seedOrder(
  db: Database,
  input: SeedOrderInput
): Promise<number> {
  orderCounter += 1;
  const orderNumber = `TEST-ORDER-${orderCounter}`;
  const subtotal = input.subtotal ?? 100;
  const totalAmount = input.totalAmount ?? subtotal;

  const result = await db.run(
    `INSERT INTO orders (order_number, customer_id, status, subtotal, total_amount, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      orderNumber,
      input.customerId,
      input.status,
      subtotal,
      totalAmount,
      input.createdAt,
    ]
  );
  return result.lastID as number;
}

export interface SeedCustomerSegmentInput {
  customerId: number;
  segmentName: string;
  valueScore?: number | null;
  // Explicit and nullable, never wall-clock-defaulted: null means "does not
  // expire", a past timestamp means "already expired".
  expiresAt?: string | null;
}

export async function seedCustomerSegment(
  db: Database,
  input: SeedCustomerSegmentInput
): Promise<number> {
  const result = await db.run(
    `INSERT INTO customer_segments (customer_id, segment_name, value_score, expires_at)
     VALUES (?, ?, ?, ?)`,
    [
      input.customerId,
      input.segmentName,
      input.valueScore ?? null,
      input.expiresAt ?? null,
    ]
  );
  return result.lastID as number;
}

export interface SeedProductInput {
  sku: string;
  name: string;
  price?: number;
  categoryId?: number | null;
}

export async function seedProduct(
  db: Database,
  input: SeedProductInput
): Promise<number> {
  const result = await db.run(
    `INSERT INTO products (sku, name, price, category_id) VALUES (?, ?, ?, ?)`,
    [input.sku, input.name, input.price ?? 10, input.categoryId ?? null]
  );
  return result.lastID as number;
}

export interface SeedOrderItemInput {
  orderId: number;
  productId: number;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
}

export async function seedOrderItem(
  db: Database,
  input: SeedOrderItemInput
): Promise<number> {
  const quantity = input.quantity ?? 1;
  const unitPrice = input.unitPrice ?? 10;
  const totalPrice = input.totalPrice ?? quantity * unitPrice;

  const result = await db.run(
    `INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
     VALUES (?, ?, ?, ?, ?)`,
    [input.orderId, input.productId, quantity, unitPrice, totalPrice]
  );
  return result.lastID as number;
}

export interface SeedCategoryInput {
  name: string;
}

export async function seedCategory(
  db: Database,
  input: SeedCategoryInput
): Promise<number> {
  const result = await db.run(`INSERT INTO categories (name) VALUES (?)`, [
    input.name,
  ]);
  return result.lastID as number;
}

export interface SeedWarehouseInput {
  code: string;
  name: string;
}

export async function seedWarehouse(
  db: Database,
  input: SeedWarehouseInput
): Promise<number> {
  const result = await db.run(
    `INSERT INTO warehouses (code, name) VALUES (?, ?)`,
    [input.code, input.name]
  );
  return result.lastID as number;
}

export interface SeedInventoryInput {
  productId: number;
  warehouseId: number;
  quantity?: number;
}

export async function seedInventory(
  db: Database,
  input: SeedInventoryInput
): Promise<number> {
  const result = await db.run(
    `INSERT INTO inventory (product_id, warehouse_id, quantity) VALUES (?, ?, ?)`,
    [input.productId, input.warehouseId, input.quantity ?? 100]
  );
  return result.lastID as number;
}

export interface SeedReviewInput {
  productId: number;
  customerId: number;
  orderId?: number | null;
  rating: number;
}

export async function seedReview(
  db: Database,
  input: SeedReviewInput
): Promise<number> {
  const result = await db.run(
    `INSERT INTO reviews (product_id, customer_id, order_id, rating) VALUES (?, ?, ?, ?)`,
    [input.productId, input.customerId, input.orderId ?? null, input.rating]
  );
  return result.lastID as number;
}

export interface SeedAddressInput {
  customerId: number;
  type: "billing" | "shipping" | "both";
  street1: string;
  street2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  isDefault?: boolean;
}

export async function seedAddress(
  db: Database,
  input: SeedAddressInput
): Promise<number> {
  const result = await db.run(
    `INSERT INTO addresses (customer_id, type, street_1, street_2, city, state, postal_code, country, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.customerId,
      input.type,
      input.street1,
      input.street2 ?? null,
      input.city,
      input.state,
      input.postalCode,
      input.country ?? "US",
      input.isDefault ? 1 : 0,
    ]
  );
  return result.lastID as number;
}
