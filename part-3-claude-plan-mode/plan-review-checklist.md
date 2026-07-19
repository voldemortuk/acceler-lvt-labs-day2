# Plan-Review Checklist

Use this on every plan before approving. Aim to spend two minutes per plan.

## The four questions

### 1. Are the files real?

- [ ] Every file the plan names actually exists in the repo (or is explicitly a new file).
- [ ] Paths match the actual layout, not a plausible-sounding alternative.
- [ ] No file the plan ignores that obviously needs to change (tests, types, migration, docs).

### 2. Are any steps missing?

- [ ] Database changes have a migration step, not just a model edit.
- [ ] New behavior has a test step, not just an implementation step.
- [ ] Cross-cutting concerns (logging, error handling, telemetry) are addressed.
- [ ] Feature flag, rollout, or backout step is named when warranted.

### 3. What is the plan assuming you haven't said?

- [ ] Ordering, idempotency, retries.
- [ ] Failure mode of every external call.
- [ ] Backward compatibility for any consumer not under our control.
- [ ] Security-sensitive defaults (auth, redaction, encryption).

### 4. Is the scope drifting?

- [ ] Every step traces to the prompt or the spec.
- [ ] No "while we're here" cleanups.
- [ ] No new dependencies without a stated reason.
- [ ] No speculative abstraction layers.

## Three signals to reject outright

- The plan invents an API or library that does not exist.
- The plan says "I'll figure this out at implementation time" about something material.
- The plan and the prompt no longer describe the same change.

## After review

If you intervened, write down:

- **What you changed.**
- **Why** (which checklist item caught it).

Bring patterns back to the team's prompt library on Day 4.
