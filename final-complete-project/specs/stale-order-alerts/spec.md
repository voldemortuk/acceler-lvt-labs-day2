# Spec: Stale Pending Order Alerts

**Version 1.2** — see [Changelog](#7-changelog)

## 1. Context

`main.ts` runs once daily as a cron job and today only calls `createSchema`. This feature adds a second, separate daily check: find orders stuck in `status = 'pending'` for more than 3 days and surface them so someone follows up, per the PRD ([task.md](../../task.md)). Per [constitution.md](../../constitution.md) §3, this is orchestration (query → format → deliver), not a query-layer change — it lives in its own entry point, not inside `main.ts`/`createSchema`, and never turns any module under `src/queries/` into something with side effects.

## 2. Scope

- A new entry point (`src/alert-check.ts`, via `npm run alert:check`), separate from `main.ts`/schema creation — independent cron processes, so one's failure can't affect the other's exit code.
- A new query, `findStalePendingOrders(db, thresholdDays = 3, now)` in `order_queries.ts`, using `orders.created_at` as a proxy for "entered pending" — no status-transition history exists, so a re-entered `pending` order is measured from its original `created_at` (accepted approximation).
- Scope is exactly `status = 'pending'`; `processing` is excluded — a stuck `processing` order (something's acting on it) is a different failure mode than an unacknowledged `pending` order (nothing has), and not this feature.
- `order_queries.ts` and `customer_queries.ts` are repaired in place to reconcile to `schema.ts`'s actual columns/tables (`o.id` not `order_id`, `o.created_at` not `order_date`, `c.id` not `customer_id`, address data via the `addresses` FK not flat columns on `orders`, segments via `customer_segments` not `c.segment`), including fixing the already-broken `getPendingOrders`. Other query modules with the same drift are untouched — see Non-goals.
- Delivery is a local, append-only outbox file (`outbox/alerts.jsonl`, overridable via `ALERT_OUTBOX`), standing in for a real `#order-alerts` Slack post (see Non-goals). `outbox.ts` creates its parent directory if missing before writing, so a fresh checkout doesn't fail on first run.
- Exactly one delivery/dedupe entry point (`src/alerts/outbox.ts`) every caller goes through — no second dedupe implementation, now or later.
- One outbox entry per stale order (no batched digest); an order re-alerts once per UTC calendar day while stale (daily nag until resolved), deduped on `(order_id, calendar_day)` by reading the outbox before writing. No escalation tiers.
- Name/phone are masked by default per [constitution.md](../../constitution.md) §5 (name → first name + last initial; phone → last 4 digits); `order_id`/`customer_id` are always included, unmasked, for internal lookup. `ALERT_INCLUDE_PII=true` opts into raw name/phone.

### 2.1 Outbox line shape

Each outbox line is one JSON object with exactly these fields:

| field | type | notes |
|---|---|---|
| `order_id` | number | `orders.id` |
| `customer_id` | number | `customers.id`; always raw, never masked |
| `customer_name` | string | masked unless `ALERT_INCLUDE_PII=true` |
| `customer_phone` | string | masked, or `"unknown"` if NULL; unless `ALERT_INCLUDE_PII=true` |
| `channel` | string | always `"#order-alerts"` |
| `calendar_day` | string | UTC `YYYY-MM-DD` this alert is for — stored explicitly as the dedupe key's second half, never derived from a timestamp at read time |

## 3. Acceptance criteria

- [ ] AC1 — A `pending` order with `created_at` more than 3 days before the run's `now` produces exactly one outbox line containing `order_id`, `customer_id`, masked `customer_name`, masked `customer_phone`, and `channel: "#order-alerts"` (full line shape: §2.1).
- [ ] AC2 — A `pending` order with `created_at` less than 3 days before `now` produces no outbox entry.
- [ ] AC3 — A `processing` order of any age produces no outbox entry.
- [ ] AC4 (idempotency) — Running `alert-check` twice against the same `now` for an already-alerted stale order writes zero additional lines — the count for that `(order_id, day)` stays at 1.
- [ ] AC5 — The same order, still `pending` on a later UTC calendar day, produces a new outbox entry for that new day (re-alert, not alert-once).
- [ ] AC6 (failure path) — `outbox.ts` creates the outbox file's parent directory if missing, so a missing directory alone is never a failure. When `ALERT_OUTBOX` remains unwritable even after that (e.g. a path component is itself a file, or a read-only filesystem), `alert-check` exits 1, emits one structured error log line, and the outbox's prior byte content is unchanged (no partial writes).
- [ ] AC7 (failure path) — A stale order whose `customer_id` has no matching `customers` row is logged with an "error" outcome and skipped; other valid stale orders in the same run still get delivered; the process exits non-zero at the end of the run.
- [ ] AC8 — A stale order whose customer has `phone = NULL` still produces a normal outbox entry (phone rendered as "unknown" or omitted) rather than throwing.
- [ ] AC9 — With `ALERT_INCLUDE_PII` unset or `false`, every outbox entry's name/phone are masked; with `ALERT_INCLUDE_PII=true`, raw name/phone are written instead.
- [ ] AC10 (clock injection) — Two runs of `alert-check` given the same fixed clock value produce identical output — the same orders alert, each landing on the same `calendar_day` — regardless of each run's real wall-clock time.
- [ ] AC11 — Running `npm start` (`main.ts`) does not write to the outbox and does not invoke `alert-check` — schema creation stays isolated from alerting.

## 4. Constraints

- Query modules stay pure reads (constitution §3); all SQL is parameterized (constitution §2); `schema.ts` is untouched (constitution §1).
- Dedupe key is `(order_id, calendar_day)` in **UTC**, not local time — accepted since no authoritative timezone exists in this feature's inputs. The clock value is computed once per run and threaded through both the staleness filter and the dedupe-key computation, so the two can't disagree across a UTC midnight boundary.
- The outbox is JSONL (line shape: §2.1) — a stable, machine-parseable format with two readers: the CLI's own read-before-write dedupe check, and (out of scope, see Non-goals) a future MCP tool for listing sent alerts.
- No `--confirm`/dry-run guard on local runs: default-on PII masking plus per-`(order_id, day)` idempotency already make a stray local run against real data safe to leave lying around.
- No performance constraint beyond an assumed upper bound of 500 stale orders per run; revisit if that assumption changes.

## 5. Non-goals

- Real Slack API delivery — no Slack credential or SDK dependency exists in this repo today; a named stretch goal, not built in this pass.
- Escalation tiers or severity levels for orders stale beyond 3 days — daily nag at a flat severity is the entire model.
- Alert-once semantics — explicitly rejected in favor of daily re-alert until resolved.
- Detecting staleness for `status = 'processing'` — a different failure mode; a separate feature if ever needed.
- Reconciling any query module other than `order_queries.ts`/`customer_queries.ts` to `schema.ts` — same drift exists elsewhere, out of scope, its own blast radius.
- Per-team/local timezone support for the dedupe key — UTC only, no configuration surface.
- The MCP server itself (transport, tool schemas, registration) — this spec only guarantees the outbox is a stable artifact a future read-only consumer could use.
- A batched/digest alert message — one entry per stale order was chosen instead.
- Detecting or handling an order that left and re-entered `pending` — no status-transition history exists in this schema release; `created_at` is an accepted proxy, this gap is not solved.

## 6. Definition of done

- All acceptance criteria (AC1–AC11) pass automated tests, including the failure-path (AC6, AC7) and idempotency (AC4) cases, using injected clock values rather than wall-clock time.
- `npm run typecheck` and `npm test` both exit 0 (constitution §4). No lint gate — no linter is configured in this repo.
- `order_queries.ts` and `customer_queries.ts` contain no remaining references to columns/tables absent from `schema.ts`.
- The outbox line shape (§2.1) is documented in code comments or a short README note near `src/alerts/outbox.ts`, since it is a contract a future consumer depends on.
- Telemetry: every processed stale order emits one structured log line with `outcome` ∈ {`sent`, `skipped-duplicate`, `error`}, plus `order_id` and `calendar_day`; `error` lines additionally include a `reason`.
- No changes to `schema.ts`; no PII appears unmasked in any outbox entry produced without `ALERT_INCLUDE_PII=true`.

## 7. Changelog

- **v1.2** (2026-07-19) — Replaced the "small" performance adjective in Constraints with a quantified assumed upper bound (500 stale orders/run), per the spec-quality checklist's "numbers, not adjectives" requirement.
- **v1.2** (2026-07-19) — This spec runs ~2.3–2.75 pages against the checklist's one-page target. Left as-is: every remaining sentence maps to an explicit decision from the M1 interview, and cutting further would mean dropping a decision, not trimming prose.
- **v1.1** (2026-07-19) — Linked `task.md` as PRD; reworded AC10 to behavior, not signature; added `customer_id` to AC1; pinned outbox line shape (§2.1); added no-performance-constraint, no-lint-gate, and telemetry decisions; added outbox-directory auto-create + redefined AC6; tightened Non-goals/Constraints prose.
