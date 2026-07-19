# Plan Mode

**Read-only exploration · Shift+Tab · Ctrl+G plan editing · Review before write**

Plan Mode is a Claude Code permission mode that locks the agent into read-only operations. It reads files, searches the codebase, and asks you questions — but it will refuse to edit files or run shell commands until you approve a written plan. It turns a multi-file change from "run and hope" into "review, correct, then run."

---

## 01   The Problem It Solves

Most people use Claude Code the same way: paste a task, let it run, review the diff. That works for small changes. It breaks down the moment a change touches multiple files.

Each unguided decision the agent makes might be right most of the time — but small error rates compound. Assume 80% accuracy per decision, and across a 20-decision feature your odds of a fully-correct outcome drop to about 1%.

Plan Mode changes the math by adding a read-only phase. It forces the agent to read the code, surface its questions, and produce a plan you review before a single file gets touched.

## 02   What Plan Mode Does

When Plan Mode is on, the agent will:

- **Read files** (`Read`, `Grep`, `Glob`, and its Explore subagent).
- **Ask clarifying questions** via structured `AskUserQuestion` prompts.
- **Produce a written plan** as a Markdown file, stored on disk and reviewable.

And it will **refuse to**:

- Edit or write files.
- Run shell commands.
- Trigger any tool with side effects.

If you ask it to "just make this one quick fix" while in Plan Mode, it won't budge. That refusal is the point — the plan is the review surface, and no code exists until you approve it.

[SCREENSHOT: Claude Code TUI footer reading "plan mode on" after Shift+Tab is pressed twice.]

## 03   Four Ways to Activate

Activate Plan Mode any of these ways:

1. **Shift + Tab twice** in the input field. Cycles Normal → Auto-Accept → Plan.
2. **`/plan`** command inside a running session.
3. **`--permission-mode plan`** CLI flag when starting a new session.
4. **`settings.json`** entry — `"permissions": { "defaultMode": "plan" }` for a permanent default.

When active, the TUI footer reads `plan mode on`.

## 04   The Explore → Plan → Execute Workflow

Plan Mode implements a three-phase loop:

1. **Explore.** The agent reads the relevant files (delegating to a read-only Explore subagent for larger surveys) and surfaces clarifying questions as `AskUserQuestion` prompts. Answer them before it plans — a good question here saves an entire round of re-work.
2. **Plan.** The agent produces a Markdown plan file. Press **Ctrl + G** (or `/plan open`) to open it in your `$EDITOR` and annotate. Delete steps you disagree with, reorder operations, add inline notes. Claude picks up every edit when you return.
3. **Execute.** Once the plan looks right, approve it. The agent works through the steps and stops on completion or when it needs manual intervention.

[SCREENSHOT: The Explore subagent reading files, then AskUserQuestion prompt for architectural decisions.]

Watch for **drift** during execution:

- Editing a file not named in the current step.
- Silently making an architecture call the plan left open.
- Combining two steps the plan kept separate.

When drift happens, **Shift + Tab back into Plan Mode**. The agent re-reads current state and produces a revised plan for the remaining steps. This is normal — most multi-file refactors go through two or three plan revisions.

## 05   Reading a Plan Critically

A structured-looking plan isn't automatically a good one. Reject or revise plans that show any of these:

- **All implementation first, tests at the end.** Interleave tests with implementation so the agent gets a feedback signal mid-run. TDD-style plans measurably out-perform.
- **Invented file paths.** Every file the plan names must already exist, or be explicitly new. Cross-check.
- **"I'll figure this out at implementation time"** on something material — a schema shape, a public contract, a retry policy.
- **Scope drift.** Every step should trace back to the prompt. No "while we're here" cleanups.

The full review checklist lives at [plan-review-checklist.md](../plan-review-checklist.md).

## 06   When to Use — and When to Skip

**Use Plan Mode when:**

- The change touches three or more files.
- You can't describe the full change in a single sentence.
- The change moves code between files or renames shared interfaces.
- A dependency upgrade has breaking API changes.
- You want a shareable review artifact before implementation cost is sunk.

