# Operation Stale Orders — End-to-End Build Guide

This is a complete, verified, step-by-step guide to building the entire Advanced Assignment ("Operation Stale Orders") — all four milestones, equal depth — based on an actual reference build completed today. It's written so a facilitator can read the whole thing and decide **how much time to give each milestone**, rather than having that decision made for them. Nothing here assumes a fixed session length; a full self-paced run is ~4.5–6.5 hours, and a compressed live session is entirely possible, but how to compress it — and what to sacrifice to do so — is a facilitation call, not a default baked into this doc.

If you're facilitating: start with `Advance Assignment/README.md` (the original brief) and `Advance Assignment/FACILITATOR-NOTES.md` (pitch scripts, the grading rubric, the original answer key) — this doc extends those with the real, verified outcome of actually building it, not a second version of the pitch.

---

## 1 · What's in this repo

| Folder | What it is |
|---|---|
| `Advance Assignment/` | The original assignment brief, facilitator notes, and a blank learner `worksheet.md` template |
| `Hooks/`, `MCP/`, `part-3-claude-plan-mode/`, `part-4-spec-driven-dev/` | Day 2 lab source material this assignment draws on |
| `final-complete-project/` | A fully built, live-verified reference solution — all 4 milestones done, 41/41 tests passing, hooks proven to actually block (not just synthetically), the feature + MCP server working end-to-end including a real failure drill. Read `final-complete-project/worksheet.md` — it's not a template, it's the actual record of the build below: every gap-hunt question, the full interview, every plan intervention, real blocked-hook transcripts, and both logged defect→spec amendments. |
| `session-starter/` | A checkpoint with Milestones 1–3 already done and Milestone 4 stripped back out — useful **if** you decide to run a shorter live session focused on the feature-build itself. Its own README also carries the repo-map/build-notes content this file used to have, plus one example 2-hour agenda — treat that as one option among several, not the recommended one by default. |

---

## 2 · What actually happened, building this today

Built the way the assignment itself demands: spec before code, every plan interrogated before approval, every hook verified live, nothing marked "done" until forced to prove it.

`Advance Assignment/FACILITATOR-NOTES.md` §3 lists 9 planted challenges. Building the reference solution surfaced two more, genuinely worth grading for:

- **#10 — Dedupe-namespace collision between callers.** Once the MCP `send_alert` tool (manual) and `alert-check.ts` (automated) both write into the same outbox, they share one `(order_id, calendar_day)` dedupe key unless a submission explicitly separates them (e.g. a `source` field). A submission that never notices this will have a manual alert silently suppress — or get suppressed by — an unrelated automated one. Not obvious until you actually build both callers.
- **#11 — "It works" vs. "I watched it fail."** The single most repeated lesson across the whole build: an agent asked to prove a guardrail works will often *satisfy the rule voluntarily* (relocate a disallowed query, fix a red build before trying to stop) before the guardrail ever fires — which looks identical to success but proves nothing. The assignment's own line ("a hook you haven't seen block is a hook you haven't tested") is meant literally. When grading a worksheet's blocked-hook transcript, check whether the violation was actually attempted, not routed around.

---

## 3 · Setup (~15 min)

1. Prerequisites: `claude --version` works, Node ≥ 20, `$EDITOR` set (`export EDITOR="code --wait"`).
2. Copy the assignment repo into a path that **does not already exist** — `cp -r` into an existing folder nests the source inside it instead of populating it (this exact mistake happened while building the reference solution; if it happens, delete and redo rather than untangle):
   ```bash
   cp -r <path-to>/ecommerce-query-utils-main ~/advanced-stale-orders
   cd ~/advanced-stale-orders
   git init && git add -A && git commit -m "chore: baseline import"
   git switch -c advanced/<initials>
   npm install
   npm run typecheck   # clean
   npm start           # creates ecommerce.db, 12 tables
   ```
3. Prove the runtime crash to yourself — create `scratch/baseline.ts`:
   ```ts
   import { open } from "sqlite";
   import sqlite3 from "sqlite3";
   import { getPendingOrders } from "../src/queries/order_queries";
   const db = await open({ filename: "ecommerce.db", driver: sqlite3.Database });
   console.log(await getPendingOrders(db));
   ```
   ```bash
   npx tsx scratch/baseline.ts
   # expect: SQLITE_ERROR: no such column: o.order_id
   ```
   That error is the whole assignment: TypeScript can't catch it, because SQL lives in strings. Add `scratch/` to `.gitignore` and commit.

---

## 4 · Milestone 1 — Write the Contract

