# Operation Stale Orders — Reference Build + 2-Hour Live Session Guide

This README is the entry point added on top of the existing `Advance Assignment/` materials, after building a complete, verified, end-to-end reference solution to the Advanced Assignment ("Operation Stale Orders") and adapting it into a format an instructor can run **live, in two hours**, instead of only as ~4.5–6.5h self-paced homework.

If you're facilitating this: start here, then go to `Advance Assignment/FACILITATOR-NOTES.md` for pitch scripts, the grading rubric, and the original answer key — this doc extends that one, it doesn't replace it.

---

## 1 · What's in this repo now

| Folder | What it is | Status |
|---|---|---|
| `Advance Assignment/` | The original assignment brief (`README.md`), facilitator notes, and a blank learner `worksheet.md` template | Pre-existing |
| `Hooks/`, `MCP/`, `part-3-claude-plan-mode/`, `part-4-spec-driven-dev/` | Day 2 lab source material this assignment draws on | Pre-existing |
| **`final-complete-project/`** | **A fully built, live-verified reference solution** — all 4 milestones done, 41/41 tests passing, hooks proven to actually block (not just synthetically), the feature + MCP server working end-to-end including a real failure drill | **New** |
| **`session-starter/`** | **The 2-hour live-session starting point** — Milestones 1–3 already done (constitution, spec, reconciled queries with tests, all three hooks), Milestone 4 stripped out for the live session to build | **New** |

`final-complete-project/worksheet.md` is the fullest artifact here — it's not a template, it's the actual, honest record of a real build: every gap-hunt question, the full 12-question spec interview, every plan-v1 intervention, real blocked-hook transcripts (including the ones that turned out *not* to prove anything the first time), both logged defect→spec amendments, and a closing reflection. Read it before you facilitate — it's the single best preparation for anticipating where learners will get stuck.

---

## 2 · What actually happened, building this today

The reference solution was built the way the assignment itself demands: spec before code, every plan interrogated before approval, every hook verified live, nothing marked "done" until forced to prove it. A few concrete numbers:

- **M1**: a genuine 12-question adversarial interview (not a rubber-stamped one) surfaced the PII policy, the re-alert/dedupe model, the schema-truth boundary, and — a good teaching moment — a case where the interviewing agent caught the *builder* smuggling in an undeclared assumption (referencing "the MCP contract" before anything had established one existed). The spec went through two full quality-checklist passes and two amendments (versioned v1.0 → v1.1 → v1.2) before being called done.
- **M2**: `order_queries.ts` and `customer_queries.ts` fully reconciled to `schema.ts`, with Plan Mode surfacing four real design questions (address-type filtering, segment-expiry semantics, a 1:N field needing a `GROUP_CONCAT` decision, and a field-renaming choice) before any code was written — plus one execution-drift catch: the field-renaming decision was applied inconsistently across functions until asked about directly.
- **M3**: all three hooks (scope guard, stop-gate, audit trail) built and — critically — verified **live**, not just by feeding synthetic stdin to the scripts. The first two attempts to prove the scope guard blocks a violation didn't actually test anything, because the agent voluntarily relocated the query before the hook ever fired. Only forcing the literal violation produced a real block. Same pattern repeated for the stop-gate.
- **M4**: the feature (`findStalePendingOrders` → PII-masked `format.ts` → deduped `outbox.ts` → `alert-check.ts`) plus an `alert-mcp` MCP server (`send_alert`, `list_sent_alerts`), verified with a real seeded end-to-end run (2 stale orders alerted, fresh/shipped correctly excluded, a second run proving zero duplicates, a manual MCP delivery, and a failure drill with confirmed no-partial-writes).

### New findings worth folding into the existing answer key

`Advance Assignment/FACILITATOR-NOTES.md` §3 lists 9 planted challenges. Building the reference solution surfaced two more, genuinely worth grading for:

- **#10 — Dedupe-namespace collision between callers.** Once `send_alert` (MCP, manual) and `alert-check.ts` (automated) both write into the same outbox, they share one `(order_id, calendar_day)` dedupe key unless a submission explicitly separates them (e.g. a `source` field). A submission that never notices this will have a manual alert silently suppress — or get suppressed by — an unrelated automated one. Not obvious until you actually build both callers; a strong submission catches it, most won't.
- **#11 — "It works" vs. "I watched it fail."** The single most repeated lesson across M3 and M4 today: an agent asked to prove a guardrail works will often *satisfy the rule voluntarily* (relocate the query, fix the type error) before the guardrail ever fires — which looks identical to success but proves nothing. The assignment's own line ("a hook you haven't seen block is a hook you haven't tested") is meant literally. When grading a worksheet's blocked-hook transcript, check whether the violation was actually attempted, not routed around.

