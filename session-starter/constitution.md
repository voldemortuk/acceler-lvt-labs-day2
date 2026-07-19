# Constitution

Non-negotiable rules for this repository. A spec or implementation that conflicts with one of these must change the spec, not quietly violate the rule.

## §1 — schema.ts is the source of truth for this release

`schema.ts` defines the deployed, immutable shape of the database for this release. Code reconciles to `schema.ts` — never the reverse. No feature may alter `schema.ts` to suit its own convenience (e.g. adding a tracking column) without a separate, explicit migration decision outside the feature's own spec.

## §2 — All database queries live in `src/queries/`, and are always parameterized

Every SQL query in this codebase lives in `src/queries/`, one module per domain. Queries are always parameterized (`?` placeholders + a params array) — never string-concatenated, regardless of whether the interpolated value originates from a user, an external system, or code within this repository.

## §3 — Query modules are pure reads; side effects live elsewhere

Files under `src/queries/` perform reads only: no network calls, no file writes, no delivery of any kind. Any side-effecting behavior (sending alerts, writing to an outbox, calling an external API) is orchestration code that lives outside `src/queries/` and calls into query modules, never the other way around.

## §4 — Definition-of-done gates

No task is "done" until `npm run typecheck` and `npm test` both exit 0. This holds even while `npm test` is a stub — a task that requires new behavior must add real coverage for that behavior, not rely on the stub's exit code to pass by default. This repository has no linter configured; there is no lint gate in the definition of done unless a future decision adds one.

## §5 — PII policy for outbound alerts

Any code path that sends customer data outside this repository's own database (Slack, a local outbox, or any future delivery channel) masks customer PII by default: name reduces to first name + last initial; phone reduces to its last 4 digits. Raw, unmasked values may only be emitted behind an explicit, off-by-default opt-in flag — never as the default behavior of a new delivery path.