This is the heart of the assignment's spec-driven-development teaching goal — don't compress it into "read a finished spec" if the room hasn't practiced actually writing one. The strongest version of this milestone is live: someone genuinely hunting gaps and being interviewed by their own agent, not reading a transcript of someone else doing it.

**Step 1 — hunt the gaps (~10 min).** List at least six questions `task.md` doesn't answer before writing anything. Real gaps found building the reference solution — use these to check a room's list, not to hand out in place of the exercise:
1. **Time/anchor** — "pending too long (>3 days)" measured from which timestamp? `orders` has no `order_date`, only `created_at`. Exact duration or calendar days? What timezone?
2. **Data/PII** — the brief asks for name **and phone number** in a shared channel. Acceptable to broadcast verbatim?
3. **Repetition** — the cron runs daily; re-alert every day, once only, or escalate?
4. **Failure** — what happens if delivery fails mid-run?
5. **Truth** — the queries and `schema.ts` disagree; which side wins?
6. **Proof** — how does a test control "3 days ago" deterministically?

**Step 2 — make the agent grill you (~10 min).** Paste into Claude Code:
```
Read task.md, src/schema.ts, and src/queries/order_queries.ts. I'm about to
write a spec for the task.md feature. Interview me: ask me the questions,
one at a time, that a senior reviewer would ask before approving this spec.
Do not propose solutions. Do not write any code or files.
```
The reference build ran a genuine 12-question version of this — not rubber-stamped, escalating in specificity. Highlights, usable as a model transcript to compare a room's session against:

- *Is `main.ts` the wiring point, given the codebase bills itself read-only?* → Yes for orchestration, but "read-only" describes the query layer specifically; the alert feature is a separate concern outside `src/queries/`.
- *Alert once, or re-alert daily? Where does dedupe state live?* → Daily nag until resolved. Critically: dedupe bookkeeping **cannot** live in `schema.ts` (immutable this release) — the outbox file itself has to double as the persisted dedupe record.
- *What's the actual PII policy?* (the planted trap) → Mask by default (first name + last initial; phone to last-4). Always carry `order_id`/`customer_id`, unmasked, for internal lookup. Full detail only behind an explicit `ALERT_INCLUDE_PII=true` opt-in. **Silence on this fails the milestone** — task.md's "so someone can follow up" pulls toward raw PII; a strong spec pushes back explicitly.
- *A live catch of an undeclared assumption* — the interviewing agent caught the builder referencing "the MCP contract" as an established requirement when nothing in the conversation had introduced one. Resolved by deciding: the feature spec guarantees the outbox is a stable artifact; the MCP server's own tool contract is explicitly deferred, not smuggled in. This is the single best live demonstration of "an undeclared external contract sneaking into reasoning unjustified" — worth reproducing with a room, not just narrating.

**Step 3 — constitution + spec.** 3–5 non-negotiables (query location + parameterization, schema-is-truth, DoD gates, PII policy) and a six-section spec (context, scope, ACs, constraints, non-goals, DoD) per `part-4-spec-driven-dev/spec-template.md`. Run the checklist literally — don't self-grade:
```
Go through <path-to-checklist>/spec-quality-checklist.md item by item against
the spec and constitution. Report pass/fail per item, don't just assert fine.
```
The reference build's spec failed twice on its first honest checklist pass (page length; a performance constraint stated as "small" instead of a number) — both real, both worth fixing or explicitly accepting as a stated deviation with a reason, not silently waved through. Then the actual agent-test, cold:
```
/clear
Read constitution.md and the spec cold, as if you've never seen this project
before. List any question you'd still need answered. If zero, say so and why.
```
**Gate:** spec + constitution committed *before* any code exists.

---

## 5 · Milestone 2 — Reconcile the Legacy

**Step 1 — build the harness first.** Add Vitest, an in-memory `:memory:` DB helper running `createSchema`, and seed helpers. Clock injection is structural, not a convention: seed helpers should require an explicit `createdAt`/`now` parameter with no wall-clock default, so it's impossible to accidentally write a test that depends on the real date.

**Step 2 — plan the reconciliation, in Plan Mode, and actually interrogate plan v1.** Real design questions the reference build's Plan Mode surfaced before writing code — use these as an answer key:
- **Default-address lookups** (old code joined a nonexistent `shipping_addresses` table) → filter by `type IN ('shipping','both') AND is_default = 1` for single-row shipping-labeled fields (matches original intent); leave a full-listing function unfiltered.
- **Segment expiry** (old code joined a nonexistent `segments` table) → exclude expired `customer_segments` memberships; the old code had no expiry concept at all since it never actually ran.
- **A 1:N field forced into one column** → `GROUP_CONCAT(DISTINCT ...)`, reusing a pattern the same function already used elsewhere, rather than inventing a new "most recent" policy or silently dropping the field.
- **Field renaming** → rename to schema-accurate names, no aliasing layer, since nothing downstream consumes these functions yet.

