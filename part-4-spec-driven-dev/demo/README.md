# Spec-Driven Development

**Executable specs · `/speckit-*` pipeline · Constitution-enforced · Multiple agent integrations**

Spec-Driven Development treats the specification as **executable intent**: instead of coding first and writing docs later, you start with a spec, and the agent generates code, tests, and validation from it. [Spec Kit](https://github.com/github/spec-kit) is GitHub's open-source toolkit that implements this as a chain of slash commands your coding agent runs in order, with a checkpoint between each.

---

## 01   The Problem It Solves

Vague prompting works for prototypes and breaks for anything mission-critical. "Add photo sharing to my app" forces the agent to guess at hundreds of unstated requirements — and you often don't find out which guesses were wrong until deep into the implementation.

Spec-driven flips the failure mode. Every ambiguity gets **surfaced as a question before code exists**, every architectural decision goes into a plan the agent must respect, and every requirement gets traced to at least one task before the agent starts writing.

## 02   The Seven-Skill Pipeline

Spec Kit installs slash commands into your coding agent. On Claude Code they're named with hyphens (`/speckit-*`); on Copilot they use dots (`/speckit.*`). Same underlying skills.

| Order | Skill | Job | Output |
|---|---|---|---|
| 0 | `/speckit-constitution` | Establish project non-negotiables | `.specify/memory/constitution.md` |
| 1 | `/speckit-specify` | Turn a description into a spec (what & why, no tech) | `specs/<n>-<slug>/spec.md` with user stories, FRs, SCs, edge cases, assumptions |
| 1a | `/speckit-clarify` *(optional but recommended)* | Ask up to 5 multiple-choice questions to de-risk ambiguity | `spec.md` with new `Clarifications` section |
| 2 | `/speckit-plan` | Add tech direction and produce an implementation plan | Feature branch + `plan.md`, `research.md`, `data-model.md`, `contracts/openapi.yaml`, `quickstart.md`, with Constitution Check gates |
| 2a | `/speckit-checklist` *(optional)* | Generate a quality checklist | `checklists/*.md` |
| 3 | `/speckit-tasks` | Decompose spec + plan into small dependency-ordered tasks | `tasks.md` with `[P]` parallel markers and `[USn]` story tags |
| 3a | `/speckit-analyze` *(optional, highest leverage)* | Cross-artifact consistency check with auto-remediation offer | Findings report + edits to spec/tasks |
| 4 | `/speckit-implement` | Work through tasks; write code + tests; self-verify | Full source tree, `tsc` and Vitest green between phases |

Your job at each phase is to **steer and verify**. The agent writes; you own the checkpoint.

## 03   What Makes an Executable Spec

Spec Kit's spec output isn't prose — it's a structured contract:

- **Prioritized user stories** (P1, P2) with acceptance scenarios.
- **Numbered functional requirements** (`FR-001`, `FR-002`, …) each one testable.
- **Measurable success criteria** (`SC-001`, `SC-002`, …) with numbers, not adjectives.
- **Edge cases** section that describes failure paths.
- **Assumptions** — every silent decision the tool made, made explicit.

If a "should" in the spec doesn't have a testable condition, the spec has a gap. `/speckit-clarify` or `/speckit-analyze` is where that gap gets closed.

## 04   How Constitution Flows Downstream

The constitution is the project's non-negotiable principles. Every downstream skill enforces them:

- **`/speckit-plan`** runs an explicit **Constitution Check** gate before and after design; if a principle is violated, the plan does not advance.
- **`/speckit-tasks`** upgrades OPTIONAL steps to REQUIRED when a principle demands it. Mark principle I as "Tests before implementation — NON-NEGOTIABLE," and the task list will interleave a failing test with every implementation task automatically.
- **`/speckit-implement`** produces a Completion Report with a per-principle compliance table citing evidence for each principle.

This is the tool's most under-appreciated feature. Team conventions stop being reminders you type into every prompt and start being **rules the tool enforces**.

## 05   Composition with Plan Mode and CLAUDE.md

- **Plan Mode** (Part 2) applies to a single change. **Spec Kit** applies to a feature. Plan Mode is the atom; a spec is the molecule. Inside `/speckit-implement`, any multi-file task can (and should) run under Plan Mode.
- **CLAUDE.md** (Part 4) and the constitution overlap. Conventions the agent should always follow can live in either; the constitution is best for hard rules the spec pipeline should enforce, and CLAUDE.md for softer defaults every session picks up.

## 06   When to Use — and When to Skip

**Use it when:**

- **Greenfield.** New project or new subsystem.
- **Feature into an existing system** where the "what" is not yet fully agreed.
- **Legacy modernization.** Intent is known but the current implementation is not the target.
- **Multiple engineers** will contribute to the same feature and you need one shared source of truth.

**Skip it when:**

- A single-file bug fix.
- A change small enough that Plan Mode alone is proportional.
- The "what" is not yet decided. Spec Kit generates *from* a description — if you can't describe it, don't run it.

## 07   Version Drift Warning

The public Spec Kit blog post (September 2025) documented four commands — `/specify`, `/plan`, `/tasks`, `/implement` — and an `--ai` CLI flag. The **current release (v0.12.x, verified 2026-07-01)** uses different names. This demo tracks the current CLI. If a learner is following the old blog and getting flag errors, that's why.

## 08   Recap

- Spec Kit chains: **constitution → specify → clarify → plan → tasks → analyze → implement.**
- Non-negotiable constitution principles get enforced downstream automatically.
- Every phase has a checkpoint. You steer; the agent writes.
- `/speckit-analyze` is the highest-leverage step — it turns silent inconsistencies into fixable findings before any code exists.
- Defects usually trace to spec or plan gaps. Fix upstream, then re-run.
- The constitution, spec, plan, tasks, and generated code live under `.specify/`, `specs/`, and `src/` — commit them alongside the code.

---

# Demo

# Build a Tasks API End-to-End with Spec Kit

**Full pipeline · Node.js/TypeScript · ~45 minutes**

You'll take a natural-language description of a Tasks API and drive it through Spec Kit's seven-command pipeline: constitution → specify → clarify → plan → tasks → analyze → implement. At the end you'll have 30+ generated tasks and a full working implementation with tests green — none of which you wrote by hand.

## 01   Why This Demo

The Part 3 lab has you write a spec **by hand** using the bootcamp template. This demo runs *before* that lab so you see the tool-driven form first. Same mental model, different packaging.

Every command, output shape, and behavior below is verified against a real end-to-end run. The full generated artifacts and source tree are checked in as [tasks-api-example-output/](tasks-api-example-output/) so you can compare your run against a known-good baseline.

## 02   Prerequisites

- Claude Code installed and authenticated. Inside Claude Code, `/status` should show you logged into a workspace with API credit or a Claude Pro/Max subscription.
- Python 3.11+ and `uv`:
  - Windows PowerShell: `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`
  - macOS/Linux: `curl -LsSf https://astral.sh/uv/install.sh | sh`
  - Fallback: `python -m pip install uv`
  - Verify: `uv --version`
- `git` on `PATH`.
- An **empty working directory** where Spec Kit will scaffold.

Project Files: [tasks-api-reference/](tasks-api-reference/) (raw scaffold), [tasks-api-example-output/](tasks-api-example-output/) (complete worked example).

## 03   Initialize the Project

*(Facilitator: 3 min · Solo: 5 min)*

In an empty directory:

```powershell
# Windows PowerShell
uvx --from git+https://github.com/github/spec-kit.git specify init tasks-api --integration claude --script ps
cd tasks-api
```

```bash
# macOS / Linux
uvx --from git+https://github.com/github/spec-kit.git specify init tasks-api --integration claude --script sh
cd tasks-api
```

[SCREENSHOT: `specify init` "Project ready" banner and the "Next Steps" panel listing `/speckit-*` commands.]

Show the layout:

```powershell
Get-ChildItem -Force
```

Point out:

- **`.claude/skills/speckit-*/SKILL.md`** — ten Spec Kit skills registered with Claude Code (five you'll use in this demo; four optional quality gates; one bridge to GitHub Issues).
- **`.specify/memory/`, `.specify/templates/`, `.specify/scripts/`** — the toolkit's working area.
- **No application code yet.** The toolkit installed a *workflow*, not a project.

Security callout (the CLI prints this itself): consider adding `.claude/` to `.gitignore` if the agent stores tokens there.

## 04   Open Claude Code

*(Facilitator: 1 min · Solo: 2 min)*

```bash
claude
```

Type `/` and confirm the `speckit-*` commands appear in the autocomplete menu.

[SCREENSHOT: Claude Code TUI showing `/sp` autocomplete listing `speckit-specify`, `speckit-clarify`, `speckit-analyze`, etc.]

If commands are missing, exit and re-open Claude Code from the project root — skills load from `.claude/skills/*/SKILL.md` at session start.

## 05   Phase 0 — Constitution

*(Facilitator: 3 min · Solo: 5 min)*

Paste exactly:

```
/speckit-constitution The project follows five principles:
1. Tests before implementation — every feature ships with a failing test first.
2. No untyped code — TypeScript strict mode, no `any` without a comment.
3. Errors as values — throw typed Error subclasses, never strings.
4. One responsibility per file — a route file has no business logic; a service has no HTTP.
5. Data safety over convenience — persistence must be crash-safe (atomic writes, no partial states).
```

Expect:

- The skill writes `.specify/memory/constitution.md`.
- A **Sync Impact Report** summarizing what changed and flagging any `TODO(RATIFICATION_DATE)` placeholders.
- A suggested commit message.
- A "Build Specification" button offering to proceed.

[SCREENSHOT: constitution.md open in the editor showing the five principles rendered by Spec Kit's template.]

Land the point:

> Every later phase must respect this file. If a `/speckit-plan` output ignores principle 5, we've caught a violation before writing code.

## 06   Phase 1 — Specify

*(Facilitator: 5 min · Solo: 10 min)*

```
/speckit-specify Build a small Tasks API that lets a single user create tasks
with a title and an optional due date, list their tasks, mark one complete,
and delete one. Users need to see overdue tasks at a glance and never lose
data on a crash. There is no authentication in this release — one user, one
process.
```

Expect the spec to contain:

- **4 prioritized user stories** (P1, P2) with acceptance scenarios.
- **~15 functional requirements** (`FR-001`, `FR-002`, …).
- **~6 measurable success criteria** (`SC-001`, `SC-002`, …).
- An **edge cases** section.
- **~8 explicit assumptions** (single user, single process, no auth, local file store, calendar-date granularity, no pagination, etc.).
- A **readiness assessment**: "Ready for `/speckit-plan`" or "Run `/speckit-clarify` first."

[SCREENSHOT: Generated spec.md showing prioritized user stories with FR/SC numbering.]

Read the assessment. Even if it says clarify is optional, still run it — the questions the tool asks tell you which silent decisions it made.

## 07   Phase 1a — Clarify

*(Facilitator: 6 min · Solo: 10 min)*

```
/speckit-clarify
```

The skill asks up to five questions **one at a time**, in **multiple-choice format** with a recommended default. For this Tasks API, expect questions about:

1. List ordering (overdue-first vs. creation order vs. due-date-only).
2. Task identifier format (UUID v4 vs. counter vs. ULID vs. slug).
3. Observability (logs + no metrics vs. logs + Prometheus vs. logs only).
4. Corrupted-store recovery behavior (quarantine + exit vs. rebuild vs. abort).
5. Timezone semantics for "overdue" (UTC vs. server local vs. per-request offset).

Answer each. **Accepting the recommended default is a valid strategy** — the recommendation is usually the strictest interpretation. Type `A` or `yes` for each to match the checked-in worked example.

[SCREENSHOT: A clarify question with its A/B/C/Short-answer options and the recommended default marked.]

At the end, expect a **Completion Report** with a Coverage Summary table showing every ambiguity category resolved.

## 08   Phase 2 — Plan

*(Facilitator: 6 min · Solo: 10 min)*

```
/speckit-plan Use Node.js 20 with TypeScript, Express for HTTP, and Zod for
input validation. Persist tasks to a single JSON file with an atomic write
(write to a temp file, fsync, rename) so a crash mid-write cannot corrupt
the store. Colocate tests next to source using Vitest. No database, no ORM,
no auth middleware.
```

Expect:

- An auto-created **feature branch** (`001-tasks-api`).
- Five artifacts under `specs/001-tasks-api/`:
  - `plan.md` — architecture, phase plan, Constitution Check section.
  - `research.md` — decisions with rationale and rejected alternatives.
  - `data-model.md` — entities, invariants, state transitions.
  - `contracts/openapi.yaml` — OpenAPI 3.1.
  - `quickstart.md` — manual-QA steps.
- Explicit **Constitution Check** results: "Initial gate: PASS" and "Post-design re-check: PASS."

[SCREENSHOT: plan.md's Constitution Check section showing all five principles marked PASS.]

If the plan invents dependencies you didn't ask for, correct with a targeted re-prompt: `/speckit-plan remove <dep> — use fs/promises and a rename-based atomic write directly`.

## 09   Phase 3 — Tasks

*(Facilitator: 4 min · Solo: 5 min)*

```
/speckit-tasks
```

Expect:

- **30+ tasks across ~7 phases** (Setup, Foundational, one per user story, Polish).
- Each task follows the strict format: `- [ ] Txxx [P?] [Story?] Description with file path`.
- `[P]` markers on tasks whose files are independent (parallelizable).
- `[USn]` tags mapping tasks to user stories.
- A **Suggested MVP scope** recommendation.
- **Test-first enforcement:** because your constitution marked principle I NON-NEGOTIABLE, every implementation task cites its preceding test task.

[SCREENSHOT: tasks.md excerpt showing the parallel markers, story tags, and test-first ordering.]

Apply the filter: *"When I finish this task, I can commit and the repo still builds."* If a task fails that filter, re-prompt: `/speckit-tasks refine — split any task that leaves the repo unbuildable`.

## 10   Phase 3a — Analyze

*(Facilitator: 4 min · Solo: 10 min)*

```
/speckit-analyze
```

Expect a **Specification Analysis Report** with:

- **Findings table** — severity-coded (CRITICAL / HIGH / MEDIUM / LOW), each with an ID, category, location, summary, and recommendation.
- **Coverage Summary table** listing every FR and SC with the task IDs that cover it.
- **Constitution Alignment** report.
- **Metrics** — total requirements, total tasks, coverage %, ambiguity/duplication counts, issue counts by severity.
- A **remediation offer**: reply `yes` to apply all edits, `select N,N` to pick a subset, or `no` to proceed unchanged.

[SCREENSHOT: Analyze report showing the findings table with G1 (HIGH) and G2-G4 (MEDIUM) issues and the "Reply yes to apply" prompt.]

On this Tasks API you should see ~92% coverage on first pass with 1 HIGH + 3 MEDIUM + 2 LOW findings. **Reply `yes`.** The remediations tighten the spec and add missing test tasks. Coverage rises to 100%.

This is the tool's highest-leverage step. On a real feature these findings would be production bugs.

## 11   Phase 4 — Implement

*(Facilitator: 8 min · Solo: 15 min)*

```
/speckit-implement
```

Expect the agent to work through tasks phase by phase, running `tsc --noEmit` and `npx vitest run` between phases as its own feedback loop. Green counts increment (e.g. 21/21 → 36/36 → 50/50 → 71/71 → 75/75).

[SCREENSHOT: Vitest output between phases showing test counts climbing as tasks complete.]

Narrate while it runs (facilitators):

- "Each phase ends with tests green before the next starts. That's the constitution enforcing test-first."
- "If a test fails, the agent traces it to a spec or plan gap. Fix upstream — that's the discipline."

If a test fails mid-run, **do not let the agent chase it blindly**. Ask:

```
Which line of the spec (or plan) does this failure trace to? If the spec
is silent on this, propose the amendment first; do not patch the code
without patching the spec.
```

## 12   Verify From a Fresh Shell

*(Facilitator: 2 min · Solo: 3 min)*

Exit Claude Code. Open a fresh terminal:

```powershell
cd tasks-api
npm install
npm test
```

Should show the same test count Claude reported. If it doesn't, something (usually a stale `data/` file or environment issue) is masking behavior only visible in a fresh session.

[SCREENSHOT: `npm test` in a fresh terminal showing "75 passed (75)".]

Then inspect the generated artifacts:

```powershell
Get-ChildItem .specify\memory, specs -Recurse -File | Select-Object FullName
```

## 13   Summary

- `specify init --integration claude --script ps` scaffolds; no application code yet.
- Walk the pipeline in order: constitution → specify → clarify → plan → tasks → analyze → implement.
- Non-negotiable principles get enforced automatically at plan and tasks phases.
- Multiple-choice clarify questions with recommended defaults; `yes` accepts.
- `/speckit-analyze` finds the last 8% of gaps and offers auto-remediation.
- `/speckit-implement` runs `tsc` + Vitest between phases as its own feedback loop.
- The constitution, spec, plan, tasks, and generated code are all under `.specify/`, `specs/`, and `src/` — commit them all.

**Design Decision:** *The spec is the source of truth. The code is a build artifact of the spec.*

## 14   Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `uvx` not found | `uv` not on `PATH` after install | Reopen shell; use full path; or `python -m uv tool run …` |
| `specify init` errors on `--ai` | Following outdated 2025 blog | Use `--integration claude` |
| Script warnings on Windows | Default script type mismatch | `--script ps` on Windows, `--script sh` on Unix |
| `/speckit-*` missing in Claude Code | Session started before scaffold | Exit and re-open `claude` from project root |
| `API Error 400: Not a valid API key for this workspace` | Claude Code auth issue | Inside Claude Code: `/logout` then `/login`; or unset `$env:ANTHROPIC_API_KEY` if a stale key is set |
| `/speckit-plan` invents dependencies | Prompt too permissive | Re-run with explicit "use only these libraries" constraint |
| `/speckit-implement` skips tasks | Task descriptions too vague | Re-run `/speckit-tasks` with the "buildable after every task" rule; then `/speckit-analyze` |
| Tests fail during implement | Spec or plan gap, not agent error | Trace to spec first; patch spec, then re-run |
| Blog-post commands (`/specify`, etc.) don't work | Blog is v0.1-era; current is v0.12.x | Use the `speckit-` prefix on every command |

## 15   Next Steps

- Browse [tasks-api-example-output/](tasks-api-example-output/) — the full verified end-to-end artifact set.
- Do the [Part 3 lab](../README.md) by hand on the running-build PRD. Notice which parts of the manual template map to which Spec Kit skill.
- If Claude Code auth isn't working, run the same pipeline through GitHub Copilot Chat by scaffolding with `--integration copilot` and using dot-syntax (`/speckit.constitution` etc.) — the artifacts produced are identical.
- Optional overnight: run Spec Kit against one small feature idea on one of your own repos and compare the generated spec to what you would have written by hand.

---

Sourced from the [GitHub Spec Kit repo](https://github.com/github/spec-kit) (v0.12.3, verified 2026-07-01) and the [GitHub Blog: Spec-driven development with AI](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/) (Den Delimarsky, September 2025). The DeepLearning.AI course *Spec-Driven Development with Coding Agents* teaches the same toolkit end-to-end.
