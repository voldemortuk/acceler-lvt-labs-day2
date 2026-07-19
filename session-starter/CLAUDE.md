# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is an e-commerce data utilities project that provides query functions for a SQLite database. The project uses TypeScript.

## Database Schema

The SQLite database contains tables for a complete e-commerce system including:

- customers, addresses, customer_segments, customer_activity_log
- products, categories, inventory, warehouses
- orders, order_items
- reviews
- promotions

See `schema.ts` for the complete database schema definition.

## Project Structure

- `src/main.ts` - Entry point (currently minimal implementation)
- `src/schema.ts` - Database schema creation functions
- `src/queries/` - Directory containing all query modules:
  - `customer_queries.ts` - Customer-related queries
  - `product_queries.ts` - Product catalog queries
  - `order_queries.ts` - Order management queries
  - `analytics_queries.ts` - Analytics and reporting queries
  - `inventory_queries.ts` - Inventory management queries
  - `promotion_queries.ts` - Promotion queries
  - `review_queries.ts` - Product review queries
  - `shipping_queries.ts` - Shipping queries

## Development Commands

```bash
# Install dependencies
npm run setup

# Type-check (must exit 0 before any task is done — constitution.md §4)
npm run typecheck

# Run tests (must exit 0 before any task is done — constitution.md §4)
npm test
```

## Working with Queries

All query functions return Promises and follow these patterns:

- Single record queries use `await db.get()`
- Multiple record queries use `await db.all()`
- Use parameterized queries to prevent SQL injection
- Errors propagate as rejected promises automatically via the `sqlite` wrapper — no manual `new Promise`/callback wrapping needed

Example query pattern:

```typescript
export async function getCustomerByEmail(db: Database, email: string): Promise<any> {
  const query = `SELECT * FROM customers WHERE email = ?`;
  return await db.get(query, [email]);
}
```

## Critical Guidance

- Critical: `schema.ts` is the source of truth for this release and is immutable — code reconciles to `schema.ts`, never the reverse. See [constitution.md](./constitution.md) §1.
- Critical: All database queries must be written in the ./src/queries dir. This is enforced by a hook, not just convention — see `hooks/scope_guard.js`, wired in `.claude/settings.json`.
- Critical: no task is "done" mid-turn on red — `hooks/green_gate.js` blocks the Stop event until `npm run typecheck && npm test` both pass. See `hooks/audit_log.js` for the append-only tool-call audit trail.
- Next up (not yet built): the stale-order-alerts feature specified in [`specs/stale-order-alerts/spec.md`](./specs/stale-order-alerts/spec.md) — implement it through Plan Mode, then build an MCP server (`mcp/alert-server.ts`) exposing `send_alert`/`list_sent_alerts`.
