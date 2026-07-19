# Facilitator Notes — Operation Stale Orders (Advanced Assignment)

**Facilitator only. Do not distribute.** Learners work from [README.md](README.md) and [worksheet.md](worksheet.md). This file holds the pitch scripts, the answer key to the planted challenges, the evaluation rubric, and the async-review protocol.

---

## 1 · Who this is for, and who it isn't

Built for the 3–4 learners who've used Claude Code in anger and found the Day 2 demos familiar. It is **not** remedial-plus — it assumes fluency with Plan Mode entry, hooks configuration, and MCP registration, and it deliberately withholds implementation code (behavior contracts only). A mid-level learner attempting it cold will burn time in M3; steer them to the standard labs first, and offer this as post-bootcamp homework instead.

Positioning matters: frame it as a **privilege track, not a punishment for finishing early**. "Optional black-diamond run" lands well; "extra homework" does not.

## 2 · Pitch scripts (pick your moment)

**After the Plan Mode demo** — to the learner who was visibly ahead:
> "You've clearly driven Plan Mode before. There's an advanced track in the labs repo — same repo you already have, but you inherit it as the *only* engineer: no reviewer, so your spec, plans, and hooks have to do the reviewing. Milestone 2 is a real legacy reconciliation that punishes an unreviewed plan. Totally optional, ~4–6 hours self-paced, clean exit after every milestone."

**After the SDD demo** — to the learner who asked the sharp spec question:
> "That question you just asked is Milestone 1 of the advanced track. The brief is three vague sentences with a planted trap most agents ship without blinking — your spec either catches it or it doesn't. Have a look at `advanced-assignment/` in the labs repo."

**To the whole cohort, end of day** (keeps the fast group from feeling singled out and gives everyone the option):
> "One last thing: for anyone who wants a harder run at today's material, there's an optional advanced assignment in the labs repo — one mission, four milestones, entirely self-paced with its own worksheet. No obligation, nothing on Days 3–4 depends on it, and every milestone is a clean stopping point. If you attempt it, push your branch and drop one insight in the WhatsApp group."

**WhatsApp follow-up message** (paste-ready, same evening):
> 🎯 *Optional advanced track for Day 2* — "Operation Stale Orders": inherit a drifted legacy repo, ship the unshipped feature to production standard with no human reviewer — spec-first, every change through Plan Mode, your own hooks as the review gate, delivery through an MCP server you build. 4 milestones, ~4.5–6.5 h total, stop cleanly after any of them. → `lvt-day2-code-demo/advanced-assignment/README.md`. Push branch `advanced/<initials>` + one insight here when done.

## 3 · Answer key — the planted challenges

Everything below is *discoverable* by a careful learner; nothing requires this file. Use it to grade fast and to run the debrief.

| # | Plant | Where | The answer / what "caught it" looks like |
|---|---|---|---|
| 1 | **PII in a broadcast channel** | `task.md` asks for customer name **and phone** in `#order-alerts` | Spec takes an explicit position (mask / justify / config-gate). Any defensible position passes; **silence fails**. Weak submissions ship the phone number verbatim with no AC covering it. |
| 2 | **Two versions of schema truth** | Queries vs `schema.ts` | Constitution states `schema.ts` wins *because `main.ts` (the deployed cron) builds it*. Watch for agents "fixing" by adding `shipping_addresses`/`segments` tables to the schema — a learner who let that through didn't review the plan. |
| 3 | **Doc rot in CLAUDE.md** | The query-pattern example | Example shows callback-style `sqlite3` wrapped in `new Promise`; the codebase uses the promise wrapper (`await db.get/all`). Fixed CLAUDE.md should also gain schema-truth + test commands. |
| 4 | **Disarmed AI-reviewer hook** (stretch S3) | `hooks/query_hook.js` | `process.exit(0);` is the **first line of `main()`** — the whole reviewer is dead code. Removing it arms an Agent-SDK-powered duplicate-query reviewer. Warn: costs tokens, needs auth. |
| 5 | **Broken audit trail** | `.claude/settings.example.json` | The logging hooks redirect with `>` — each event **overwrites** `pre-log.json`/`post-log.json`. An audit trail appends (`>>` / append-mode write), and the log should be gitignored. |
| 6 | **Stop-hook infinite loop** | G2 design | Correct hooks exit 0 when stdin's `stop_hook_active` is `true`. A learner whose agent got stuck in a block loop and *then fixed it* has learned it better than one who never hit it — credit the worksheet story either way. |
| 7 | **Wall-clock-dependent tests** | "pending > 3 days" | Tests must inject `now` or seed `created_at` relative to `Date.now()`. A suite that passes today and fails after the weekend = missed. |
| 8 | **Replay/dedupe** (the flawed-plan lesson, live) | Daily re-runs | Second `alert:check` run must add zero alerts. Dedupe placement (delivery layer vs MCP server) is a free design choice **if** the spec states it and a test proves it. |
| 9 | **Scope drift bait** | Six other broken query modules | The disciplined answer reconciles only orders+customers (M2 scope) and leaves the rest for S1. "While we're here" full-repo cleanups = drift; note it in review. |