**Skip it when:**

- One-line typo or config change.
- Purely mechanical work an IDE refactor tool does faster.
- A single-file function edit you'd review casually anyway.

Sizing rubric applied to the tool itself: match the tool weight to the task weight.

## 07   Where Plans Live

By default, plans go to `~/.claude/plans/` with generated names (e.g. `dreamy-orbiting-quokka.md`). To version-control plans alongside your project, set this in `settings.json`:

```json
{
  "plansDirectory": "./plans"
}
```

Project-relative plans unlock:

- Reviewing plan diffs in pull requests before anyone codes.
- Carrying annotations across sessions without relying on context compaction.
- Treating the plan file as a living document teammates edit directly.

For the bootcamp, prefer project-relative plans on the running-build branch so Day 3 reviewers can see the plan the change came from.

## 08   Recap

- Plan Mode is read-only; the plan is the review surface.
- Activate with Shift + Tab twice, `/plan`, `--permission-mode plan`, or `settings.json`.
- Explore → Plan → Execute: questions before plan, plan before code, code against plan.
- Edit the plan with Ctrl + G — corrections cost the least there.
- Drift is normal; Shift + Tab back into Plan Mode and re-plan the remainder.
- Skip it for one-line changes. Use it for anything you wouldn't review casually.

---

# Demo

# Refactor a Messy Handler Through Plan Mode

**Sample project · TypeScript · ~25 minutes**

You'll take a deliberately messy Express handler and refactor it into a clean **route → service → repository** layering — entirely through Plan Mode, without editing any file yourself. The demo shows the full Explore → Plan → Execute loop on a repo small enough that every step is visible on one screen.

## 01   Why This Demo

The Part 2 lab has you drive your own bootcamp-repo change through Plan Mode. This demo runs *before* that lab on a controlled sample so you see the mechanics on something known-good first. Every checkpoint below is verified against real behavior.

## 02   Prerequisites

- Claude Code installed and authenticated (`claude --version`).
- Node.js 20+ (`node --version`).
- `npm` or `pnpm`.
- The `sample-project/` folder in this demo directory.

Project Files: [sample-project/](sample-project/)

Set up:

```powershell
cd sample-project
npm install
npm test
```

Two tests should pass. If they don't, fix the environment before starting — Plan Mode is worth nothing if your baseline is red.

## 03   Verify Baseline

*(Facilitator: 2 min · Solo: 3 min)*

Open `src/api/orders.ts` on the projector or in your editor. Show that this single 90-line handler mixes HTTP parsing, validation, database access, response formatting, and structured logging.

Say (or note):

> "I could just tell Claude 'clean this up' — but that's exactly the shape of task where compounding decisions bite. So we'll drive it through Plan Mode."

## 04   Enter Plan Mode

*(Facilitator: 1 min · Solo: 1 min)*

In the `sample-project/` folder:

```bash
claude
```

Press **Shift + Tab twice**. The footer should change to `plan mode on`.

[SCREENSHOT: Claude Code TUI with the footer reading "plan mode on".]

If Shift+Tab does nothing (some terminals intercept the key), type `/plan` at the prompt instead.

## 05   Explore

*(Facilitator: 6 min · Solo: 8 min)*

Paste this prompt exactly:

```
Refactor src/api/orders.ts into three layers: an Express route that only
handles HTTP, a service that owns business logic, and a repository that
owns database access. Read src/api/orders.ts, src/db/client.ts, and the
existing tests before proposing anything. Ask me any questions you need
answered before you write the plan.
```

The agent should delegate to its Explore subagent (read-only) and come back with three to five clarifying questions.

[SCREENSHOT: Explore subagent reading orders.ts, client.ts, and the tests, followed by AskUserQuestion prompts.]

Answer them out loud (facilitators) or into the terminal (solo):

- *"Where should the repository live?"* → `src/db/repositories/orders.ts`.
- *"Do you want a service class or module functions?"* → **module functions.**
- *"Should I introduce a DTO type or reuse the existing type?"* → **introduce a DTO** — don't leak internal types to the API.