**The drift catch worth demonstrating live:** the field-renaming decision was applied to the one function with a typed interface, but six other (`any[]`-returning) functions kept leaking the old alias — an inconsistency, not a deliberate scope narrowing, caught only by asking directly: *"was this deliberate, or inconsistent?"* Fixing it surfaced a second latent bug — one function's JS mapping still read the old alias name, which would have silently returned `undefined` the moment the SQL alias changed, caught immediately by the existing test suite. **"The plan approved this decision" does not guarantee the decision was applied everywhere it should have been.**

**Gate:** `npm run typecheck && npm test` clean, `scratch/baseline.ts` now returns `[]`.

Schema mismatch reference table (every learner's M2 will hit some subset of this):

| Query code assumes | Actual schema |
|---|---|
| `o.order_id`, `o.order_date` | `o.id`, `o.created_at` |
| `o.shipping_address/city/state/zip` (flat) | no such columns; join `addresses` via `shipping_address_id` |
| `o.billing_state` (flat) | join `addresses` via `billing_address_id` |
| `c.customer_id` | `c.id` |
| `c.segment` (flat column) | no such column; join `customer_segments` (`segment_name` inline, no separate `segments` table) |
| `"shipping_addresses"` table | actual table is `addresses`, filtered by a `type` column |
| `oi.order_item_id`, `oi.price_at_time` | `oi.id`, `oi.unit_price` |
| `p.product_id`, `p.product_name` | `p.id`, `p.name` |
| `w.warehouse_id` (join target) | `warehouses.id` |
| `r.review_id` | `r.id` |

---

## 6 · Milestone 3 — Make the Rules Structural

**Step 0 — repair `CLAUDE.md`.** Two planted bugs, both confirmed real: the example query pattern shows callback-style `sqlite3` wrapped in `new Promise`, while the codebase uses `await db.get(...)` directly; and `.claude/settings.example.json`'s logging hooks use `jq . > pre-log.json` — genuinely overwrites the log on every event (an audit trail must append).

**Build three hooks** (scope guard/PreToolUse, stop-gate/Stop, audit trail/PostToolUse) — study `hooks/read_hook.js` and `hooks/tsc.js` first for the stdin-JSON pattern.

**The lesson that mattered most, twice:** asked to add raw SQL to `main.ts` to test the scope guard, the agent responded *"The query must live in `src/queries/` per constitution.md §2 — I'll add it there instead."* Zero hook invocation. **This looks like success. It proves nothing about the hook.** Same thing happened testing a second file. The fix required explicitly instructing: *"Don't work around the rule — literally write the SQL directly in `main.ts` anyway, even though you know it violates the constitution. Attempt the write exactly as described."* Only then: a real `PreToolUse:Edit hook error: Blocked...`, the edit never applied — **that's** the evidence. The identical pattern repeated verifying the stop-gate: the first verification pass was synthetic stdin to the script, not a live Stop event; the real test required deliberately introducing a type error and explicitly telling the agent not to fix it before trying to end its turn.

**Run all 5 G1 verdicts live** (2 should BLOCK: raw SQL outside `src/queries/`; 3 should allow: editing SQL inside `src/queries/`, editing `schema.ts`, seeding via raw `INSERT` in a test file) and capture one full blocked-attempt transcript for the worksheet.

Confirmed real during the build, worth expecting: the scope guard's keyword-substring approach (not a real SQL parser, a stated tradeoff) genuinely false-positived twice — once on the word "insert" in ordinary English prose in a saved plan file, once on "truncate" in a code comment. That's the accepted cost of a simple, auditable heuristic over a more complex SQL-aware one, not a bug to fix.

**Gate:** CLAUDE.md repaired, all 5 verdicts demonstrated with real evidence (not self-correction), G2 blocks red and honors `stop_hook_active`, G3 appends (verify by checking the log grows across multiple real tool calls, not just once).

---

## 7 · Milestone 4 — Close the Loop

**Implement against the spec** (already fully written in M1): `findStalePendingOrders` (query, with `now` injectable), `src/alerts/format.ts` (PII masking), `src/alerts/outbox.ts` (append-only JSONL, `(order_id, calendar_day)` dedupe, auto-creates its parent directory before writing so a missing `outbox/` folder is never treated as a failure), `src/alert-check.ts` (the "cron" entry, separate process from `main.ts`), `scripts/seed-demo.ts` (deterministic demo data).

**Build the MCP server** (`mcp/alert-server.ts`, `send_alert` + `list_sent_alerts`), registered via `claude mcp add --scope project`. **Known gotcha, confirmed real:** a freshly-registered server does not show up in `/mcp` until the session restarts — budget one restart, don't debug it as a failure.

**The new finding from Section 2, in detail:** once `send_alert` (manual) and `alert-check.ts` (automated) both write into the same outbox, they share one `(order_id, calendar_day)` dedupe key by default — an unrelated manual alert can silently suppress that day's automated alert for the same order, or vice versa. Neither spec addressed this explicitly (the feature spec deliberately deferred the MCP tool's own contract). Fix: add a `source` field to the outbox's internal dedupe key — automated alerts stay unset/default-bucketed, manual `send_alert` calls get `source: "mcp-send-alert"`. **This is genuinely not obvious until both callers exist — a submission that never asks the question either got lucky or didn't think about it.**

