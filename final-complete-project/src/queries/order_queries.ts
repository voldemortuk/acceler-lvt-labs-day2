import { Database } from "sqlite";

interface OrderItem {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface OrderDetails {
  id: number;
  created_at: string;
  status: string;
  total_amount: number;
  customer_email: string;
  shipping_street_1: string | null;
  shipping_street_2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postal_code: string | null;
  items: OrderItem[];
}

export async function getOrderDetails(
  db: Database,
  orderId: number
): Promise<OrderDetails | null> {
  const query = `
    SELECT
        o.id,
        o.created_at,
        o.status,
        o.total_amount,
        c.email as customer_email,
        sa.street_1 as shipping_street_1,
        sa.street_2 as shipping_street_2,
        sa.city as shipping_city,
        sa.state as shipping_state,
        sa.postal_code as shipping_postal_code,
        oi.id as order_item_id,
        oi.product_id,
        p.name as product_name,
        oi.quantity,
        oi.unit_price
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    LEFT JOIN addresses sa ON sa.id = o.shipping_address_id
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id
    WHERE o.id = ?
    `;

  const rows: any[] = await db.all(query, [orderId]);

  if (!rows || rows.length === 0) {
    return null;
  }

  const order: OrderDetails = {
    id: rows[0].id,
    created_at: rows[0].created_at,
    status: rows[0].status,
    total_amount: rows[0].total_amount,
    customer_email: rows[0].customer_email,
    shipping_street_1: rows[0].shipping_street_1,
    shipping_street_2: rows[0].shipping_street_2,
    shipping_city: rows[0].shipping_city,
    shipping_state: rows[0].shipping_state,
    shipping_postal_code: rows[0].shipping_postal_code,
    items: [],
  };

  for (const row of rows) {
    order.items.push({
      id: row.order_item_id,
      product_id: row.product_id,
      product_name: row.product_name,
      quantity: row.quantity,
      unit_price: row.unit_price,
    });
  }

  return order;
}

export async function fetchCustomerOrders(
  db: Database,
  customerId: number,
  limit: number = 10
): Promise<any[]> {
  const query = `
    SELECT
        o.id,
        o.created_at,
        o.status,
        o.total_amount,
        COUNT(oi.id) as item_count
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    WHERE o.customer_id = ?
    GROUP BY o.id, o.created_at, o.status, o.total_amount
    ORDER BY o.created_at DESC
    LIMIT ?
    `;

  const rows = await db.all(query, [customerId, limit]);
  return rows;
}

export async function getPendingOrders(db: Database): Promise<any[]> {
  const query = `
    SELECT
        o.id,
        o.created_at,
        o.total_amount,
        c.first_name || ' ' || c.last_name as customer_name,
        c.phone,
        julianday('now') - julianday(o.created_at) as days_since_created
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    WHERE o.status = 'pending'
    ORDER BY o.created_at DESC
    `;

  const rows = await db.all(query, []);
  return rows;
}

export async function findOrdersByStatus(
  db: Database,
  status: string
): Promise<any[]> {
  const query = `
    SELECT DISTINCT
        o.id,
        o.created_at,
        o.total_amount,
        c.email as customer_email,
        GROUP_CONCAT(DISTINCT p.sku) as product_skus,
        GROUP_CONCAT(DISTINCT w.name) as warehouses
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN products p ON oi.product_id = p.id
    LEFT JOIN inventory i ON i.product_id = p.id
    LEFT JOIN warehouses w ON i.warehouse_id = w.id
    WHERE o.status = ?
    GROUP BY o.id, o.created_at, o.total_amount, c.email
    ORDER BY o.created_at DESC
    `;

  const rows = await db.all(query, [status]);
  return rows;
}

export async function getRecentOrders(
  db: Database,
  days: number = 7
): Promise<any[]> {
  const query = `
    SELECT DISTINCT
        o.id,
        o.created_at,
        o.total_amount,
        o.shipping_amount,
        GROUP_CONCAT(DISTINCT sg.segment_name) as customer_segments,
        CASE
            WHEN o.shipping_amount = 0 THEN 'Free Shipping'
            WHEN o.shipping_amount < 10 THEN 'Standard'
            WHEN o.shipping_amount < 25 THEN 'Express'
            ELSE 'Priority'
        END as shipping_method,
        GROUP_CONCAT(DISTINCT cat.name) as product_categories
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    LEFT JOIN customer_segments sg ON sg.customer_id = c.id AND (sg.expires_at IS NULL OR sg.expires_at > datetime('now'))
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN products p ON oi.product_id = p.id
    LEFT JOIN categories cat ON p.category_id = cat.id
    WHERE o.created_at >= date('now', '-' || ? || ' days')
    GROUP BY o.id, o.created_at, o.total_amount, o.shipping_amount
    ORDER BY o.created_at DESC
    `;

  const rows = await db.all(query, [days]);
  return rows;
}

export async function fetchOrdersByDateRange(
  db: Database,
  startDate: string,
  endDate: string
): Promise<any[]> {
  const query = `
    SELECT
        o.id,
        o.created_at,
        o.total_amount,
        c.status as customer_status,
        ba.state as billing_state,
        COUNT(oi.id) as item_count
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    LEFT JOIN addresses ba ON ba.id = o.billing_address_id
    LEFT JOIN order_items oi ON o.id = oi.order_id
    WHERE o.created_at >= ? AND o.created_at <= ?
    GROUP BY o.id, o.created_at, o.total_amount, c.status, ba.state
    ORDER BY o.created_at DESC
    `;

  const rows = await db.all(query, [startDate, endDate]);
  return rows;
}

export async function getHighValueOrders(
  db: Database,
  minAmount: number = 500
): Promise<any[]> {
  const query = `
    WITH customer_ltv AS (
        SELECT
            customer_id,
            SUM(total_amount) as lifetime_value
        FROM orders
        GROUP BY customer_id
    )
    SELECT DISTINCT
        o.id,
        o.created_at,
        o.total_amount,
        c.email,
        ltv.lifetime_value as customer_lifetime_value,
        sa.street_1 as shipping_street_1,
        sa.street_2 as shipping_street_2,
        sa.city as shipping_city,
        sa.state as shipping_state,
        sa.postal_code as shipping_postal_code,
        GROUP_CONCAT(p.name) as product_names
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    JOIN customer_ltv ltv ON c.id = ltv.customer_id
    LEFT JOIN addresses sa ON sa.id = o.shipping_address_id
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE o.total_amount >= ?
    GROUP BY o.id, o.created_at, o.total_amount, c.email,
             ltv.lifetime_value, sa.street_1, sa.street_2, sa.city,
             sa.state, sa.postal_code
    ORDER BY o.total_amount DESC
    `;

  const rows = await db.all(query, [minAmount]);
  return rows;
}

export interface StalePendingOrder {
  order_id: number;
  customer_id: number;
  customer_row_id: number | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string;
}

export async function findStalePendingOrders(
  db: Database,
  thresholdDays: number = 3,
  now: Date
): Promise<StalePendingOrder[]> {
  // Cutoff is computed from the injected `now`, never from a wall-clock SQL
  // function, so a fixed `now` makes two runs of the caller fully
  // reproducible. orders.created_at is stored as "YYYY-MM-DD HH:MM:SS" (UTC),
  // so formatting the cutoff the same way keeps the comparison a plain
  // parameterized string compare.
  const cutoffMs = now.getTime() - thresholdDays * 24 * 60 * 60 * 1000;
  const cutoff = new Date(cutoffMs).toISOString().slice(0, 19).replace("T", " ");

  const query = `
    SELECT
        o.id as order_id,
        o.customer_id,
        c.id as customer_row_id,
        c.first_name,
        c.last_name,
        c.phone,
        o.created_at
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE o.status = 'pending'
      AND o.created_at < ?
    ORDER BY o.created_at ASC
    `;

  const rows: StalePendingOrder[] = await db.all(query, [cutoff]);
  return rows;
}
