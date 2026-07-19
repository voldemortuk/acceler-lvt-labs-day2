# Advanced Assignment Worksheet — Operation Stale Orders

Fill this in as you go. Keep it open in a split editor. It is half your submission — the code proves *what* you built; this proves *how* you steered.

**Name / initials:** `______` · **Branch:** `advanced/______` · **Started:** `______`

---

## M1 — Write the Contract

### 1.1 Gaps in the brief

At least six questions `task.md` does not answer:

1.
2.
3.
4.
5.
6.

### 1.2 Grill-me session

The three questions the agent asked that most changed your thinking (and what changed):

| Question the agent asked | What it changed in your spec |
|---|---|
| | |
| | |
| | |

### 1.3 The PII decision

`task.md` wants customer name + phone in a shared channel. Your spec's position, in one sentence, and why:

```
```

### 1.4 Commit hash of the spec (pre-implementation)

```
```

---

## M2 — Reconcile the Legacy

### 2.1 Plan v1 (paste, or paste the plan file path + commit)

```
```

### 2.2 Your intervention(s)

What you changed in the plan, and **which checklist item caught it**:

```
```

### 2.3 Plan v2 (paste, or path + commit)

```
```

### 2.4 Drift log

Any drift during execution (file outside the step / silent decision / merged steps), and what you did:

```
```

### 2.5 Mismatch inventory

The three most interesting schema↔query mismatches you fixed (not the most numerous — the most *instructive*):

1.
2.
3.

---

## M3 — Make the Rules Structural

### 3.1 Doc rot found in CLAUDE.md

What was wrong, and what you replaced it with:

```
```

### 3.2 The G1 verdict table — witnessed

Ran all five attempts from the README table. Anything surprising about *how* the agent reacted to a block:

```
```

### 3.3 Your raw-SELECT-in-tests ruling

Allowed or blocked, and the one-line rationale now in your constitution:

```
```

### 3.4 Blocked-attempt transcript (required)

Paste one real exchange: the attempt, your hook's stderr, and the agent's recovery:

```
```

### 3.5 The audit-trail bug

What was broken about the shipped logging example, and your fix:

```
```

---

## M4 — Close the Loop

### 4.1 Defect-to-spec trace (≥ 2 rows)

> Discipline: when a gap surfaced, you patched the **spec first**, then re-ran. Each row should read aloud as: *"This defect traces to this spec gap."*

| Defect / rework moment | Spec gap it traces to | Spec amendment (version) |
|---|---|---|
| | | |
| | | |
| | | |

### 4.2 Dedupe placement

Where dedupe lives (delivery layer / MCP server / both), and why:

```
```

### 4.3 End-to-end evidence

Agent's e2e run summary (step 3 of M4) — alerts delivered, order ids, and the second-run proof of zero duplicates:

```
```

### 4.4 Failure drill

Exit code observed, the structured error line, and confirmation the real outbox was untouched:

```
```

---

## Throughout — Steering Failures

Every time you had to hand-edit a source file (Rule 1), log it. Zero rows is a fine answer — but only if it's true.

| What you hand-edited | Why the agent couldn't be steered there | The prompt/hook/spec change that would prevent it next time |
|---|---|---|
| | | |

---

## Closing Reflection *(3–5 sentences — do not skip)*

The Day 2 study found that *how* you interact with AI determines whether you keep learning: high scorers generated code **and** interrogated it; low scorers delegated and drifted. Looking back across the four milestones — where were you on that spectrum, where did you catch yourself sliding into pure delegation, and which guardrail (spec, plan review, or hook) pulled you back?

```
```

**Actual time spent:** M1 `___` · M2 `___` · M3 `___` · M4 `___` · Stretch `___`