## 4 · Evaluation rubric (~15 min per submission)

Review order: worksheet first, then spec, then code. The worksheet tells you in five minutes whether the code is worth fifteen.

| Area | Meets bar | Excellence markers |
|---|---|---|
| **Spec (M1)** | 6 sections, testable ACs incl. failure + repeat-run, PII position stated, committed pre-code | Constitution rules phrased as enforceable; spec changelog shows real amendments; grill-me answers visibly shaped ACs |
| **Plan discipline (M2)** | Plan v1 + ≥1 real intervention + v2 in worksheet; schema.ts untouched; tests interleaved | Intervention cites the checklist item; drift caught and re-planned; mismatch inventory shows insight, not inventory |
| **Harness (M2)** | Vitest green vs in-memory `createSchema`; empty + seeded cases; baseline script clean | Clock injection done cleanly; helpers reusable; tests readable as spec restatements |
| **Hooks (M3)** | All 5 G1 verdicts demonstrated; G2 blocks red + honors `stop_hook_active`; G3 appends; committed `settings.json` with `$CLAUDE_PROJECT_DIR` | Blocked-attempt transcript shows the agent *recovering* usefully; raw-SELECT-in-tests ruling made and enforced; CLAUDE.md repair thoughtful |
| **Feature + MCP (M4)** | Seeded e2e correct; rerun adds zero; failure drill exits ≠0, no partial writes; `alert-mcp` with both tools + `.mcp.json` committed | One shared delivery module used by both cron and server; agent-driven verification transcript captured; spec vs implementation fully consistent |
| **Meta (throughout)** | Defect-to-spec table ≥2 honest rows; steering-failure log present; reflection engages the study | Reflection names a specific moment of sliding into delegation and which guardrail caught it |

**Grading shorthand:** M1–M2 solid = *credit-worthy attempt* · through M3 = *strong* · through M4 with honest worksheet = *spotlight candidate*. Spotlight 1–2 in the Day 4 wrap-up: show a spec diff (an amendment mid-build) or a blocked-hook transcript — those demo better than finished code.

## 5 · Support load & pre-emptions

Expect questions clustered on: Vitest ESM config (let their agent solve it — that's the assignment), `claude mcp add` flag drift (the README already points to `--help`), and the G2 loop (plant #6 — nudge toward `stop_hook_active`, don't hand the fix). The README's §08 table covers all observed snags; when someone asks in WhatsApp, reply with the section number first.

Two cautions worth pre-empting proactively:

- **S3 costs tokens.** The Agent-SDK reviewer fires a Claude call on every matching edit. Fine on individual accounts; if the cohort shares credentials or a workspace budget, say so before anyone arms it.
- **Corporate machines:** `sqlite3` needs a native toolchain; anyone who did the standard hooks lab already has it working. If someone skipped that lab, setup is where they'll stall — point them to the labs' hooks project setup first.

## 6 · Timing reality check

Advertised 4.5–6.5 h assumes genuine fluency. Calibration notes: M1 runs long for people who've never been grilled by their own agent (good — that's the point); M2 is the time sink if they skip the harness-first step; M3 is fast for anyone who reads `read_hook.js`/`tsc.js` first and slow for anyone who doesn't; M4 is smooth if M1's spec was honest and painful if it wasn't — which is the assignment teaching itself.

If a learner reports being 2× over budget on a milestone, the standing advice is: stop at the current clean exit, push, and write the reflection. A pushed M2 with an honest worksheet beats an unpushed M4 every time.
