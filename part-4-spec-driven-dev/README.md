# Part 3 Lab — Spec-Driven Development (the Running Build)

**Time:** 90 minutes total (15 framing + 10 PRD read-aloud + 60 build + 5 lock). The build portion below is the 60-min lab; the framing and PRD reveal are facilitator-led — see the [facilitator guide](../../README.md).

> The [Spec-Driven demo](demo/README.md) shows the same PRD → spec → code chain driven by GitHub's Spec Kit toolkit (`/speckit-constitution → /speckit-specify → /speckit-plan → /speckit-tasks → /speckit-implement`). Run it before or after this lab to see the mechanized form alongside the manual template used here.
**Output:** A branch `running-build/<initials>` with `spec.md`, an implementation, and at least one passing acceptance test. Days 3 and 4 work on this exact diff.

## Setup

1. Read the PRD: [prd-webhook-retries.md](prd-webhook-retries.md).
2. Open the spec template: [spec-template.md](spec-template.md).
3. Look at the worked example for a different feature: [example-spec.md](example-spec.md).
4. Open the spec-quality checklist: [spec-quality-checklist.md](spec-quality-checklist.md).

## Steps

### 1. Note the PRD gaps (5 min)

In your [worksheet](worksheet.md), write down **three things the PRD does not answer**. These are spec-writing opportunities.

### 2. Write the spec (20 min)

- Fill in the template. Save as `spec.md` in the repo root of a new branch `running-build/<initials>`.
- Commit the spec **before** any code.
- Check the spec-quality checklist — every box checked.

### 3. Drive the implementation through plan mode (40 min)

- Point Claude Code at `spec.md`.
- Use plan mode (Part 2 habit).
- Implement against the spec. As gaps surface, **patch the spec first, then re-run.**
- Aim for one spec iteration. The point is the loop, not perfection.

### 4. Tests (15 min)

- At minimum, one passing test for one acceptance criterion.
- Place tests next to the code they cover, following repo conventions.

### 5. Defect-to-spec trace (5 min)

For each defect or rework moment, write the sentence in your [worksheet](worksheet.md):

> *"This defect traces to this spec gap."*

### 6. Lock the running build (5 min)

- `spec.md` committed
- Implementation committed
- Test passing locally
- Branch pushed
- Confirm with the facilitator

## What "done" looks like

```
running-build/<initials>
├── spec.md                                # your spec
├── src/services/webhook/retry-policy.ts   # or wherever your spec puts it
├── src/services/webhook/delivery.ts       # touched
└── src/services/webhook/__tests__/retry-policy.test.ts
```

> If your branch is not pushed by the end of Part 3, Day 3 cannot review your diff. Flag the facilitator immediately.
