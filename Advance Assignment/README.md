# Advanced Assignment — Operation Stale Orders

**Optional · Self-paced · ~4.5–6.5 hours across four milestones · For learners already fluent with Claude Code**

> **Is this for you?** If the Day 2 demos felt like revision — you already live in Claude Code, you've shipped with it, and you wanted the black-diamond run — this is it. It is entirely optional. Nothing in Days 3–4 depends on it. Every milestone ends at a clean stopping point, so even completing Milestone 1 alone is a finished, valuable exercise.
>
> **Not sure?** Do the standard Day 2 labs first. This assignment assumes you're comfortable with everything in them.

---

## 00 · The Mission

Six months ago, someone filed a three-sentence feature request in [`task.md`](../Hooks/ecommerce-query-utils-main/task.md) — *"alert the team on Slack when orders have been pending too long"* — and never shipped it. Since then, the repo has drifted: the query modules were written against a schema that no longer matches what `schema.ts` actually builds, so **many of the ~45 query functions crash at runtime**. The README admits this under *Known Limitations*. Even `CLAUDE.md` has gone stale and now misleads the agent.

You've just inherited it.

**Your mission:** ship the stale-order alert feature to a production standard — with one constraint that changes everything:

> **You are the only human on this project. There is no reviewer.**
> The agent does the typing. Your **spec**, your **plans**, and your **hooks** are the review.

By the end, this must be true:

```
┌───────────┐  creates   ┌──────────────┐        ┌────────────────────┐
│ schema.ts │──────────▶ │ ecommerce.db │◀─seed──│ scripts/seed-demo  │
└───────────┘            └──────┬───────┘        └────────────────────┘
                                │
              npm run alert:check (the "cron")
                                │
                                ▼
              src/queries/order_queries.ts  ← reconciled & tested (M2)
                                │  stale pending orders
                                ▼
              src/alerts/format.ts          ← your PII policy applied (M1)
                                ▼
              src/alerts/outbox.ts ───────▶ outbox/alerts.jsonl
                                ▲                    ▲
                                │                    │ verifies via
              Claude Code ── MCP tools ── mcp/alert-server.ts   (M4)
                   ▲
                   └── every edit policed by your hooks (M3)
```

Run it twice → **no duplicate alerts**. Break the outbox → **clean failure, exit ≠ 0, no partial writes**. Ask the agent to put a query in the wrong file → **your hook blocks it**. That's the bar.

### How this maps to Day 2

| Milestone | What you build | Day 2 part exercised |
|---|---|---|
| **M1 — Write the Contract** | Constitution + spec from a vague brief | Part 4 · Spec-Driven Development |
| **M2 — Reconcile the Legacy** | Schema↔query reconciliation + test harness | Part 3 · Plan Mode |
| **M3 — Make the Rules Structural** | Three guardrail hooks + CLAUDE.md repair | Part 2 · Hooks |
| **M4 — Close the Loop** | The feature + your own MCP server, end to end | Part 2 · MCP + Part 4 · the full SDD cycle |
| *(throughout)* | The Rules of Engagement below | Part 1 · the skill-formation study, applied |

---

## 01 · Rules of Engagement

These apply for the whole assignment. They are not ceremony — they are the high-scorer interaction patterns from the study on Slide 13, made mandatory.