---

## 3 · Running this live, in 2 hours

The original design is self-paced homework sized at 4.5–6.5 hours. A live, instructor-driven 2-hour session can't rebuild all four milestones from scratch — so the format below front-loads M1–M3 as pre-work / pre-embedded material, and spends the live time on M4, the most demonstrable and novel milestone (the feature + an agent-built MCP server verifying its own work).

### Pre-work (before the session — ~20–30 min, async)

Send learners `session-starter/` and have them, individually, before the session:
1. Copy `session-starter/` to their own working directory, `npm install`, confirm `npm run typecheck && npm test` are clean (16 tests should pass).
2. Read `constitution.md`, `specs/stale-order-alerts/spec.md`, and `worksheet.md` in that folder — these represent Milestones 1–3, already done, so they walk in already oriented rather than cold.
3. Skim the three hooks in `hooks/` and how they're wired in `.claude/settings.json`.

This means the live session opens with everyone already past the "why does this repo crash at runtime" discovery and the spec-writing slog — which is real time saved, but also real context worth narrating briefly at the start (see agenda below), since skipping straight to M4 without feeling M1–M3's weight undersells why the discipline matters.

### Live 2-hour agenda

| Time | Segment | What happens |
|---|---|---|
| 0:00–0:15 | **Orient** | Walk through what M1–M3 already did *for* them (constitution, spec, hooks) — show `final-complete-project/worksheet.md`'s M1 interview and the M3 blocked-hook transcripts as a "here's what fighting for this looked like" narrative, so the pre-work doesn't feel like it was skipped, it was inherited. |
| 0:15–0:20 | **Confirm environment** | Everyone's `session-starter/` copy: `npm run typecheck && npm test` green, hooks visible via `/hooks`. Fix any stragglers fast. |
| 0:20–0:55 | **Build the feature (M4, part 1)** | Plan Mode against `specs/stale-order-alerts/spec.md` v1.2: `findStalePendingOrders`, `src/alerts/format.ts`, `src/alerts/outbox.ts`, `src/alert-check.ts`. Push for real Plan Mode interrogation, not rubber-stamping — the spec's already thorough, so this should move faster than the original 90–120 min budget. If a group falls behind, `final-complete-project/src/` is the answer key to unblock from, not to copy wholesale. |
| 0:55–1:25 | **Build the MCP server (M4, part 2)** | `mcp/alert-server.ts` (`send_alert`, `list_sent_alerts`), registered via `claude mcp add --scope project`. **Known gotcha** (hit today, budget time for it): a freshly-added `.mcp.json` server does not show up in `/mcp` until the session restarts — plan for one restart here, don't burn 10 minutes debugging a phantom failure. |
| 1:25–1:45 | **End-to-end + failure drill** | Fresh session, agent-driven: seed demo data, run `alert:check` twice (prove idempotency via `list_sent_alerts`), one manual `send_alert` call, then the failure drill (`ALERT_OUTBOX="./ecommerce.db/alerts.jsonl" npm run alert:check`). This is the payoff moment — the whole spec-first chain either holds together live or it doesn't. |
| 1:45–2:00 | **Debrief** | Each learner/pair names one moment they had to force an agent to actually fail (per finding #11 above) and fills in `worksheet.md`'s closing reflection. Push branches. |

### If the room runs long

Same principle as the original design: **every stopping point is a valid stopping point.** If a group is still mid-feature at 1:25, skip straight to a shortened failure-drill demo using `final-complete-project`'s already-working version, and let them finish M4 async afterward using it as a reference — don't let the live clock turn "learning spec discipline" into "watching an instructor type."

---

## 4 · Where everything is

- **The assignment brief**: `Advance Assignment/README.md`
- **Facilitator pitch scripts, answer key, rubric**: `Advance Assignment/FACILITATOR-NOTES.md`
- **The reference solution** (read this to see exactly what "done" looks like): `final-complete-project/`, especially `final-complete-project/worksheet.md`
- **The 2-hour session starting point**: `session-starter/`
- **A formatted Instructor Guide** (design notes, run-of-show, cheat sheet): `Operation Stale Orders - INSTRUCTOR GUIDE.docx` (shared separately, updated alongside this README)