If the agent produces a plan without asking anything, it read the files but didn't reason about them. Re-prompt:

```
Before proposing a plan, list every file you read and one question about each.
```

## 06   Read and Edit the Plan

*(Facilitator: 6 min · Solo: 10 min)*

When the plan appears, read one step aloud (facilitators) or top-to-bottom (solo) against [plan-review-checklist.md](../plan-review-checklist.md).

Press **Ctrl + G** (or run `/plan open`) to open the plan in your editor.

[SCREENSHOT: Plan file open in an editor with an inline annotation added below one step.]

Add at least one annotation. A good one for this demo:

```
## Step 3: Extract orders repository
> NOTE: The existing tests import from src/api/orders.ts. Update those
> imports in the same step, otherwise the test suite goes red between
> steps 3 and 5.
```

Save and return to the terminal. The agent should acknowledge your annotation before you approve. If it doesn't, prompt: `address all annotations in the plan, don't implement yet`.

If Ctrl+G doesn't open your editor, set `$EDITOR` first:

- PowerShell: `$env:EDITOR = "code --wait"`
- Bash/Zsh: `export EDITOR="code --wait"`

## 07   Execute

*(Facilitator: 5 min · Solo: 10 min)*

Approve the plan. Let the agent implement step by step.

Watch for the three drift signals from § 04 in the concept doc above. Narrate them if you see them (facilitators):

- Editing a file the current step doesn't name.
- Silently deciding an architecture question the plan left open.
- Merging two steps the plan kept separate.

If drift happens: **Shift + Tab back into Plan Mode**, ask for a revised plan for the remaining steps, review, continue.

[SCREENSHOT: Agent executing the plan step-by-step; auto-accept mode showing edits landing in real time.]

## 08   Verify Green

*(Facilitator: 2 min · Solo: 3 min)*

Exit Claude Code, then run:

```bash
npm test
npm run typecheck
git diff --stat
```

All checks should pass. The diff should span a new route file, a new service file, a new repository file, and the removal (or slimming) of the original handler.

[SCREENSHOT: `git diff --stat` output showing the four files touched.]

If tests fail, do **not** ask the agent to fix them without re-entering Plan Mode first. The failure traces to either the plan (more likely) or execution drift — diagnose which before writing more code.

## 09   Summary

- Enter Plan Mode with Shift + Tab twice; footer reads `plan mode on`.
- Force the agent to ask before planning; force it to plan before writing.
- Edit the plan with Ctrl + G — that's where corrections cost the least.
- Approve, then watch for drift; Shift + Tab back to re-plan any time.
- Verify with tests and typecheck, not by re-reading the agent's summary.

The plan was the artifact. The code came out of the plan. Any mistake would have been caught in the two minutes it took to read, not the two hours it takes to review a diff.

## 10   Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Shift+Tab does nothing | Terminal intercepts the key | Use `/plan` at the prompt instead |
| Ctrl+G opens nothing | `$EDITOR` unset | Set `$EDITOR` to `code --wait`, `vim`, or `nano` and retry |
| Agent generates a plan with no questions | Read the files but didn't reason | Re-prompt: *"list every file you read and one question about each before planning"* |
| Plan disappears after `/clear` | Context compaction dropped the reference | Set `plansDirectory` to a project path so the plan file survives |
| Tests fail after execution | Plan was wrong, or execution drifted | Re-enter Plan Mode; don't iterate blindly on code |

## 11   Next Steps

- Do the [Part 2 lab](../README.md) with the same Plan Mode habit on the bootcamp repo.
- Find the planted defects in [flawed-plan.md](../flawed-plan.md) using the [plan-review checklist](../plan-review-checklist.md).
- Read the [Spec-Driven demo](../../part-3-spec-driven/demo/README.md) next. Plan Mode catches mistakes in a change; a spec catches them across a feature.

---

Sourced from [DataCamp: *Claude Code Plan Mode*](https://www.datacamp.com/tutorial/claude-code-plan-mode) (Bex Tuychiev). The `sample-project/` in this folder is bespoke to the bootcamp.
