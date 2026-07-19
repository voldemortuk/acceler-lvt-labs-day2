# Flawed Plan — Facilitator Answer Key

**Facilitator only. Do not distribute or reveal before minute 18 of Part B.** Learners work from [flawed-plan.md](flawed-plan.md); their findings go in their [worksheet](worksheet.md).

## Defect 1 — Missing database migration

The plan creates a Prisma model but never mentions running `prisma migrate dev` or committing the generated migration. The schema only exists in the model file; the actual table is never created. This is "wrong files / missing steps" on the checklist.

## Defect 2 — Wrong file path

`src/services/webhook-delivery.ts` does not exist in the bootcamp repo. The delivery code lives in `src/services/webhook/delivery.ts`. An agent that pattern-matched on a plausible-sounding path will produce code in the wrong place — or worse, create the wrong file alongside the real one.

## Defect 3 — Unstated assumption about ordering and idempotency in replay

Step 3 reads the dead-letter row, enqueues a job, and **deletes the row on successful enqueue**. Two unstated assumptions:

1. If the replay itself fails (5xx from subscriber), the row is already gone — the dead letter is lost.
2. If the admin double-clicks "Replay," two jobs are enqueued for the same dead letter with no idempotency key.

A correct plan either keeps the row until the replay succeeds, or makes the replay idempotent.

## Bonus issue (worth raising in debrief)

The plan never says whether `payload` is encrypted at rest. Acceptable to leave on the table for Day 3's security pass.

## How to reveal

At minute 18, walk the three defects in this order: **wrong file path (Defect 2) → missing migration (Defect 1) → replay idempotency (Defect 3)**. The wrong-file-path is the hook — it's the most visceral for engineers. Land: *the plan is where you catch this. In a code review you'd have to run the diff first.*

## Common finds you should credit

- Missing `authorization` check on `POST /admin/dead-letters/:id/replay` (real gap; not one of the planted three).
- No mention of what happens to the dead-letter row if the replay job stalls in the queue.
- No index on `webhook_dead_letters` (`created_at` or `subscription_id` will get queried in the admin UI).
- No pagination on `GET /admin/dead-letters`.

Credit these even though they aren't the planted defects — they're the review instinct we're trying to build.
