# Flawed Plan — Find the Three Planted Defects

> The plan below was produced by an agent in plan mode against the bootcamp repo. It looks reasonable. It contains **at least three deliberate defects** — find them using the [plan-review checklist](plan-review-checklist.md). There may be additional issues a careful reviewer would also flag; mark anything you can defend.
>
> Do not run this plan. Read it.

---

## Task

> "Add a dead-letter queue for webhooks that have failed past their max retries. Failed deliveries should land in a `webhook_dead_letters` table, be visible in the admin UI, and be re-deliverable from there."

## Proposed plan

### 1. Schema change

- Create a new table `webhook_dead_letters` with columns:
  - `id` (uuid, pk)
  - `original_event_id` (uuid)
  - `subscription_id` (uuid)
  - `payload` (jsonb)
  - `last_error` (text)
  - `attempts` (int)
  - `created_at` (timestamptz, default now())
- Add a Prisma model `WebhookDeadLetter` matching the table.

### 2. Code changes

- In `src/services/webhook-delivery.ts`, after `RetryPolicy.shouldRetry()` returns `false`, insert a row into `webhook_dead_letters`.
- In `src/api/admin/dead-letters.ts`, add `GET /admin/dead-letters` and `POST /admin/dead-letters/:id/replay`.
- In `web/admin/src/pages/DeadLetters.tsx`, add a table view and a "Replay" button per row.

### 3. Replay behavior

- `POST /admin/dead-letters/:id/replay` reads the dead-letter row, enqueues a fresh delivery job for it, and deletes the dead-letter row on successful enqueue.

### 4. Tests

- Unit test: `RetryPolicy.shouldRetry()` triggers the dead-letter path on the final attempt.
- API test: `GET /admin/dead-letters` returns paged results.

### 5. Rollout

- Ship behind feature flag `webhooks.dead_letter_queue`.

---

## When you think you've found them

Write the defects in your [worksheet](worksheet.md). Be specific: cite the section number and what is wrong. Aim for the three planted issues; bonus credit for anything else you'd block on in a real review.
