# Worksheet — Operation Stale Orders

## M1 — Gap hunt

Questions the brief (`task.md`) does not answer, found before writing the spec:

1. **Time / anchor**: "pending too long (more than 3 days)" — measured against which timestamp? `orders` has no `order_date`, only `created_at`. Calendar days (midnight boundaries) or exact 72-hour duration? What timezone (DB timestamps are `CURRENT_TIMESTAMP`, i.e. UTC)?
2. **Data / PII**: the brief asks for customer **name and phone number** in a channel the whole team reads. Is that acceptable to broadcast verbatim?
3. **Repetition**: the "cron" runs daily. An order that's been pending 10 days — re-alert every day, once only, or escalate? What does "send an alert" mean on day 2 of the same stale order?
4. **Failure**: what happens if the alert delivery fails mid-run (disk full, bad path)? Partial writes? Exit code?
5. **Truth**: `order_queries.ts` and `customer_queries.ts` assume a schema (`order_id`, `order_date`, `shipping_addresses` table, a `segments` table) that doesn't match what `schema.ts` actually builds (`id`, `created_at`, `addresses` with a `type` column, `customer_segments.segment_name` inline). Which side is allowed to change?
6. **Proof**: tests need to control "3 days ago" without depending on the wall-clock date the suite happens to run on. How?
7. **Scope of "pending"**: does it mean exactly `status = 'pending'`, or does it also cover `processing`? The CHECK constraint lists both as distinct values.
8. **Delivery target**: the brief says "#order-alerts" (real Slack). For this assignment, is a stubbed/local delivery mechanism acceptable, and how is it made testable/deterministic?

## M1 — Grill-me: three questions that most changed my thinking

Ran the full interview (12 questions) before drafting. Three that mattered most:

1. **Re-alert cadence, and where dedupe state lives** (Q3): forced the realization that "already alerted" bookkeeping cannot live in `schema.ts` (immutable this release, per constitution) — the outbox file itself has to double as the persisted dedupe record, keyed on `(order_id, calendar_day)`. Without this question I'd likely have reached for a new DB column by default.
2. **The PII policy** (Q4): task.md's "so someone can follow up" reads as a pull toward raw PII. Landed on: mask by default (first name + last initial, phone to last-4), always carry `order_id`/`customer_id` for lookup, full detail only behind an explicit `ALERT_INCLUDE_PII` opt-in. The follow-up requirement is satisfied by the lookup key, not the raw data.
3. **The MCP scope slip** (Q11): the interviewing agent caught me referencing "the MCP `list_sent_alerts` contract" as if it were an established requirement, when nothing in `task.md`/`CLAUDE.md`/the conversation had introduced it — it came from outside context I'd brought in, not from anything actually said. Genuinely useful catch: an undeclared external contract sneaking into reasoning unjustified is exactly the failure mode a real reviewer would flag. Resolved in Q12: this spec guarantees the outbox is a stable, single-writer-path artifact; the MCP server's own transport/tool contract is explicitly out of scope, deferred to its own spec.

## Defect → Spec table

| # | Defect / gap surfaced | Spec patch |
|---|---|---|
| 1 | Agent-test found: `outbox/` doesn't exist on a fresh checkout; AC6 didn't distinguish "missing directory" from "genuinely unwritable path" | Added explicit mkdir-p-on-write behavior; narrowed AC6 to mean a path that's unwritable even after directory creation (e.g. a file where a directory should be) |

## M2 — Plan Mode: v1 → intervention → v2

Plan Mode surfaced four real design questions before writing any code, rather than guessing silently — this is the interrogation working as intended, not a rubber stamp:

