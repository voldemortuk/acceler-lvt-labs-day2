# PRD — Reliable Webhook Delivery with Idempotent Retries

**Status:** Draft (intentionally — your spec is the gap layer).
**Owner:** Platform team.
**Audience:** Internal engineers and subscribing customers.

## Problem

Subscribing customers report two failure modes:

1. **Silent drops:** when their endpoint returns a transient 5xx during a deploy, we deliver once and give up. They lose the event.
2. **Duplicate processing:** when their endpoint times out *after* successfully processing the event, our retry causes duplicate side effects on their side.

We need delivery that retries transient failures **and** lets subscribers safely deduplicate.

## Users

- **Subscribing customers** receiving webhooks at an HTTPS endpoint they control.
- **Internal engineers** triaging delivery failures from the admin UI.

## Goals

- Webhooks that fail with a transient error are retried automatically with backoff.
- Subscribers can deterministically detect and ignore a duplicate delivery of the same logical event.
- Operators can see the retry history of any delivery.

## Non-goals

- Guaranteeing exactly-once delivery end to end (impossible without subscriber cooperation).
- Real-time webhooks (sub-second delivery).
- Per-subscriber retry policies (one policy for all subscribers, this release).

## High-level requirements

- Retries occur for transient failures (network errors, timeouts, 5xx).
- Retries do **not** occur for permanent failures (4xx other than 408/429).
- Each delivery carries a stable identifier that lets the subscriber detect duplicates.
- The retry schedule respects sane bounds (it does not retry forever).
- Operators can view the per-delivery history in the existing admin UI.

## Open questions (deliberately left)

> The PRD does not specify these on purpose. Your spec must answer them.

- What exactly counts as "transient"?
- What is the backoff curve?
- What is the maximum total time we will keep retrying before declaring the delivery dead?
- Where does the idempotency identifier come from, and what header is it sent in?
- What happens after the last retry fails?
- How do we behave when the subscriber endpoint is consistently unreachable for hours?

## Constraints

- Must run on the existing BullMQ infrastructure.
- Must not require schema changes that block on a long backfill.
- Must be observable through the existing structured-logging setup (`pino`, `request_id`, `subscription_id`).

## Acceptance signals (from a customer's view)

- A subscriber that returns 503 once will see the event re-delivered shortly after.
- A subscriber that returns 200 to the first delivery will not see the same event twice.
- A subscriber that is offline for several minutes will, when it comes back, receive the event(s) that retried during the outage.