1. **The agent types; you steer.** No hand-edited source files. If you're ever forced to edit by hand, log it in the [worksheet](worksheet.md) under *Steering Failures* — each one is a prompt or guardrail you failed to write, and the most instructive artifact you'll produce.
2. **Spec before code.** When a gap surfaces mid-build: **patch the spec → re-plan → re-run.** Never silently patch the code. (You'll log these in the defect-to-spec table.)
3. **The one-sentence rule.** Any change you can't describe in a single sentence, or that touches 2+ files, goes through Plan Mode. Plans live in `./plans/` and get committed.
4. **Green means green.** `npm run typecheck` and (from M2 onward) `npm test` pass before every commit. From M3 onward, your own hook enforces this.
5. **Commit at least once per milestone** on branch `advanced/<your-initials>`, with messages that say *why*.
6. **Time-box:** stuck for more than 15 minutes on the same error → jump to [§08 · If You Get Stuck](#08--if-you-get-stuck).

---

## 02 · Setup (15 min — do this first)

### Prerequisites

- [ ] Claude Code installed and authenticated — `claude --version` works, and `/status` inside a session shows you logged in.
- [ ] Node.js ≥ 20 — `node --version`.
- [ ] The Day 2 labs repo cloned locally (this folder's parent).
- [ ] `$EDITOR` set, so `Ctrl+G` can open plans — e.g. `export EDITOR="code --wait"` (bash/zsh) or `$env:EDITOR = "code --wait"` (PowerShell).

### Create your own working repo

You'll be making commits, so work on **your own copy** of the project — not inside the shared labs repo.

```bash
# macOS / Linux — from the folder where you cloned the labs repo
cp -r accelerXlvt-labs/lvt-day2-code-demo/Hooks/ecommerce-query-utils-main ~/advanced-stale-orders
cd ~/advanced-stale-orders
```

```powershell
# Windows PowerShell — from the folder where you cloned the labs repo
Copy-Item -Recurse .\accelerXlvt-labs\lvt-day2-code-demo\Hooks\ecommerce-query-utils-main $HOME\advanced-stale-orders
cd $HOME\advanced-stale-orders
```

Then, on any OS:

```bash
git init
git add -A
git commit -m "chore: baseline import of ecommerce-query-utils"
git switch -c advanced/<your-initials>

npm install
npm run typecheck     # expect: clean, zero errors
npm start             # expect: creates ./ecommerce.db with 12 tables
```

> **Where will this push?** This is your own repo now, so give it a remote: create an empty repository under your personal GitHub account (any name, private is fine), then `git remote add origin <url>`. That's where your `advanced/<initials>` branch goes at submission time. If your environment doesn't allow pushing to an external remote, skip this — §09 has a zip-based alternative.

### See the problem with your own eyes

The repo *type-checks clean* and *crashes at runtime*. Prove it. Save this as `scratch/baseline.ts`:

```ts
import { open } from "sqlite";
import sqlite3 from "sqlite3";
import { getPendingOrders } from "../src/queries/order_queries";

const db = await open({ filename: "ecommerce.db", driver: sqlite3.Database });
console.log(await getPendingOrders(db));
```

Run it:

```bash
npx tsx scratch/baseline.ts
```

**Expected:** an `SQLITE_ERROR` — *no such column* (the query asks for `o.order_id` and `o.order_date`; the real table has `id` and `created_at`). If you see an empty array instead, you're pointing at a stale `ecommerce.db` — delete it and re-run `npm start`.

That error is the whole assignment. TypeScript can't catch it, because SQL lives in strings. Only a **spec, a test harness, and guardrails** can. Add `scratch/` to `.gitignore` and commit the setup.

> **Two versions of the truth.** The queries describe one schema; `schema.ts` builds another. Which one wins? Read `src/main.ts`: the deployed "cron" runs `main.ts`, which builds the `schema.ts` schema. **The deployed schema is immutable this release.** So: `schema.ts` is the source of truth, and the *queries* must change — not the schema. Your constitution (M1) should make this rule explicit, because a helpful agent will happily "fix" the mismatch from whichever side needs fewer edits.

---

## 03 · Milestone 1 — Write the Contract *(SDD · 60–75 min)*

Vibe coding this feature takes 20 minutes and produces exactly what the last engineer produced: nothing shippable. You're going to spend those 20 minutes on the spec instead — and then the build becomes almost boring.

**Inputs:** [`task.md`](../Hooks/ecommerce-query-utils-main/task.md) (your entire "PRD" — read it now, it's three sentences) · the [spec template](../part-4-spec-driven-dev/spec-template.md) · the [spec-quality checklist](../part-4-spec-driven-dev/spec-quality-checklist.md).

### Step 1 — Hunt the gaps *(10 min)*

List **at least six questions the brief does not answer** in your [worksheet](worksheet.md). Don't read further until you have six. Categories to probe if you stall: *time* (what does "pending too long — more than 3 days" mean precisely, and against which timestamp? calendar days or 72 hours? whose timezone?) · *data* (what exactly goes in the alert — and should it?) · *repetition* (the job runs daily; what happens to an order that stays pending for a week?) · *failure* (what if delivery fails mid-run?) · *truth* (which schema wins — did you catch the note in §02?) · *proof* (how will a test control "3 days ago"?).

### Step 2 — Make the agent grill you *(10 min)*

Open Claude Code in your repo and paste:

```
Read task.md, src/schema.ts, and src/queries/order_queries.ts. I'm about to
write a spec for the task.md feature. Interview me: ask me the questions,
one at a time, that a senior reviewer would ask before approving this spec.
Do not propose solutions. Do not write any code or files.
```

Answer honestly. Capture, in the worksheet, **the three questions that most changed your thinking**. (This is the "grill me" session from Slide 49 — most people skip it; that's why their specs have holes.)

### Step 3 — Write the constitution *(10 min)*

Have the agent draft `constitution.md` (repo root) with **3–5 non-negotiables** — hard rules every future change must obey, not preferences. It must at minimum cover:

- Where queries may live (`src/queries/` only), and that all SQL is parameterized.
- That `schema.ts` is the source of truth this release — reconcile queries *to* it, never the reverse.
- The gates that must be green before the agent may consider any task done.
- **An explicit PII policy for outbound alert payloads** (see the trap below).

### Step 4 — Write the spec *(20 min)*

Create `specs/stale-order-alerts/spec.md` using the six-section template. Two assignment-specific constraints your spec must state:

- Delivery target for this assignment is a **local outbox file** (`outbox/alerts.jsonl`), not real Slack — deterministic, offline, and testable. (Real Slack is stretch goal S2.)
- The check must be runnable as `npm run alert:check`, and **the outbox path must be overridable via an `ALERT_OUTBOX` environment variable** — you'll need that for the failure drill in M4.

Every acceptance criterion must be *testable observable behavior*, and at least one must cover the **failure path** and one the **repeat-run (idempotency) path**.

> ⚠️ **The planted trap.** `task.md` asks for the customer's **name and phone number** in a shared alert channel. That's PII in a broadcast medium. Strong engineers notice; agents, left alone, do not — they'll ship it verbatim. Your spec must **take an explicit position**: mask it, include it with a stated justification, or gate it behind config. Any defensible position passes. **Silence fails.** (This is the flawed-plan checklist's *"what is the plan assuming you haven't said?"* — for real this time.)

### Step 5 — Gate and commit

- [ ] Every box in the [spec-quality checklist](../part-4-spec-driven-dev/spec-quality-checklist.md) checked — including the *agent test*.
- [ ] Run the agent test literally: ask Claude to read the spec and list any question it would still need answered. Zero material questions = pass. Patch and re-run otherwise.
- [ ] `git add specs constitution.md && git commit -m "docs: constitution + stale-order-alerts spec (pre-implementation)"` — **the spec commits before any code exists.**

**✅ M1 done when:** six+ gaps logged · grill-me captured · constitution committed · spec committed and passing the agent test. *Clean exit point — you can stop here and have done a complete SDD exercise.*

---

## 04 · Milestone 2 — Reconcile the Legacy *(Plan Mode · 75–90 min)*

Your feature needs `orders` and `customers` queries that actually run. **Scope discipline:** reconcile only `src/queries/order_queries.ts` and `src/queries/customer_queries.ts` against `schema.ts`, with tests. The other six modules are stretch goal S1 — resist the cleanup itch; your own plan-review checklist calls that scope drift.

### Step 1 — Build the harness first *(20 min)*

A reconciliation without tests is a guess. Drive this through Plan Mode (it touches 3+ files):

- Add **Vitest**; set `"test": "vitest run"` in `package.json` (so `npm test` works non-interactively).
- Create a test helper that opens an **in-memory** database (`filename: ":memory:"`) and runs `createSchema(db)` — every test runs against the *real* schema, which is the entire point.
- A seeding helper for fixtures. **Design decision your spec/tests must handle:** "pending more than 3 days" depends on *now*. Either inject a clock (`now` parameter) or seed `created_at` values computed relative to `Date.now()` — your tests must never depend on the wall clock or the calendar day they're run.

Gate: one trivial test green (e.g., schema creates and `orders` is queryable) before proceeding.

### Step 2 — Plan the reconciliation *(20 min)*

Enter Plan Mode (**Shift+Tab twice**, or `/plan`). Paste:

```
Reconcile src/queries/order_queries.ts and src/queries/customer_queries.ts
with the schema that src/schema.ts actually creates. Constraints, per
constitution.md: schema.ts is the source of truth and must not change;
all queries stay in src/queries/ and stay parameterized. Read schema.ts
and both query modules first, produce a complete list of every mismatch
you find (table names, column names, primary keys, references to tables
that don't exist), then ask me your questions before writing a plan.
Every reconciled function must gain at least one integration test against
an in-memory DB built by createSchema, interleaved with the fix — not
batched at the end.
```

**Do not approve plan v1.** Interrogate it with the [plan-review checklist](../part-3-claude-plan-mode/plan-review-checklist.md). Things a first plan classically gets wrong here — catch at least one and intervene (Ctrl+G to annotate):

- It proposes touching `schema.ts` "to add the missing tables" → constitution violation, strike it.
- It batches all tests into a final step → demand interleaving.
- It "fixes" `findCustomersBySegment` by inventing a `segments` table → the schema has `customer_segments.segment_name` inline; the query must adapt.
- It handles the two files in one mega-step → split per module so drift is visible.

Record **plan v1 → your intervention → plan v2** in the worksheet. If the agent planned without asking a single question, it read the files but didn't reason — re-prompt: *"Before planning, list every file you read and one open question about each."*

### Step 3 — Execute and watch for drift *(30 min)*

Approve. Watch for the three drift signals (editing a file the step doesn't name · silently deciding something the plan left open · merging steps). On drift: **Shift+Tab back into Plan Mode** and re-plan the remainder — log the drift in the worksheet.

### Step 4 — Green gate

```bash
npm run typecheck && npm test
npx tsx scratch/baseline.ts    # the M0 crash — now expect: []
```

- [ ] Every function in both modules has ≥ 1 integration test; stale-order-relevant paths have an **empty-result** case and a **seeded-result** case.
- [ ] `getPendingOrders` returns `[]` instead of throwing.
- [ ] Commit: `fix(queries): reconcile orders+customers modules to schema.ts, with integration harness`.

**✅ M2 done when:** harness green · both modules reconciled with tests · plan v1/intervention/v2 logged · baseline script no longer crashes. *Clean exit point.*

---

## 05 · Milestone 3 — Make the Rules Structural *(Hooks · 60–75 min)*

You now have rules (constitution) and proof (tests). But rules the agent *reads* are suggestions; rules that *fire* are law. You'll wire three guardrails — and because there's no reviewer on this project, they're not optional hardening. They **are** the reviewer.

**Reference implementations already in your repo:** `hooks/read_hook.js` (reading stdin JSON, blocking with exit 2) and `hooks/tsc.js` (PostToolUse gate). Study both before writing your own.

### Step 0 — Repair the harness docs *(10 min)*

Slide 49 warned about **doc rot**. Your `CLAUDE.md` has it: at least one code example in it contradicts how this codebase actually works and will steer the agent toward the wrong pattern. Find it, fix it, and while you're in there add what a fresh agent session actually needs: the schema-truth rule, the test commands, and the queries-directory rule stated as enforced-by-hook. *(Answer check: the stale example is the query pattern — it shows callback-style `sqlite3` wrapped in `new Promise`, while the entire codebase uses the promise wrapper's `await db.get(...)` directly.)*

### The three guardrails

You define the behavior below; the implementation is yours. All hooks read a JSON event on **stdin** (fields you'll need: `tool_name`, `tool_input.file_path`, and the incoming text — `tool_input.content` for Write, `tool_input.new_string` for Edit, and each `tool_input.edits[].new_string` for MultiEdit); **exit 0** allows, **exit 2** blocks with stderr fed back to the agent.

**G1 — Scope Guard** *(PreToolUse · matcher `Write|Edit|MultiEdit`)*
Enforces "queries live in `src/queries/`" structurally. Minimum behavioral contract — your implementation must pass all five:

| # | Attempt (ask Claude to do this) | Verdict |
|---|---|---|
| 1 | Add a `SELECT COUNT(*) FROM orders` helper to `src/main.ts` | **BLOCK** |
| 2 | Create `src/report.ts` containing `db.all("SELECT * FROM customers")` | **BLOCK** |
| 3 | Edit a `SELECT` inside `src/queries/order_queries.ts` | allow |
| 4 | Edit `src/schema.ts` (DDL: `CREATE TABLE`) | allow |
| 5 | Write a test that seeds with `INSERT INTO orders ...` | allow |

Raw `SELECT`s inside test files are **your call** — decide it in your constitution, implement what you decided, and note the decision in the worksheet.

**G2 — Green Gate** *(Stop · no matcher)*
When the agent tries to finish its turn, run `npm run typecheck && npm test`. Red → **exit 2** with the failure tail on stderr, so the agent must keep fixing instead of yielding with broken code. Two production details that separate advanced from copy-paste:

- The Stop event's stdin JSON includes **`stop_hook_active`** — when it's `true`, a Stop hook already blocked once this turn. Your hook must then **exit 0**, or you've built an infinite loop.
- Give the hook entry a generous `"timeout"` (e.g. 300) — the suite must be allowed to finish.

**G3 — Audit Trail** *(PostToolUse · matcher `*`)*
Append one JSON line per tool call — `{ts, tool_name, file}` — to `.claude/hook-log.jsonl`, and gitignore the log. One more piece of planted doc rot: the shipped `.claude/settings.example.json` has a logging "hook" that is subtly broken as an audit trail. Find the bug and make sure yours doesn't have it. *(Answer check: it redirects with `>` — every event **overwrites** the log. An audit trail appends.)*

### Wiring

Project hooks that your whole team would inherit belong in **`.claude/settings.json`** (committed), using `$CLAUDE_PROJECT_DIR` so paths survive any working directory. Skeleton:

```json
{
  "plansDirectory": "./plans",
  "hooks": {
    "PreToolUse": [
      { "matcher": "Write|Edit|MultiEdit",
        "hooks": [ { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/hooks/scope_guard.js\"" } ] }
    ],
    "PostToolUse": [
      { "matcher": "*",
        "hooks": [ { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/hooks/audit_log.js\"" } ] }
    ],
    "Stop": [
      { "hooks": [ { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/hooks/green_gate.js\"", "timeout": 300 } ] }
    ]
  }
}
```

Keep any personal experiments in `settings.local.json` (`npm run setup` regenerates it) — the split between *shared law* and *personal preference* is itself part of the lesson. Restart your Claude Code session after editing settings, and use `/hooks` to confirm registration.

### Prove it

Run attempts 1–5 from the G1 table live. Then introduce a deliberate type error via the agent and try to end the turn — G2 must refuse to let it stop until green. Paste **one blocked-attempt transcript** (the hook's stderr and the agent's reaction) into the worksheet. A hook you haven't seen block is a hook you haven't tested.

- [ ] Commit: `feat(hooks): scope guard, stop-gate, audit trail as project settings` (+ the CLAUDE.md repair).

**✅ M3 done when:** CLAUDE.md repaired · all five G1 verdicts demonstrated · G2 blocks red and honors `stop_hook_active` · G3 appends (never overwrites) · evidence in worksheet. *Clean exit point.*

---

## 06 · Milestone 4 — Close the Loop *(MCP + full SDD cycle · 90–120 min)*

Everything converges: build the feature **against your spec**, deliver it through **an MCP server you write**, and let the agent run the whole operation end to end — the Slide 23 choreography, except every instrument on stage is yours.

### Step 1 — Implement the feature *(Plan Mode · ~35 min)*

Point the agent at `specs/stale-order-alerts/spec.md` and plan the implementation. Expected shape (your spec may reasonably differ):

- `src/queries/order_queries.ts` → `findStalePendingOrders(db, olderThanDays, now?)` — in the queries dir (G1 is watching), parameterized, tested.
- `src/alerts/format.ts` → builds the alert message **with your PII policy applied**. Unit-tested: the test proves the policy (e.g., masked phone stays masked).
- `src/alerts/outbox.ts` → appends JSONL to `outbox/alerts.jsonl` (path overridable via `ALERT_OUTBOX`), and implements your **dedupe decision** — a re-run must not re-alert the same order for the same day. Where dedupe lives (checked in the delivery layer vs. enforced by the server in Step 2) is a design decision your spec must state and your tests must prove.
- `src/alert-check.ts` + `"alert:check": "tsx src/alert-check.ts"` script — the "cron" entry: query → format → deliver, with a structured log line per outcome, **exit 0** on success, **exit ≠ 0** on delivery failure *without partial writes*.
- `scripts/seed-demo.ts` — seeds a small deterministic dataset: at least 2 stale pending orders (created 4+ and 10+ days ago, relative to now), 1 fresh pending order, 1 shipped order. This is your demo stage.

Mid-build, when a spec gap surfaces (it will): **spec first, then code** — and log the pair in the worksheet's defect-to-spec table (you need ≥ 2 rows by the end; finding fewer usually means you weren't looking).

### Step 2 — Build `alert-mcp` *(~30 min)*

Write `mcp/alert-server.ts` — a **stdio** MCP server. Crib the structure from the labs' worked example: [`../MCP/cli_project_COMPLETE/src/mcpServer.ts`](../MCP/cli_project_COMPLETE/src/mcpServer.ts) (McpServer + StdioServerTransport + zod). Dependencies: `@modelcontextprotocol/sdk` and `zod`.

Required surface:

- **Tool `send_alert`** — input `{ channel, order_id, dedupe_key, summary, body }` → appends to the same outbox (reuse `src/alerts/outbox.ts`; one delivery module, two callers) → returns a confirmation. Must respect the dedupe contract from your spec.
- **Tool `list_sent_alerts`** — input `{ channel? }` → returns the delivered alerts from the outbox, so the *agent can verify its own work*.
- **Stretch:** also expose the outbox as an MCP **resource** (`alerts://outbox`).

Register it **project-scoped** so it lives in a committed `.mcp.json`:

```bash
claude mcp add --scope project alert-mcp -- npx tsx mcp/alert-server.ts
```

> CLI flags have shifted across Claude Code versions — if that form is rejected, check `claude mcp add --help`. Verify with `/mcp` inside a session: `alert-mcp` should show as connected, exposing two tools.

### Step 3 — The end-to-end run *(~15 min)*

Fresh Claude Code session (so hooks + MCP all load). Paste:

```
Run the stale-order alert operation end to end and verify your own work:
1. Delete ecommerce.db, recreate the schema, and run scripts/seed-demo.ts.
2. Run `npm run alert:check`.
3. Use the alert-mcp list_sent_alerts tool to report exactly how many
   alerts were delivered and for which order ids.
4. Run `npm run alert:check` again, then use list_sent_alerts to prove
   no duplicates were added.
Report what you did and what the outbox proves, step by step.
```

Watch what's happening: the agent orchestrates Bash and **your** MCP tools, verifies against **your** outbox, under **your** hooks, against **your** spec. Capture the run summary + outbox lines in the worksheet. Then one manual delivery for good measure: *"Use send_alert to deliver a test alert to #order-alerts for order 999 with dedupe key manual-test-1, then confirm it via list_sent_alerts."*

### Step 4 — The failure drill *(~10 min)*

Your spec promised a clean failure path. Prove it — `ALERT_OUTBOX` pointed *inside a file* is an impossible path on every OS:

```bash
# bash/zsh
ALERT_OUTBOX="./ecommerce.db/alerts.jsonl" npm run alert:check; echo "exit=$?"
```
```powershell
# PowerShell
$env:ALERT_OUTBOX = ".\ecommerce.db\alerts.jsonl"; npm run alert:check; "exit=$LASTEXITCODE"; Remove-Item Env:ALERT_OUTBOX
```

- [ ] Exit code ≠ 0 · one structured error log line · the real outbox unchanged (no partial writes).

### Step 5 — Close the paperwork

- [ ] Defect-to-spec table has ≥ 2 rows; spec version bumped with a one-line changelog per amendment.
- [ ] Final commit + **push the branch**: `feat(alerts): stale-order alert pipeline with alert-mcp delivery, per spec v1.x`.

**✅ M4 done when:** seeded e2e run delivers the right alerts · second run proves dedupe · failure drill passes · MCP server committed with `.mcp.json` · spec and trace table current · branch pushed.

---

## 07 · Stretch Goals *(optional, any order)*

- **S1 — Full reconciliation.** Reconcile one more query module (suggested: `analytics_queries.ts` — it hides an N+1) with tests. Plan Mode, obviously.
- **S2 — Real Slack.** Behind an env flag (`SLACK_WEBHOOK_URL`), deliver to a real incoming webhook. The URL never touches git; extend a hook to block any write containing `hooks.slack.com`.
- **S3 — The AI reviewer.** `hooks/query_hook.js` ships with a duplicate-query reviewer powered by the Agent SDK — **deliberately disarmed**. Find the single line that disarms it, remove it, wire it in, and demo it catching a duplicate query. (Heads-up: it spawns a Claude call per edit — it costs tokens and needs auth.)
- **S4 — Spec Kit rematch.** Rebuild *just* the M4 feature greenfield with the [`/speckit-*` pipeline](../part-4-spec-driven-dev/demo/README.md) in a scratch directory. Diff Spec Kit's generated spec against your handwritten one — write three sentences on what each caught that the other missed.
- **S5 — Session brief.** A `SessionStart` hook that prints the current spec version, last plan file, and test status — so every fresh session starts oriented.

---

## 08 · If You Get Stuck

**Escalation ladder:** (1) re-read the relevant spec/plan section — most defects trace upstream · (2) ask the agent to *explain* its last change and which spec line it satisfies — explanation-seeking is the high-scorer move · (3) 15+ minutes stuck → post in the cohort WhatsApp group with your branch pushed, the milestone number, and the exact error.

| Symptom | Likely cause | Fix |
|---|---|---|
| Shift+Tab does nothing | Terminal intercepts it | Type `/plan` instead |
| `Ctrl+G` opens nothing | `$EDITOR` unset | Set it (see §02), restart the session |
| Baseline script returns `[]` at M0 | Stale `ecommerce.db` from an earlier run | Delete the file, `npm start`, re-run |
| `sqlite3` fails to install | Missing native toolchain | Xcode CLT (macOS) / `build-essential` + `python3` (Linux); re-run `npm install` |
| Vitest can't parse TS/ESM | Missing config | Ensure `"test": "vitest run"`, and let the agent add a minimal `vitest.config.ts` |
| Hook never fires | Settings not loaded / wrong file | Restart the session; check `/hooks`; confirm it's in `.claude/settings.json`, valid JSON |
| Hook blocks *everything* | Guard logic too broad | Log the stdin JSON to the audit trail and inspect what the hook actually received |
| Agent stuck in a stop-block loop | G2 ignores `stop_hook_active` | Exit 0 when `stop_hook_active` is `true` |
| `claude mcp add` rejects flags | CLI version drift | `claude mcp add --help`; labs MCP guide covers the forms |
| `/mcp` shows server failed | Server crashes on boot | Run `npx tsx mcp/alert-server.ts` directly — it should start silently and wait on stdio; fix any thrown error |
| Tests pass locally, agent claims red (or vice versa) | Wall-clock-dependent fixtures | Re-read the clock-injection requirement in M2 Step 1 |

---

## 09 · Definition of Done & Submission

**Master checklist**

- [ ] `constitution.md` + `specs/stale-order-alerts/spec.md` committed **before** implementation, spec version-bumped since
- [ ] `order_queries.ts` + `customer_queries.ts` reconciled to `schema.ts`, every function integration-tested against `createSchema` in-memory
- [ ] `scratch/baseline.ts` runs clean
- [ ] Three hooks live in committed `.claude/settings.json`; all five G1 verdicts demonstrated; G2 blocks red and honors `stop_hook_active`; G3 appends
- [ ] `CLAUDE.md` repaired
- [ ] `npm run alert:check` on the seeded demo delivers exactly the stale orders; second run adds zero; failure drill exits ≠ 0 with no partial writes
- [ ] `alert-mcp` committed with `.mcp.json`; agent-driven e2e run captured
- [ ] [Worksheet](worksheet.md) complete — including plan v1→v2, one blocked-hook transcript, defect-to-spec table (≥ 2 rows), steering failures (even if zero), and the closing reflection
- [ ] Branch `advanced/<initials>` **pushed**

**Submit:** push your branch to your remote (see §02), then drop the repo link plus **one insight** (a sentence: the thing that surprised you) in the cohort WhatsApp group before Day 4 — or as your facilitator directs. If you can't push externally, zip the project instead (exclude `node_modules/` and `ecommerce.db`) and share that the same way. Reviews are async; standout solutions get a spotlight in the wrap-up.

**Why there's no answer key:** you wrote it. It's called `spec.md`, and your tests are its enforcement. Two learners with different PII policies, different dedupe placements, and different guard strictness can *both* be fully correct — provided the spec says so and the tests prove it. That's the point of the whole day.