1. **Default-address lookups** (`getCustomerByEmail`'s shipping fields, `getCustomerProfile`'s address list, `searchCustomersByName`'s default city/state): the old code joined a nonexistent `shipping_addresses` table. Chose: filter by `type IN ('shipping','both') AND is_default = 1` for single-row shipping-labeled lookups (matches original intent), leave `getCustomerProfile`'s full address list unfiltered (it's a listing, not a lookup). Rejected: ignoring `type` entirely (real risk of returning a billing default where shipping was meant).
2. **Segment expiry** (`findCustomersBySegment` joined a nonexistent `segments` table; real `customer_segments` has `expires_at`): chose to exclude expired memberships (`expires_at IS NULL OR expires_at > now`) — an expired segment tag shouldn't count as current membership. The old code had no expiry concept at all since it never actually ran.
3. **`getRecentOrders`'s 1:N segment field**: old code selected a flat `c.segment`; real segments are `customer_segments`, 1-to-many. Chose `GROUP_CONCAT(DISTINCT segment_name)` — reuses the exact pattern the same function already used for `product_categories`, rather than inventing a new "most recent" policy or silently dropping the field.
4. **Field renaming**: decided to rename to schema-accurate names (`id`, `created_at`, `unit_price`, etc.) with no backward-compatible aliasing layer, since nothing in the repo consumes these functions yet. **Execution drift caught post-hoc**: the decision was applied to `getOrderDetails`'s typed interface but initially left six untyped (`any[]`-returning) functions still leaking the old `order_id`/`customer_id` aliases — an inconsistency, not a deliberate scope narrowing. Caught by asking directly, fixed for all functions, and fixing it surfaced a second latent bug (`getOrderDetails`'s JS mapping still read `rows[0].order_id`, which would have broken the moment the alias changed) — caught immediately by the existing test suite rather than silently.

**Result**: `npm run typecheck && npm test` clean (16/16), `scratch/baseline.ts` returns `[]` instead of the original `SQLITE_ERROR`.

## M3 — Blocked-attempt transcript (G1 verdict #1)

First two attempts to trigger a block (asking the agent to put raw SQL in `main.ts`/`report.ts`) didn't actually test the hook — the agent voluntarily relocated the query to `src/queries/` before ever attempting the violating write, so `scope_guard.js` was never invoked. Had to explicitly instruct it not to work around the rule and attempt the literal violation. Once forced:

```
Tool call attempted:
Edit(src/main.ts):
  new_string adds: const rawCount = await db.get("SELECT COUNT(*) FROM orders");

Hook output:
PreToolUse:Edit hook error: [node $CLAUDE_PROJECT_DIR/hooks/scope_guard.js]: Blocked: "src/main.ts" is outside
src/queries/ but its new content contains raw SQL (matched "SELECT").
Constitution §2 requires every SQL query to live in src/queries/. Allowed exceptions: src/schema.ts (DDL), and
tests/** or *.test.ts (test fixtures).

Result: the edit did not apply — src/main.ts is unchanged.
```

Lesson: "a hook you haven't seen block is a hook you haven't tested" is literal — a capable, rule-aware agent will self-correct around a violation before the hook ever fires, which looks like success but proves nothing about enforcement. Had to explicitly instruct it to attempt the disallowed action anyway to get real evidence.

Also observed (not a bug, a confirmed accepted tradeoff): the same run, the hook also false-positived on the plan file itself, blocking on the substring "insert" appearing in ordinary English prose ("...to insert the raw query line...") — confirms the guard is a keyword-substring scan, not SQL-aware, exactly as flagged when it was built.

## M3 — G1 five verdicts (all demonstrated live)

| # | Attempt | Verdict | Confirmed |
|---|---|---|---|
| 1 | Raw SQL in `src/main.ts` | BLOCK | Yes — required forcing the literal attempt (see transcript above) |
| 2 | Raw SQL in new `src/report.ts` | BLOCK | Yes — same forcing technique, hook fired before file write |
| 3 | Edit a `SELECT` inside `src/queries/order_queries.ts` | allow | Yes |
| 4 | Edit `src/schema.ts` (DDL comment) | allow | Yes |
| 5 | Test seeding via raw `INSERT INTO orders` in `tests/queries/order_queries.test.ts` | allow | Yes — `tests/**` exemption holds in practice, not just in the hook's error-message text |

## M3 — G2 (stop-gate) and G3 (audit trail)

Same lesson as G1 applied again: `green_gate.js`/`audit_log.js` were first verified only synthetically (`echo '...' | node hooks/green_gate.js` run directly in Bash) — that proves the script's logic, not that the real Stop-event wiring actually intercepts a live turn. Forced a genuine live test instead:

- Introduced a real type mismatch (`getOrderDetails` declared `Promise<number>` while its body still returned `OrderDetails | null`) and explicitly told the agent not to fix it before trying to end its turn.
- Real result: `Stop hook error: ... green_gate: npm run typecheck && npm test is red — fix the failures before stopping`, with the actual `tsc` error output attached. The turn did not end. The agent then fixed the mismatch and typecheck/tests went green (16/16) before it could stop.
- `stop_hook_active` guard verified separately (synthetic: `echo '{"stop_hook_active": true}' | node hooks/green_gate.js` → exit 0 immediately, confirming no infinite-loop risk).
- `audit_log.js` (G3) confirmed appending real tool-call entries from the live session to `.claude/hook-log.jsonl` in order, without truncating previous entries — avoids the `jq . > post-log.json` overwrite bug present in the shipped `.claude/settings.example.json`.
- `.claude/hook-log.jsonl` correctly gitignored (confirmed via `git status`, not tracked).

**M3 status: done.** CLAUDE.md repaired, all three hooks (scope guard, stop-gate, audit trail) built, wired into `.claude/settings.json`, and verified live — not just synthetically.

## M4 — Implement the feature + MCP server (to build live)

This is where the 2-hour live session picks up. M1's spec (`specs/stale-order-alerts/spec.md`, v1.2) and constitution already fully specify the feature — implement it against that spec through Plan Mode, then build the MCP server. Fill in as you go:

- Plan v1 → intervention → v2 for the implementation:
- Defect → Spec table (row 2, if a gap surfaces):
- End-to-end verification (seed → alert:check → list_sent_alerts → alert:check again → prove no duplicates):
- Failure drill result:

## Steering failures

(carry forward from M1-M3 if applicable, add any new ones from M4)

## Closing reflection

(fill in at the end of the live session)