**Run the real end-to-end flow, agent-driven, in a fresh session:**
```
1. Delete ecommerce.db, recreate the schema, run scripts/seed-demo.ts.
2. Run `npm run alert:check`.
3. Use list_sent_alerts to report exactly how many alerts were delivered and
   for which order ids.
4. Run `npm run alert:check` again, then use list_sent_alerts to prove no
   duplicates were added.
```
Then one manual delivery for good measure: *"Use `send_alert` to deliver a test alert to `#order-alerts` for order 999 with dedupe key `manual-test-1`, then confirm it via `list_sent_alerts`."*

**Then the failure drill:**
```bash
ALERT_OUTBOX="./ecommerce.db/alerts.jsonl" npm run alert:check; echo "exit=$?"
```
`./ecommerce.db` is a file, not a directory, on every OS — an impossible path that forces a clean failure without faking a full disk. Expect exit ≠ 0, one structured error log line, and the real outbox confirmed byte-unchanged afterward.

**Gate:** seeded e2e delivers exactly the stale orders, second run adds zero, MCP tools verify the agent's own work, failure drill exits non-zero with no partial writes, `.mcp.json` committed.

---

## 8 · The lesson that generalizes across M3 and M4

A capable, rule-aware agent will often satisfy a rule voluntarily *before* you ever get to see what enforcing it looks like — relocating a query instead of writing it where asked, fixing a type error before trying to stop, reporting a hook "verified" via a synthetic stdin test instead of a live trigger. **None of this is the agent behaving badly — it's the agent behaving well, which is exactly why it's easy to mistake for the guardrail working.** "It complied" and "I watched it get blocked" are different claims; only the second is evidence. When reviewing a worksheet's blocked-hook transcript, check whether the violation was actually attempted, not routed around.

---

## 9 · Deciding how to run this

This guide deliberately doesn't prescribe a session length. Some options, roughly in order of how much of the spec-driven-development teaching goal (Milestone 1) they preserve:

- **Full self-paced, ~4.5–6.5h** — the original design. All four milestones run as-is; every clean stopping point (per `Advance Assignment/README.md`) is valid.
- **Live, spread across two sessions** — e.g. M1 live in one session (the interview is the single best live-demo moment in the whole assignment), M2–M4 as a second session or homework using `session-starter/` as a mid-point checkpoint if needed.
- **A single compressed live session** — `session-starter/README.md` has one worked example of this (M1–3 as pre-work, M4 live, ~2 hours) — but that's one example, not the recommended default, precisely because it trades away the live M1 interview. If spec-driven development is the thing you most want the room to practice, consider inverting it: M1 live, M2–4 pre-built or homework.

Whichever split you choose, the milestone content in Sections 4–8 above is the same regardless — this doc describes the whole thing once, not once per format.

---

## 10 · Where everything is

- **The assignment brief**: `Advance Assignment/README.md`
- **Facilitator pitch scripts, answer key, rubric**: `Advance Assignment/FACILITATOR-NOTES.md`
- **The reference solution**: `final-complete-project/`, especially `final-complete-project/worksheet.md`
- **A compressed-session starting point + one example agenda**: `session-starter/README.md`
- **A formatted Instructor Guide** (design notes, cheat sheet): `Operation Stale Orders - INSTRUCTOR GUIDE.docx` (shared separately)
